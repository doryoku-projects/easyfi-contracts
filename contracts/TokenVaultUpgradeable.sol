// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./UserAccessControl.sol";
import "./errors/TokenVaultErrors.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";

/**
 * @title TokenVaultUpgradeable
 * @notice Multi-token vault with fixed lock periods and deterministic growth.
 */
contract TokenVaultUpgradeable is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UserAccessControl,
    TokenVaultErrors
{
    using SafeERC20 for IERC20;
    IProtocolConfigUpgradeable private s_config;

    bytes32 private constant BP_KEY = keccak256("BP");
    bytes32 private constant TWO_FA_REQUIRED_KEY = keccak256("2FARequired");

    struct Pool {
        uint256 lockDuration;
        uint256 aprBps;
        uint256 totalPrincipal;
        bool isActive;
    }

    struct Position {
        address user;
        address token;
        uint256 poolId;
        uint256 principal;
        uint256 aprBps;
        uint256 depositTimestamp;
        uint256 unlockTimestamp;
        bool withdrawn;
    }

    mapping(address => bool) private s_supportedTokens;
    mapping(address => mapping(uint256 => Pool)) private s_pools;
    mapping(uint256 => Position) private s_positions;
    uint256 private s_nextPositionId;

    uint256 private s_entryFeeBps;
    uint256 private s_exitFeeBps;
    address private s_managerWallet;
    address private s_feeCollector;

    event VaultDeposit(
        uint256 indexed positionId,
        address indexed user,
        address indexed token,
        uint256 poolId,
        uint256 amount,
        uint256 entryFee,
        uint256 unlockTimestamp
    );

    event VaultWithdrawal(
        uint256 indexed positionId,
        address indexed user,
        uint256 totalPayout,
        uint256 exitFee
    );

    event PoolSet(
        address indexed token,
        uint256 poolId,
        uint256 lockDuration,
        uint256 aprBps,
        bool isActive
    );
    event FeesSet(uint256 entryFeeBps, uint256 exitFeeBps);
    event ManagerWalletSet(address indexed manager);
    event FeeCollectorSet(address indexed collector);
    event TokenStatusSet(address indexed token, bool status);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the vault contract.
     * @param _userManager Address of the UserManager contract.
     * @param _managerWallet Address of the manager wallet that will hold the funds.
     * @param _feeCollector Address where fees will be sent.
     * @param _entryFeeBps Entry fee in basis points.
     * @param _exitFeeBps Exit fee in basis points.
     */
    function initialize(
        address _protocolConfig,
        address _userManager,
        address _managerWallet,
        address _feeCollector,
        uint256 _entryFeeBps,
        uint256 _exitFeeBps
    ) public initializer {
        if (
            _protocolConfig == address(0) ||
            _userManager == address(0) ||
            _managerWallet == address(0) ||
            _feeCollector == address(0)
        ) {
            revert TV_ZERO_ADDRESS();
        }
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        s_userManager = IUserManagerUpgradeable(_userManager);
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_managerWallet = _managerWallet;
        s_feeCollector = _feeCollector;
        s_entryFeeBps = _entryFeeBps;
        s_exitFeeBps = _exitFeeBps;
        s_nextPositionId = 1;
    }

    function _authorizeUpgrade(address) internal override onlyMasterAdmin {}

    /**
     * @dev Basic points(BP) instance from central config.
     */
    function _BP() internal view returns (uint256) {
        return s_config.getUint(BP_KEY);
    }

    /**
     * @notice Configure a pool for a specific token and lock period.
     * @param token Address of the token (BTC/ETH equivalent).
     * @param poolId Identifier for the pool (e.g., 1, 3, 6, 12).
     * @param lockDuration Seconds the funds will be locked.
     * @param aprBps Annual Percentage Rate in basis points.
     * @param isActive Whether the pool is active for new deposits.
     */
    function setPool(
        address token,
        uint256 poolId,
        uint256 lockDuration,
        uint256 aprBps,
        bool isActive
    ) external onlyGeneralOrMasterAdmin {
        if (token == address(0)) revert TV_ZERO_ADDRESS();
        if (aprBps > _BP()) revert TV_BPS_TOO_HIGH();

        s_pools[token][poolId] = Pool({
            lockDuration: lockDuration,
            aprBps: aprBps,
            totalPrincipal: s_pools[token][poolId].totalPrincipal,
            isActive: isActive
        });

        emit PoolSet(token, poolId, lockDuration, aprBps, isActive);
    }

    /**
     * @notice Update entry and exit fees.
     * @param entryFeeBps Entry fee in basis points.
     * @param exitFeeBps Exit fee in basis points.
     */
    function setFees(
        uint256 entryFeeBps,
        uint256 exitFeeBps
    ) external onlyGeneralOrMasterAdmin {
        if (entryFeeBps > _BP() || exitFeeBps > _BP()) revert TV_BPS_TOO_HIGH();
        s_entryFeeBps = entryFeeBps;
        s_exitFeeBps = exitFeeBps;
        emit FeesSet(entryFeeBps, exitFeeBps);
    }

    /**
     * @notice Update the manager wallet address.
     * @param manager New manager wallet address.
     */
    function setManagerWallet(
        address manager
    ) external onlyGeneralOrMasterAdmin {
        if (manager == address(0)) revert TV_ZERO_ADDRESS();
        s_managerWallet = manager;
        emit ManagerWalletSet(manager);
    }

    /**
     * @notice Update the fee collector address.
     * @param collector New fee collector address.
     */
    function setFeeCollector(
        address collector
    ) external onlyGeneralOrMasterAdmin {
        if (collector == address(0)) revert TV_ZERO_ADDRESS();
        s_feeCollector = collector;
        emit FeeCollectorSet(collector);
    }

    /**
     * @notice Enable or disable a token for deposits.
     * @param token Address of the token.
     * @param status True to enable, false to disable.
     */
    function setTokenStatus(
        address token,
        bool status
    ) external onlyGeneralOrMasterAdmin {
        if (token == address(0)) revert TV_ZERO_ADDRESS();
        s_supportedTokens[token] = status;
        emit TokenStatusSet(token, status);
    }

    function pause() external onlyGeneralOrMasterAdmin {
        _pause();
    }

    function unpause() external onlyGeneralOrMasterAdmin {
        _unpause();
    }

    /**
     * @notice Deposit tokens into a pool.
     * @param token Address of the token to deposit.
     * @param poolId Identifier of the lock pool.
     * @param amount Amount of tokens to deposit.
     */
    function deposit(
        address token,
        uint256 poolId,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyUser {
        if (!s_supportedTokens[token]) revert TV_INVALID_TOKEN();
        Pool storage pool = s_pools[token][poolId];
        if (!pool.isActive) revert TV_INVALID_POOL();
        if (amount == 0) revert TV_ZERO_AMOUNT();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 entryFee = (amount * s_entryFeeBps) / _BP();
        uint256 netAmount = amount - entryFee;

        if (entryFee > 0) {
            IERC20(token).safeTransfer(s_feeCollector, entryFee);
        }

        IERC20(token).safeTransfer(s_managerWallet, netAmount);

        uint256 positionId = s_nextPositionId++;
        uint256 unlockTimestamp = block.timestamp + pool.lockDuration;

        s_positions[positionId] = Position({
            user: msg.sender,
            token: token,
            poolId: poolId,
            principal: netAmount,
            aprBps: pool.aprBps,
            depositTimestamp: block.timestamp,
            unlockTimestamp: unlockTimestamp,
            withdrawn: false
        });

        pool.totalPrincipal += netAmount;

        emit VaultDeposit(
            positionId,
            msg.sender,
            token,
            poolId,
            netAmount,
            entryFee,
            unlockTimestamp
        );
    }

    /**
     * @notice Withdraw funds after the lock period has expired.
     * @dev Payout includes principal and deterministic growth. Manager wallet must have approved the contract.
     * @param positionId Identifier of the position to withdraw.
     * @param code Two-factor authentication code.
     */
    function withdraw(
        uint256 positionId,
        string calldata code
    ) external nonReentrant whenNotPaused {
        bool _2FARequired = s_config.getUint(TWO_FA_REQUIRED_KEY) == 1;
        if (_2FARequired) s_userManager.check2FA(msg.sender, code, 0);

        Position storage pos = s_positions[positionId];
        if (pos.withdrawn) revert TV_ALREADY_WITHDRAWN();
        if (pos.user != msg.sender) revert TV_UNAUTHORIZED();
        if (block.timestamp < pos.unlockTimestamp) revert TV_STILL_LOCKED();

        pos.withdrawn = true;

        uint256 duration = pos.unlockTimestamp - pos.depositTimestamp;
        uint256 growth = (pos.principal * pos.aprBps * duration) /
            (365 days * _BP());
        uint256 totalPayout = pos.principal + growth;
        uint256 exitFee = (totalPayout * s_exitFeeBps) / _BP();
        uint256 finalAmount = totalPayout - exitFee;

        s_pools[pos.token][pos.poolId].totalPrincipal -= pos.principal;

        if (exitFee > 0) {
            IERC20(pos.token).safeTransfer(
                s_feeCollector,
                exitFee
            );
        }

        IERC20(pos.token).safeTransfer(
            msg.sender,
            finalAmount
        );

        emit VaultWithdrawal(positionId, msg.sender, totalPayout, exitFee);
    }

    function getPool(
        address token,
        uint256 poolId
    ) external view returns (Pool memory) {
        return s_pools[token][poolId];
    }

    function getPosition(
        uint256 positionId
    ) external view returns (Position memory) {
        return s_positions[positionId];
    }

    function isSupportedToken(address token) external view returns (bool) {
        return s_supportedTokens[token];
    }

    function getEntryFeeBps() external view returns (uint256) {
        return s_entryFeeBps;
    }

    function getExitFeeBps() external view returns (uint256) {
        return s_exitFeeBps;
    }

    function getManagerWallet() external view returns (address) {
        return s_managerWallet;
    }

    function getFeeCollector() external view returns (address) {
        return s_feeCollector;
    }
}
