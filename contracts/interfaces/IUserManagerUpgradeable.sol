// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Interface for the UserManager contract, which manages user roles and permissions in a DeFi protocol.
interface IUserManagerUpgradeable {
    struct User2FA {
        string code;
        uint256 timestamp;
        uint256 value;
        bytes signature;
    }

    function user2FA(address user) external view returns (uint32, uint256);

    function oracleAddress2FA() external view returns (address);

    function addUsers(address[] calldata users) external returns (bool);

    function removeUsers(address[] calldata users) external returns (bool);

    function isUser(address user) external view returns (bool);

    function addUsersManager(address[] calldata usersManager) external returns (bool);

    function removeUsersManager(address[] calldata usersManager) external returns (bool);

    function isUserManager(address user) external view returns (bool);

    function addLiquidityManagers(address[] calldata liquidityManagers) external returns (bool);

    function removeLiquidityManagers(address[] calldata liquidityManagers) external returns (bool);

    function isLiquidityManager(address user) external view returns (bool);

    function addVaultManagers(address[] calldata vaultManagers) external returns (bool);

    function removeVaultManagers(address[] calldata vaultManagers) external returns (bool);

    function isVaultManager(address user) external view returns (bool);

    function addMasterAdmins(address[] calldata masterAdmins) external returns (bool);

    function removeMasterAdmins(address[] calldata masterAdmins) external returns (bool);

    function isMasterAdmin(address user) external view returns (bool);

    function addGeneralAdmins(address[] calldata generalAdmins) external returns (bool);

    function removeGeneralAdmins(address[] calldata generalAdmins) external returns (bool);

    function isGeneralAdmin(address user) external view returns (bool);

    function addUser2FAs(address[] calldata users2FA) external returns (bool);

    function removeUser2FAs(address[] calldata users2FA) external returns (bool);

    function is2FA(address user) external view returns (bool);

    function set2FA(address user, string calldata code) external;

    function check2FA(address user, string calldata code, uint256 value) external;

    function isEmergency() external view returns (bool);
}
