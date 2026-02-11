// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./VaultDepositNFTUpgradeable.sol";
import "../UserAccessControl.sol";
import "../errors/TokenVaultErrors.sol";
import "../interfaces/IProtocolConfigUpgradeable.sol";

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
    VaultDepositNFTUpgradeable private s_depositNFT;

    bytes32 private constant BP_KEY = keccak256("BP");

    struct YieldPlan {
        uint256 lockDuration;
        uint256 aprBps;
        bool isActive;
    }

    struct LockedDeposit {
        uint256 depositId;
        address user;
        address token;
        uint256 yieldId;
        uint256 netPrincipal;  // Amount after entry fee
        uint256 depositTimestamp;
        uint256 unlockTimestamp;
        bool withdrawn;
        uint256 aprBps;
    }

    mapping(address => bool) private s_supportedTokens;
    mapping(address => mapping(uint256 => YieldPlan)) private s_yields;
    mapping(uint256 => LockedDeposit) private s_deposits;
    uint256 private s_nextDepositId;
    mapping(address => uint256[]) private s_userDeposits;

    uint256 private s_entryFeeBps;
    uint256 private s_exitFeeBps;
    address private s_managerWallet;
    address private s_feeCollector;

    event VaultDeposit(
        uint256 indexed depositId,
        address indexed user,
        address indexed token,
        uint256 yieldId,
        uint256 netAmount,
        uint256 entryFee,
        uint256 unlockTimestamp
    );

    event VaultWithdrawal(
        uint256 indexed depositId,
        address indexed user,
        uint256 approvedAmount,
        uint256 exitFee
    );

    event YieldSet(
        address indexed token,
        uint256 yieldId,
        uint256 lockDuration,
        uint256 aprBps,
        bool isActive,
        uint256 entryFeeBps,
        uint256 exitFeeBps
    );

    event FeesSet(uint256 entryFeeBps, uint256 exitFeeBps);
    event ManagerWalletSet(address indexed manager);
    event FeeCollectorSet(address indexed collector);

    event TokenStatusSet(address indexed token, bool status);
    event DepositNFTSet(address indexed nftAddress);

    event WithdrawalsFunded(
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event FundsReturned(
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

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
     * @notice Set the NFT contract address (one-time setup or upgrade)
     * @param nftAddress Address of the VaultDepositNFTUpgradeable contract
     */
    function setDepositNFT(address nftAddress) external onlyGeneralOrMasterAdmin {
        if (nftAddress == address(0)) revert TV_ZERO_ADDRESS();
        s_depositNFT = VaultDepositNFTUpgradeable(nftAddress);
        emit DepositNFTSet(nftAddress);
    }

    /**
     * @notice Configure a yield for a specific token and lock period.
     * @param token Address of the token (BTC/ETH equivalent).
     * @param yieldId Identifier for the yield (e.g., 1, 3, 6, 12).
     * @param lockDuration Seconds the funds will be locked.
     * @param aprBps Annual Percentage Rate in basis points.
     * @param isActive Whether the yield is active for new deposits.
     */
    function setYieldPlan(
        address token,
        uint256 yieldId,
        uint256 lockDuration,
        uint256 aprBps,
        bool isActive
    ) external onlyGeneralOrMasterAdmin {
        if (token == address(0)) revert TV_ZERO_ADDRESS();
        if (aprBps > _BP()) revert TV_BPS_TOO_HIGH();

        s_yields[token][yieldId] = YieldPlan({
            lockDuration: lockDuration,
            aprBps: aprBps,
            isActive: isActive
        });

        emit YieldSet(token, yieldId, lockDuration, aprBps, isActive, s_entryFeeBps, s_exitFeeBps);
    }

    /**
     * @notice Batch configure yield plans for multiple tokens and durations.
     */
    function setYieldPlansBatch(
        address[] calldata tokens,
        uint256[] calldata yieldIds,
        uint256[] calldata lockDurations,
        uint256[] calldata aprBpsList,
        bool[] calldata isActives
    ) external onlyGeneralOrMasterAdmin {
        uint256 length = tokens.length;
        if (
            length != yieldIds.length ||
            length != lockDurations.length ||
            length != aprBpsList.length ||
            length != isActives.length
        ) revert TV_INPUT_MISMATCH();

        for (uint256 i = 0; i < length; i++) {
            address token = tokens[i];
            uint256 aprBps = aprBpsList[i];
            
            if (token == address(0)) revert TV_ZERO_ADDRESS();
            if (aprBps > _BP()) revert TV_BPS_TOO_HIGH();

            s_yields[token][yieldIds[i]] = YieldPlan({
                lockDuration: lockDurations[i],
                aprBps: aprBps,
                isActive: isActives[i]
            });

            emit YieldSet(token, yieldIds[i], lockDurations[i], aprBps, isActives[i], s_entryFeeBps, s_exitFeeBps);
        }
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
     * @notice Deposit tokens into a yield.
     * @param token Address of the token to deposit.
     * @param yieldId Identifier of the lock yield.
     * @param amount Amount of tokens to deposit.
     */
    function deposit(
        address token,
        uint256 yieldId,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyUser {
        if (!s_supportedTokens[token]) revert TV_INVALID_TOKEN();
        
        YieldPlan storage yieldPlan = s_yields[token][yieldId];
        if (!yieldPlan.isActive) revert TV_INVALID_YIELD();
        if (amount == 0) revert TV_ZERO_AMOUNT();

        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate fees
        uint256 entryFee = (amount * s_entryFeeBps) / _BP();
        uint256 netAmount = amount - entryFee;

        // Send entry fee to collector
        if (entryFee > 0) {
            IERC20(token).safeTransfer(s_feeCollector, entryFee);
        }

        // Send principal to manager wallet (for yield generation)
        IERC20(token).safeTransfer(s_managerWallet, netAmount);

        // Create deposit record
        uint256 depositId = s_nextDepositId++;
        uint256 unlockTimestamp = block.timestamp + yieldPlan.lockDuration;

        s_deposits[depositId] = LockedDeposit({
            depositId: depositId,
            user: msg.sender,
            token: token,
            yieldId: yieldId,
            netPrincipal: netAmount,
            depositTimestamp: block.timestamp,
            unlockTimestamp: unlockTimestamp,
            withdrawn: false,
            aprBps: yieldPlan.aprBps
        });

        s_userDeposits[msg.sender].push(depositId);

        // Mint NFT to user
        if (address(s_depositNFT) != address(0)) {
            s_depositNFT.mint(
                msg.sender,
                depositId,
                token,
                yieldId,
                netAmount,
                block.timestamp,
                unlockTimestamp
            );
        }

        emit VaultDeposit(
            depositId,
            msg.sender,
            token,
            yieldId,
            netAmount,
            entryFee,
            unlockTimestamp
        );
    }

    /**
     * @notice Withdraw with backend approval
     * @param depositId ID of the deposit
     * @param approvedAmount Total amount approved by backend (principal + rewards)
     */
    function withdraw(
        uint256 depositId,
        uint256 approvedAmount
    ) external nonReentrant whenNotPaused {
        LockedDeposit storage pos = s_deposits[depositId];

//         struct LockedDeposit {
//     uint256 depositId;
//     address user;
//     address token;
//     uint256 yieldId;
//     uint256 netPrincipal;
//     uint256 depositTimestamp;
//     uint256 unlockTimestamp;
//     bool withdrawn;
//    uint256 aprBps;  // Added to track APR for this deposit
// }

        if (pos.withdrawn) revert TV_ALREADY_WITHDRAWN();
        if (pos.user != msg.sender) revert TV_UNAUTHORIZED();
        if (block.timestamp < pos.unlockTimestamp) revert TV_STILL_LOCKED();

        uint256 duration = pos.unlockTimestamp - pos.depositTimestamp;
        uint256 growth = (pos.netPrincipal * pos.aprBps * duration) /
            (365 days * _BP());
        uint256 totalPayout = pos.netPrincipal + growth;

        if (approvedAmount > totalPayout) revert TV_APPROVED_AMOUNT_TOO_HIGH();


        pos.withdrawn = true;
        _removeUserDeposit(msg.sender, depositId);

        // Calculate exit fee
        uint256 exitFee = (approvedAmount * s_exitFeeBps) / _BP();
        uint256 finalAmount = approvedAmount - exitFee;

        // Send fee to collector
        if (exitFee > 0) {
            IERC20(pos.token).safeTransfer(s_feeCollector, exitFee);
        }

        // Send funds to user
        IERC20(pos.token).safeTransfer(msg.sender, finalAmount);

        // Burn NFT
        if (address(s_depositNFT) != address(0)) {
            s_depositNFT.burn(depositId);
        }

        emit VaultWithdrawal(depositId, msg.sender, approvedAmount, exitFee);
    }

    /**
     * @notice Admin pre-funds contract for upcoming withdrawals
     */
    function fundUpcomingWithdrawals(
        address token,
        uint256 amount
    ) external onlyGeneralOrMasterAdmin {
        IERC20(token).safeTransferFrom(s_managerWallet, address(this), amount);
        emit WithdrawalsFunded(token, amount, block.timestamp);
    }

    /**
     * @notice Return excess funds to manager wallet
     */
    function returnExcessFunds(
        address token,
        uint256 amount
    ) external onlyGeneralOrMasterAdmin {
        IERC20(token).safeTransfer(s_managerWallet, amount);
        emit FundsReturned(token, amount, block.timestamp);
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
        return s_userDeposits[user];
    }

    function getAvailableBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Internal function to remove a deposit ID from user's active list.
     * @param user Address of the user.
     * @param depositId Identifier of the deposit to remove.
     */
    function _removeUserDeposit(address user, uint256 depositId) internal {
        uint256[] storage deposits = s_userDeposits[user];
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

    function getDepositNFTAddress() external view returns (address) {
        return address(s_depositNFT);
    }
}
