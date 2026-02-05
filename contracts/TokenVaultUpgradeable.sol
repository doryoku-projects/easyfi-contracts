// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

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
    uint256 private constant PRICE_STALENESS_THRESHOLD = 24 hours;
    address private constant NATIVE_TOKEN = address(0);

    struct YieldPlan {
        uint256 lockDuration;
        uint256 aprBps;
        uint256 totalPrincipal;
        bool isActive;
    }

    struct LockedDeposit {
        uint256 depositId;
        address user;
        address token;
        uint256 yieldId;
        uint256 principal;
        uint256 aprBps;
        uint256 depositTimestamp;
        uint256 unlockTimestamp;
        bool withdrawn;
        uint256 dailyWinning;
        uint256 depositPrice;
        uint256 withdrawPrice;
    }

    mapping(address => bool) private s_supportedTokens;
    mapping(address => address) private s_tokenOracles;
    mapping(address => mapping(uint256 => YieldPlan)) private s_yields;
    mapping(uint256 => LockedDeposit) private s_deposits;
    uint256 private s_nextDepositId;
    mapping(address => uint256[]) private s_userDeposit;

    uint256 private s_entryFeeBps;
    uint256 private s_exitFeeBps;
    address private s_managerWallet;
    address private s_feeCollector;
    mapping(address => uint256) private s_tokenYieldId;

    event VaultDeposit(
        uint256 indexed depositId,
        address indexed user,
        address indexed token,
        uint256 yieldId,
        uint256 amount,
        uint256 entryFee,
        uint256 unlockTimestamp,
        uint256 depositPrice
    );

    event VaultWithdrawal(
        uint256 indexed depositId,
        address indexed user,
        uint256 totalPayout,
        uint256 exitFee,
        uint256 withdrawPrice
    );

    event YieldSet(
        address indexed token,
        uint256 yieldId,
        uint256 lockDuration,
        uint256 aprBps,
        bool isActive
    );
    event FeesSet(uint256 entryFeeBps, uint256 exitFeeBps);
    event ManagerWalletSet(address indexed manager);
    event FeeCollectorSet(address indexed collector);
    event TokenStatusSet(address indexed token, bool status);
    event TokenOracleUpdated(address indexed token, address indexed oracle);

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
        ) revert TV_ZERO_ADDRESS();

        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        s_userManager = IUserManagerUpgradeable(_userManager);
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_managerWallet = _managerWallet;
        s_feeCollector = _feeCollector;
        s_entryFeeBps = _entryFeeBps;
        s_exitFeeBps = _exitFeeBps;
        s_nextDepositId = 1;
    }

    function _authorizeUpgrade(address) internal override onlyMasterAdmin {}

    /**
     * @dev Basic points(BP) instance from central config.
     */
    function _BP() internal view returns (uint256) {
        return s_config.getUint(BP_KEY);
    }

    /**
     * @notice Configure a yield for a specific token and lock period.
     * @param token Address of the token (BTC/ETH equivalent).
     * @param lockDuration Seconds the funds will be locked.
     * @param aprBps Annual Percentage Rate in basis points.
     * @param isActive Whether the yield is active for new deposits.
     * @return yieldId Identifier for the new yield.
     */
    function setYieldPlan(
        address token,
        uint256 lockDuration,
        uint256 aprBps,
        bool isActive
    ) external onlyGeneralOrMasterAdmin returns (uint256 yieldId) {
        if (aprBps > _BP()) revert TV_BPS_TOO_HIGH();

        if (s_tokenYieldId[token] == 0) s_tokenYieldId[token] = 1;

        yieldId = s_tokenYieldId[token]++;
        s_yields[token][yieldId] = YieldPlan({
            lockDuration: lockDuration,
            aprBps: aprBps,
            totalPrincipal: 0,
            isActive: isActive
        });

        emit YieldSet(token, yieldId, lockDuration, aprBps, isActive);
    }

    /**
     * @notice Update an existing yield plan.
     * @param token Address of the token.
     * @param yieldId Identifier for the yield to update.
     * @param lockDuration New lock duration.
     * @param aprBps New APR in basis points.
     * @param isActive Whether the yield is active.
     */
    function updateYieldPlan(
        address token,
        uint256 yieldId,
        uint256 lockDuration,
        uint256 aprBps,
        bool isActive
    ) external onlyGeneralOrMasterAdmin {
        if (aprBps > _BP()) revert TV_BPS_TOO_HIGH();
        if (s_yields[token][yieldId].lockDuration == 0)
            revert TV_INVALID_YIELD();

        s_yields[token][yieldId] = YieldPlan({
            lockDuration: lockDuration,
            aprBps: aprBps,
            totalPrincipal: s_yields[token][yieldId].totalPrincipal,
            isActive: isActive
        });

        emit YieldSet(token, yieldId, lockDuration, aprBps, isActive);
    }

    /**
     * @notice Get the latest yield identifier for a specific token.
     * @param token Address of the token.
     * @return The latest yield ID that will be assigned.
     */
    function getTokenYieldCount(address token) external view returns (uint256) {
        return s_tokenYieldId[token];
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
        s_supportedTokens[token] = status;
        emit TokenStatusSet(token, status);
    }

    /**
     * @notice Batch-assign multiple oracles to multiple tokens.
     * @param tokens Array of token addresses.
     * @param oracles Array of corresponding oracle addresses.
     */
    function setTokenOracles(
        address[] calldata tokens,
        address[] calldata oracles
    ) external onlyGeneralOrMasterAdmin {
        if (tokens.length != oracles.length) revert TV_ARRAY_LENGTH_MISMATCH();

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            address oracle = oracles[i];

            if (oracle == address(0)) revert TV_INVALID_ORACLE_ADDRESS();

            s_tokenOracles[token] = oracle;
            emit TokenOracleUpdated(token, oracle);
        }
    }

    function pause() external onlyGeneralOrMasterAdmin {
        _pause();
    }

    function unpause() external onlyGeneralOrMasterAdmin {
        _unpause();
    }

    /**
     * @notice Allows the contract to receive native tokens (e.g., from manager wallet).
     */
    receive() external payable {}

    /**
     * @notice Deposit tokens into a yield.
     * @param token Address of the token to deposit.
     * @param yieldId Identifier of the lock yield.
     * @param amount Amount of tokens to deposit.
     */
    function deposit(
        address token,
        uint256 yieldId,
        uint256 amount
    ) external payable nonReentrant whenNotPaused onlyUser {
        if (!s_supportedTokens[token]) revert TV_INVALID_TOKEN();
        YieldPlan storage yield = s_yields[token][yieldId];
        if (!yield.isActive) revert TV_INVALID_YIELD();

        if (token == NATIVE_TOKEN) {
            if (msg.value == 0) revert TV_ZERO_AMOUNT();
            amount = msg.value;
        } else {
            if (msg.value != 0) revert TV_INVALID_NATIVE_AMOUNT();
            if (amount == 0) revert TV_ZERO_AMOUNT();
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 entryFee = (amount * s_entryFeeBps) / _BP();
        uint256 netAmount = amount - entryFee;

        if (entryFee > 0) {
            if (token == NATIVE_TOKEN) {
                (bool success, ) = s_feeCollector.call{value: entryFee}("");
                if (!success) revert TV_NATIVE_TRANSFER_FAILED();
            } else IERC20(token).safeTransfer(s_feeCollector, entryFee);
        }

        if (token == NATIVE_TOKEN) {
            (bool success, ) = s_managerWallet.call{value: netAmount}("");
            if (!success) revert TV_NATIVE_TRANSFER_FAILED();
        } else IERC20(token).safeTransfer(s_managerWallet, netAmount);

        uint256 depositId = s_nextDepositId++;
        uint256 unlockTimestamp = block.timestamp + yield.lockDuration;

        s_deposits[depositId] = LockedDeposit({
            depositId: depositId,
            user: msg.sender,
            token: token,
            yieldId: yieldId,
            principal: netAmount,
            aprBps: yield.aprBps,
            depositTimestamp: block.timestamp,
            unlockTimestamp: unlockTimestamp,
            withdrawn: false,
            dailyWinning: 0,
            depositPrice: _getPrice(token),
            withdrawPrice: 0
        });

        s_userDeposit[msg.sender].push(depositId);

        yield.totalPrincipal += netAmount;

        emit VaultDeposit(
            depositId,
            msg.sender,
            token,
            yieldId,
            netAmount,
            entryFee,
            unlockTimestamp,
            s_deposits[depositId].depositPrice
        );
    }

    /**
     * @notice Withdraw funds after the lock period has expired.
     * @dev Payout includes principal and deterministic growth. Manager wallet must have approved the contract.
     * @param depositId Identifier of the deposit to withdraw.
     */
    function withdraw(uint256 depositId) external nonReentrant whenNotPaused {
        LockedDeposit storage pos = s_deposits[depositId];
        if (pos.withdrawn) revert TV_ALREADY_WITHDRAWN();
        if (pos.user != msg.sender) revert TV_UNAUTHORIZED();
        if (block.timestamp < pos.unlockTimestamp) revert TV_STILL_LOCKED();

        uint256 currentPrice = _getPrice(pos.token);
        pos.withdrawn = true;
        pos.withdrawPrice = currentPrice;

        _removeUserDeposit(msg.sender, depositId);

        uint256 duration = pos.unlockTimestamp - pos.depositTimestamp;
        uint256 growth = (pos.principal * pos.aprBps * duration) /
            (365 days * _BP());
        uint256 totalPayout = pos.principal + growth;
        uint256 exitFee = (totalPayout * s_exitFeeBps) / _BP();
        uint256 finalAmount = totalPayout - exitFee;

        s_yields[pos.token][pos.yieldId].totalPrincipal -= pos.principal;

        if (exitFee > 0) {
            if (pos.token == NATIVE_TOKEN) {
                (bool success, ) = s_feeCollector.call{value: exitFee}("");
                if (!success) revert TV_NATIVE_TRANSFER_FAILED();
            } else IERC20(pos.token).safeTransfer(s_feeCollector, exitFee);
        }

        if (pos.token == NATIVE_TOKEN) {
            (bool success, ) = msg.sender.call{value: finalAmount}("");
            if (!success) revert TV_NATIVE_TRANSFER_FAILED();
        } else IERC20(pos.token).safeTransfer(msg.sender, finalAmount);

        emit VaultWithdrawal(
            depositId,
            msg.sender,
            totalPayout,
            exitFee,
            currentPrice
        );
    }

    function getYieldPlan(
        address token,
        uint256 yieldId
    ) external view returns (YieldPlan memory) {
        return s_yields[token][yieldId];
    }

    function getDeposit(
        uint256 depositId
    ) external view returns (LockedDeposit memory) {
        return s_deposits[depositId];
    }

    /**
     * @notice Get all active deposit IDs for a user.
     * @param user Address of the user.
     * @return Array of active deposit IDs.
     */
    function getUserActiveDeposits(
        address user
    ) external view returns (uint256[] memory) {
        return s_userDeposit[user];
    }

    /**
     * @notice Get detailed info for all active deposits of a user.
     * @param user Address of the user.
     * @return Array of DepositsInfo structs including daily winnings.
     */
    function getUserActiveDepositsInfo(
        address user
    ) external view returns (LockedDeposit[] memory) {
        uint256[] storage depositIds = s_userDeposit[user];
        uint256 length = depositIds.length;
        LockedDeposit[] memory infos = new LockedDeposit[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 dId = depositIds[i];
            LockedDeposit storage pos = s_deposits[dId];
            uint256 dailyWinning = (pos.principal * pos.aprBps) / (365 * _BP());

            infos[i] = LockedDeposit({
                depositId: dId,
                user: pos.user,
                token: pos.token,
                yieldId: pos.yieldId,
                principal: pos.principal,
                aprBps: pos.aprBps,
                depositTimestamp: pos.depositTimestamp,
                unlockTimestamp: pos.unlockTimestamp,
                withdrawn: pos.withdrawn,
                dailyWinning: dailyWinning,
                depositPrice: pos.depositPrice,
                withdrawPrice: pos.withdrawPrice
            });
        }
        return infos;
    }

    /**
     * @dev Internal function to remove a deposit ID from user's active list.
     * @param user Address of the user.
     * @param depositId Identifier of the deposit to remove.
     */
    function _removeUserDeposit(address user, uint256 depositId) internal {
        uint256[] storage deposits = s_userDeposit[user];
        uint256 length = deposits.length;
        for (uint256 i = 0; i < length; i++) {
            if (deposits[i] == depositId) {
                deposits[i] = deposits[length - 1];
                deposits.pop();
                break;
            }
        }
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

    /**
     * @notice Get the price of a token from its oracle.
     * @param token Address of the token.
     * @return price Current price of the token.
     */
    function _getPrice(address token) internal view returns (uint256) {
        address oracle = s_tokenOracles[token];
        if (oracle == address(0)) revert TV_ORACLE_NOT_SET();

        AggregatorV3Interface priceFeed = AggregatorV3Interface(oracle);
        (
            uint80 roundID,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        if (answer <= 0) revert TV_INVALID_PRICE();
        if (
            updatedAt == 0 ||
            updatedAt < block.timestamp - PRICE_STALENESS_THRESHOLD
        ) revert TV_STALE_PRICE();
        if (answeredInRound < roundID) revert TV_STALE_ROUND();

        return uint256(answer);
    }
}
