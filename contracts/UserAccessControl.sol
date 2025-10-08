// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./errors/AccessControlErrors.sol";

import "./interfaces/IUserManagerUpgradeable.sol";

/**
 * @title UserAccessControl
 * @notice This contract is responsible for managing user access control.
 */
abstract contract UserAccessControl is UUPSUpgradeable, AccessControlErrors {
    IUserManagerUpgradeable internal s_userManager;

    /**
     * @notice onlyUser modifier
     * @dev This modifier checks if the caller is a user.
     */
    modifier onlyUser() {
        if (!s_userManager.isUser(msg.sender)) revert UAC_NOT_USER();
        _;
    }

    /**
     * @notice onlyUserManager modifier
     * @dev This modifier checks if the caller is a user manager.
     */
    modifier onlyUserManager() {
        if (!s_userManager.isUserManager(msg.sender)) {
            revert UAC_NOT_USER_MANAGER();
        }
        _;
    }

    /**
     * @notice onlyGeneralAdmin modifier
     * @dev This modifier checks if the caller is a general admin.
     */
    modifier onlyGeneralAdmin() {
        if (!s_userManager.isGeneralAdmin(msg.sender)) {
            revert UAC_NOT_GENERAL_ADMIN();
        }
        _;
    }

    /**
     * @notice onlyLiquidityManager modifier
     * @dev This modifier checks if the caller is a liquidity manager.
     */
    modifier onlyLiquidityManager() {
        if (!s_userManager.isLiquidityManager(msg.sender)) {
            revert UAC_NOT_LIQUIDITY_MANAGER();
        }
        _;
    }

    /**
     * @notice onlyVaultManager modifier
     * @dev This modifier checks if the caller is a vault manager.
     */
    modifier onlyVaultManager() {
        if (!s_userManager.isVaultManager(msg.sender)) {
            revert UAC_NOT_VAULT_MANAGER();
        }
        _;
    }

    /**
     * @notice onlyMasterAdmin modifier
     * @dev This modifier checks if the caller is a master admin.
     */
    modifier onlyMasterAdmin() {
        if (!s_userManager.isMasterAdmin(msg.sender)) {
            revert UAC_NOT_MASTER_ADMIN();
        }
        _;
    }

    /**
     * @notice only2FA modifier
     * @dev This modifier checks if the caller has 2FA enabled.
     */
    modifier only2FA() {
        if (!s_userManager.is2FA(msg.sender)) revert UAC_NOT_2FA();
        _;
    }

    /**
     * @notice only2FA modifier
     * @dev This modifier checks if the caller has 2FA enabled.
     */
    modifier onlyGeneralOrMasterAdmin() {
        if (!(s_userManager.isGeneralAdmin(msg.sender) || s_userManager.isMasterAdmin(msg.sender))) {
            revert UAC_NOT_GENERAL_OR_MASTER_ADMIN();
        }
        _;
    }

    /**
     * @notice onlyUserManagerOrGeneralAdmin modifier
     * @dev This modifier checks if the caller is a user manager or a general admin.
     */
    modifier onlyUserManagerOrGeneralAdmin() {
        if (!(s_userManager.isUserManager(msg.sender) || s_userManager.isGeneralAdmin(msg.sender))) {
            revert UAC_NOT_USER_MANAGER_OR_GENERAL_ADMIN();
        }
        _;
    }

    /**
     * @notice onlyVaultOrLiquidityManager modifier
     * @dev This modifier checks if the caller is a vault manager or a liquidity manager.
     */
    modifier onlyVaultOrLiquidityManager() {
        if (!(s_userManager.isVaultManager(msg.sender) || s_userManager.isLiquidityManager(msg.sender))) {
            revert UAC_NOT_VAULT_OR_LIQUIDITY_MANAGER();
        }
        _;
    }

    /**
     * @notice notEmergency modifier
     * @dev This modifier checks if the contract is not in emergency mode.
     */
    modifier notEmergency() {
        if (s_userManager.isEmergency()) revert UAC_EMERGENCY_MODE_ACTIVE();
        _;
    }
    /**
     * @notice notEmergency modifier
     * @dev This modifier checks if the contract is in emergency mode.
     */
    modifier onlyEmergency() {
        if (!s_userManager.isEmergency()) revert UAC_NOT_IN_EMERGENCY_MODE();
        _;
    }
}
