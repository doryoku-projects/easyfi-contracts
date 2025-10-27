// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./UserAccessControl.sol";
import "./errors/AggregatorErrors.sol";

import "./interfaces/IUserManagerUpgradeable.sol";
import "./interfaces/IVaultManagerUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";

/**
 * @title AggregatorUpgradeable
 * @notice This contract is responsible of interacting with the VaultManager so users can manage their liquidity positions.
 */
contract AggregatorUpgradeable is UUPSUpgradeable, ReentrancyGuardUpgradeable, UserAccessControl, AggregatorErrors {
    using SafeERC20 for IERC20;

    IProtocolConfigUpgradeable private s_config;
    bytes32 private constant VAULT_KEY = keccak256("VaultManager");
    bytes32 private constant MAIN_KEY = keccak256("MainToken");
    bytes32 private constant BP_KEY = keccak256("BP");

    uint256 private s_maxMigrationSize;

    event ProtocolConfigSet();
    event UserManagerSet();

    function initialize(address _protocolConfig, address _userManager, uint256 _maxMigrationSize) public initializer {
        if (_protocolConfig == address(0) || _userManager == address(0)){
            revert AGG_ZERO_ADDRESS();
        }
        if (_maxMigrationSize == 0){
            revert AGG_ZERO_MAX_MIGRATION_SIZE();
        }
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_userManager = IUserManagerUpgradeable(_userManager);
        s_maxMigrationSize = _maxMigrationSize;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Required function for UUPS upgradeable contracts.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyMasterAdmin {}

    /**
     * @notice Set the maximum number of items that can be migrated in a single batch
     * @dev This function sets the maximum batch size for migration operations
     * @param _maxMigrationSize The maximum number of items that can be migrated in a single batch
     */
    function setMaxMigrationSize(uint256 _maxMigrationSize) external onlyMasterAdmin {
        if (_maxMigrationSize == 0) revert AGG_ZERO_MAX_MIGRATION_SIZE();
        s_maxMigrationSize = _maxMigrationSize;
    }

    /**
     * @notice Set the address of the new ProtocolConfig contract.
     * @param _newProtocolConfig Address of the new ProtocolConfig contract.
     */
    function setProtocolConfigAddress(address _newProtocolConfig) public onlyMasterAdmin returns (bool) {
        if (_newProtocolConfig == address(0)) revert AGG_ZERO_ADDRESS();
        if (_newProtocolConfig == address(s_config)) {
            revert AGG_ADDRESS_UNCHANGED();
        }

        s_config = IProtocolConfigUpgradeable(_newProtocolConfig);
        emit ProtocolConfigSet();
        return true;
    }

    /**
     * @notice Set the address of the new UserManager.
     * @param _newUserManagerAddress Address of the new UserManager.
     * @return True if the address was successfully updated.
     */
    function setUserManagerAddress(address _newUserManagerAddress) public onlyGeneralOrMasterAdmin returns (bool) {
        if (_newUserManagerAddress == address(0)) revert AGG_ZERO_ADDRESS();
        if (_newUserManagerAddress == address(s_userManager)) {
            revert AGG_ADDRESS_UNCHANGED();
        }

        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
        emit UserManagerSet();
        return true;
    }

    /**
     * @dev Fetch vault manager instance from central config.
     */
    function _vaultManager() internal view returns (IVaultManagerUpgradeable) {
        return IVaultManagerUpgradeable(s_config.getAddress(VAULT_KEY));
    }

    /**
     * @dev Fetch main token instance from central config
     */
    function _mainToken() internal view returns (IERC20) {
        return IERC20(s_config.getAddress(MAIN_KEY));
    }

    /**
     * @notice Fetch the information of a user in a specific pool.
     * @param user Address of the user.
     * @param poolId Identifier of the pool.
     * @return _userInfo The user’s info as stored by the VaultManager.
     */
    function getUserInfo(address user, string calldata poolId, uint256 packageId)
        external
        view
        onlyGeneralOrMasterAdmin
        returns (IVaultManagerUpgradeable.UserInfo memory _userInfo)
    {
        IVaultManagerUpgradeable vault = _vaultManager();
        _userInfo = vault.getUserInfo(user, poolId, packageId);
    }

    /**
     * @notice Fetch the information of a user in a specific pool.
     * @param user Address of the user.
     * @return _packageInfo The user’s info as stored by the VaultManager.
     */
    function getUserPackageInfo(address user, uint256 packageId)
        external
        view
        onlyGeneralOrMasterAdmin
        returns (IVaultManagerUpgradeable.PackageInfo memory _packageInfo)
    {
        IVaultManagerUpgradeable vault = _vaultManager();
        _packageInfo = vault.getUserPackageInfo(user, packageId);
    }

    /**
     * @notice Mint a new liquidity position or increase an existing one via the NonfungiblePositionManager.
     * @param poolId Identifier of the pool.
     * @param token0Address Address of token0 in the pool.
     * @param token1Address Address of token1 in the pool.
     * @param fee Fee tier of the pool.
     * @param tickLower Lower tick boundary of the position.
     * @param tickUpper Upper tick boundary of the position.
     * @param amountMainTokenDesired Desired amount of the main token to deposit.
     * @return tokenId The ID of the minted or updated position.
     */
    function mintPositionOrIncreaseLiquidity(
        string calldata poolId,
        uint256 packageId,
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountMainTokenDesired
    ) external nonReentrant onlyUser notEmergency returns (uint256 tokenId) {
        if (token0Address == address(0) || token1Address == address(0)) revert AGG_ZERO_ADDRESS();
        if (tickLower >= tickUpper) revert AGG_INVALID_TICK_RANGE();
        if (amountMainTokenDesired == 0) revert AGG_ZERO_AMOUNT();

        IVaultManagerUpgradeable vault = _vaultManager();
        IERC20 mainToken = _mainToken();

        uint256 balanceBefore = mainToken.balanceOf(address(this));
        mainToken.safeTransferFrom(msg.sender, address(this), amountMainTokenDesired);
        uint256 actualReceived = mainToken.balanceOf(address(this)) - balanceBefore;

        mainToken.safeIncreaseAllowance(address(vault), actualReceived);

        tokenId = vault.mintOrIncreaseLiquidityPosition(
            poolId, packageId, token0Address, token1Address, fee, tickLower, tickUpper, actualReceived, msg.sender
        );
    }

    /**
     * @notice Decrease or withdraw liquidity from an existing position.
     * @param poolId ID of the pool.
     * @param percentageToRemove Percentage of the position’s liquidity to remove.
     * @param code Two-factor authentication code.
     */
    function decreaseLiquidityFromPosition(string calldata poolId, uint256 packageId, uint128 percentageToRemove, string calldata code)
        public
        nonReentrant
        onlyUser
        notEmergency
    {
        s_userManager.check2FA(msg.sender, code, percentageToRemove);
        if (percentageToRemove == 0) revert AGG_ZERO_PERCENTAGE();

        uint256 bp = s_config.getUint(BP_KEY);
        if (percentageToRemove > bp) revert AGG_PERCENTAGE_TOO_HIGH();

        IVaultManagerUpgradeable vault = _vaultManager();

        vault.decreaseLiquidityPosition(msg.sender, poolId, packageId, percentageToRemove, false);
    }

    /**
     * @notice Collect the accumulated fees from a liquidity position.
     * @param poolId ID of the pool for which to collect fees.
     * @param code Two-factor authentication code.
     * @return collectedToken0 Amount of token0 collected.
     * @return collectedToken1 Amount of token1 collected.
     */
    function collectFeesFromPosition(string calldata poolId, uint256 packageId, string calldata code)
        public
        nonReentrant
        onlyUser
        notEmergency
        returns (uint256 collectedToken0, uint256 collectedToken1)
    {
        s_userManager.check2FA(msg.sender, code, 0);

        IVaultManagerUpgradeable vault = _vaultManager();

        (collectedToken0, collectedToken1) = vault.collectFees(msg.sender, poolId, packageId);
    }

    /**
     * @notice Batch-migrate the tick range of multiple positions to a new range.
     * @param users Addresses of the users who own the positions.
     * @param manager Address of the position manager.
     * @param poolId ID of the pool.
     * @param tickLower New lower tick boundary.
     * @param tickUpper New upper tick boundary.
     * @return newTokenIds Array of new position IDs created for each user.
     */
    function migratePositionBatches(
        address[] calldata users,
        address manager,
        string calldata poolId,
        uint256[] calldata packageIds,
        int24 tickLower,
        int24 tickUpper
    ) external nonReentrant onlyGeneralOrMasterAdmin notEmergency returns (uint256[] memory newTokenIds) {
        if (tickLower >= tickUpper) revert AGG_INVALID_TICK_RANGE();
        if (users.length > s_maxMigrationSize) {
            revert AGG_ARRAY_SIZE_LIMIT_EXCEEDED("users", users.length);
        }

        IVaultManagerUpgradeable vault = _vaultManager();
        uint256 n = users.length;
        newTokenIds = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            newTokenIds[i] = vault.migratePosition(users[i], manager, poolId, packageIds[i], tickLower, tickUpper);
        }
    }

    function withdrawFunds(string calldata poolId, uint256 packageId) public
        nonReentrant
        onlyUser
        notEmergency 
    {
        IVaultManagerUpgradeable vault = _vaultManager();
        vault.withdrawFunds(msg.sender, poolId, packageId);
    }
}
