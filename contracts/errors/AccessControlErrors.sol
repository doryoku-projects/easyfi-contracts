// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract AccessControlErrors {
    /**
     * @notice caller is not a user
     */
    error UAC_NOT_USER();
    /**
     * @notice caller is not a user manager
     */
    error UAC_NOT_USER_MANAGER();
    /**
     * @notice caller is not a general admin
     */
    error UAC_NOT_GENERAL_ADMIN();
    /**
     * @notice caller is not a liquidity manager
     */
    error UAC_NOT_LIQUIDITY_MANAGER();
    /**
     * @notice caller is not a vault manager
     */
    error UAC_NOT_VAULT_MANAGER();
    /**
     * @notice caller is not a master admin
     */
    error UAC_NOT_MASTER_ADMIN();
    /**
     * @notice caller does not have 2FA role
     */
    error UAC_NOT_2FA();
    /**
     * @notice caller is neither general nor master admin
     */
    error UAC_NOT_GENERAL_OR_MASTER_ADMIN();
    /**
     * @notice caller is neither user manager nor general admin
     */
    error UAC_NOT_USER_MANAGER_OR_GENERAL_ADMIN();

    /**
     * @notice caller is neither vault manager nor liquidity manager
     */
    error UAC_NOT_VAULT_OR_LIQUIDITY_MANAGER();
    /**
     * @notice contract is in emergency mode
     */
    error UAC_EMERGENCY_MODE_ACTIVE();
}
