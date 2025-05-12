// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./UserAccessControl.sol";
import "./errors/AggregatorErrors.sol";

import "./interfaces/IUserManagerUpgradeable.sol";
import "./interfaces/IVaultManagerUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";

/**
 * @title AggregatorUpgradeable
 * @notice This contract is responsible of interacting with the VaultManager so users can manage their liquidity positions.
 */
contract AggregatorUpgradeable is ReentrancyGuardUpgradeable, UserAccessControl, AggregatorErrors {
    IProtocolConfigUpgradeable private s_config;

    bytes32 private constant VAULT_KEY = keccak256("VaultManager");
    bytes32 private constant MAIN_KEY = keccak256("MainToken");
    bytes32 private constant BP_KEY = keccak256("BP");

    function initialize(address _protocolConfig, address _userManager) public initializer {
        __ReentrancyGuard_init();
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_userManager = IUserManagerUpgradeable(_userManager);
        s_userManagerAddress = _userManager;
    }

    /**
     * @dev Required function for UUPS upgradeable contracts.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyMasterAdmin nonReentrant {}

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
        return true;
    }

    /**
     * @notice Set the address of the new UserManager.
     * @param _newUserManagerAddress Address of the new UserManager.
     * @return True if the address was successfully updated.
     */
    function setUserManagerAddress(address _newUserManagerAddress) public onlyGeneralOrMasterAdmin returns (bool) {
        if (_newUserManagerAddress == address(0)) revert AGG_ZERO_ADDRESS();
        if (_newUserManagerAddress == s_userManagerAddress) {
            revert AGG_ADDRESS_UNCHANGED();
        }

        s_userManagerAddress = _newUserManagerAddress;
        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
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
     * @return userInformation The user’s info as stored by the VaultManager.
     */
    function getUserInfo(address user, string calldata poolId)
        external
        view
        onlyGeneralOrMasterAdmin
        returns (IVaultManagerUpgradeable.UserInfo memory userInformation)
    {
        IVaultManagerUpgradeable vault = _vaultManager();
        userInformation = vault.getUserInfo(user, poolId);
        return userInformation;
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
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountMainTokenDesired
    ) external onlyUser nonReentrant notEmergency returns (uint256 tokenId) {
        if (amountMainTokenDesired == 0) revert AGG_ZERO_AMOUNT();

        IVaultManagerUpgradeable vault = _vaultManager();
        IERC20 mainToken = _mainToken();

        if (!mainToken.transferFrom(msg.sender, address(this), amountMainTokenDesired)) revert AGG_TRANSFER_FAILED();

        if (!mainToken.approve(address(vault), amountMainTokenDesired)) {
            revert AGG_APPROVE_FAILED();
        }

        tokenId = vault.mintOrIncreaseLiquidityPosition(
            poolId, token0Address, token1Address, fee, tickLower, tickUpper, amountMainTokenDesired, msg.sender
        );
    }

    /**
     * @notice Decrease or withdraw liquidity from an existing position.
     * @param poolId ID of the pool.
     * @param percentageToRemove Percentage of the position’s liquidity to remove.
     * @param code Two-factor authentication code.
     */
    function decreaseLiquidityFromPosition(string calldata poolId, uint128 percentageToRemove, string calldata code)
        public
        onlyUser
        nonReentrant
        notEmergency
    {
        s_userManager.check2FA(msg.sender, code);
        if (percentageToRemove == 0) revert AGG_ZERO_PERCENTAGE();

        uint256 bp = s_config.getUint(BP_KEY);
        if (percentageToRemove > bp) revert AGG_PERCENTAGE_TOO_HIGH();

        IVaultManagerUpgradeable vault = _vaultManager();

        vault.decreaseLiquidityPosition(msg.sender, poolId, percentageToRemove);
    }

    /**
     * @notice Collect the accumulated fees from a liquidity position.
     * @param poolId ID of the pool for which to collect fees.
     * @param code Two-factor authentication code.
     * @return collectedToken0 Amount of token0 collected.
     * @return collectedToken1 Amount of token1 collected.
     */
    function collectFeesFromPosition(string calldata poolId, string calldata code)
        public
        onlyUser
        nonReentrant
        notEmergency
        returns (uint256 collectedToken0, uint256 collectedToken1)
    {
        s_userManager.check2FA(msg.sender, code);

        IVaultManagerUpgradeable vault = _vaultManager();

        (collectedToken0, collectedToken1) = vault.collectFees(msg.sender, poolId);
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
        int24 tickLower,
        int24 tickUpper
    ) external onlyGeneralOrMasterAdmin nonReentrant notEmergency returns (uint256[] memory newTokenIds) {
        if (tickLower >= tickUpper) revert AGG_INVALID_TICK_RANGE();

        IVaultManagerUpgradeable vault = _vaultManager();
        uint256 n = users.length;
        newTokenIds = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            newTokenIds[i] = vault.migratePosition(users[i], manager, poolId, tickLower, tickUpper);
        }

        return newTokenIds;
    }
}
