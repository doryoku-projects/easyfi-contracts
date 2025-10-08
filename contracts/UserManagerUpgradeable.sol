// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title UserManagerUpgradeable
 * @notice This contract is responsible of managing the users and their roles.
 *         It allows to add and remove users, user managers, liquidity managers, vault managers,
 *         general admins, master admins and 2FA users.
 */
contract UserManagerUpgradeable is Initializable, AccessControlEnumerableUpgradeable, UUPSUpgradeable {
    
    using ECDSA for bytes32;

    /**
     * @notice the code is invalid
     */
    error UM_INVALID_2FA_CODE();
    /**
     * @notice the code has expired
     */
    error UM_2FA_CODE_EXPIRED();
    /**
     * @notice the value has invalid
     */
    error UM_INVALID_2FA_VALUE();
    /**
     * @notice the signature has invalid
     */
    error UM_INVALID_2FA_INVALID_SIGNATURE();
    /**
     * @notice the address is not a contract or a user manager
     */
    error UM_USER_MANAGER_OR_CONTRACT();
    /**
     * @notice the address is not a general admin or a contract
     */
    error UM_GENERAL_ADMIN_OR_CONTRACT();

    /**
     * @notice the address is not a general admin or a user manager
     */
    error UM_GENERAL_ADMIN_OR_USER_MANAGER();

    /**
     * @notice This error is reverted when the maximum size of an array is exceeded.
     * @param arrayName The name of the array that exceeded the size limit.
     * @param size The size of the array that exceeded the limit.
     */
    error UM_ARRAY_SIZE_LIMIT_EXCEEDED(string arrayName, uint256 size);

    /**
     * @notice the max roles size is zero
     */
    error UM_ZERO_MAX_ROLES_SIZE();
    /**
     * @notice the address does not have the role
     */
    error UM_ROLE_DOES_NOT_EXIST(bytes32 role, address user);
    /**
     * @notice the address is not a general admin or a user manager
     */
    error UM_ROLE_ALREADY_EXIST(bytes32 role, address user);

    /**
     * @notice onlyContractOrUserManager modifier
     * @dev This modifier checks if the caller is a contract or a UserManager.
     */
    modifier onlyContractOrUserManager() {
        if (!hasRole(CONTRACT_ROLE, msg.sender) && !hasRole(USER_MANAGER_ROLE, msg.sender)) {
            revert UM_USER_MANAGER_OR_CONTRACT();
        }
        _;
    }

    /**
     * @notice onlyContractOrGeneralAdmin modifier
     * @dev This modifier checks if the caller is a contract or a GeneralAdmin.
     */
    modifier onlyContractOrGeneralAdmin() {
        if (!hasRole(CONTRACT_ROLE, msg.sender) && !hasRole(GENERAL_ADMIN_ROLE, msg.sender)) {
            revert UM_GENERAL_ADMIN_OR_CONTRACT();
        }
        _;
    }

    /**
     * @notice onlyGeneralAdminOrUserManager modifier
     * @dev This modifier checks if the caller is a GeneralAdmin or a UserManager.
     */
    modifier onlyGeneralAdminOrUserManager() {
        if (!hasRole(GENERAL_ADMIN_ROLE, msg.sender) && !hasRole(USER_MANAGER_ROLE, msg.sender)) {
            revert UM_GENERAL_ADMIN_OR_USER_MANAGER();
        }
        _;
    }

    bytes32 private constant USER_ROLE = keccak256("USER_ROLE");
    bytes32 private constant USER_MANAGER_ROLE = keccak256("USER_MANAGER_ROLE");
    bytes32 private constant USER_2FA_ROLE = keccak256("USER_2FA_ROLE");
    bytes32 private constant GENERAL_ADMIN_ROLE = keccak256("GENERAL_ADMIN_ROLE");
    bytes32 private constant MASTER_ADMIN_ROLE = keccak256("MASTER_ADMIN_ROLE");
    bytes32 private constant LIQUIDITY_MANAGER_ROLE = keccak256("LIQUIDITY_MANAGER_ROLE");
    bytes32 private constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    bytes32 private constant CONTRACT_ROLE = keccak256("CONTRACT_ROLE");

    uint256 private s_maxRolesSize;

    bool private s_emergency;

    struct User2FA {
        string code;
        uint256 timestamp;
        uint256 value;
        bytes signature;
    }

    mapping(address => User2FA) private s_user2FA;

    event UserAdded(address indexed user);
    event UserRemoved(address indexed user);
    event UserManagerAdded(address indexed user);
    event UserManagerRemoved(address indexed user);
    event LiquidityManagerAdded(address indexed user);
    event LiquidityManagerRemoved(address indexed user);
    event GeneralAdminAdded(address indexed user);
    event GeneralAdminRemoved(address indexed user);
    event MasterAdminAdded(address indexed user);
    event MasterAdminRemoved(address indexed user);
    event VaultManagerAdded(address indexed user);
    event VaultManagerRemoved(address indexed user);
    event ContractAdded(address indexed user);
    event ContractRemoved(address indexed user);
    event User2FAAdded(address indexed user);
    event User2FARemoved(address indexed user);
    event EmergencyModeActivated(bool indexed emergency);
    event EmergencyModeDeactivated(bool indexed emergency);
    event MaxRolesSizeUpdated(uint256 indexed newMaxRolesSize);
    event Code2FAUpdated(address indexed user);

    /**
     * @notice Initialize the UserManager contract, granting initial roles.
     * @param _initialAdmins Array of addresses to grant GENERAL_ADMIN_ROLE.
     * @param _initialUserManagers Array of addresses to grant USER_MANAGER_ROLE.
     * @param _2FAManagers Array of addresses to grant USER_2FA_ROLE.
     */
    function initialize(
        address[] calldata _initialAdmins,
        address[] calldata _initialUserManagers,
        address[] calldata _2FAManagers,
        address[] calldata _initialContracts,
        uint256 _maxRolesSize
    ) public initializer {
        __AccessControlEnumerable_init();
        __UUPSUpgradeable_init();

        _grantRole(MASTER_ADMIN_ROLE, _msgSender());

        s_maxRolesSize = _maxRolesSize;

        _checkArraySizeLimit("initialUserManagers", _initialUserManagers.length);
        _checkArraySizeLimit("initialAdmins", _initialAdmins.length);
        _checkArraySizeLimit("initial2FAManagers", _2FAManagers.length);
        _checkArraySizeLimit("initialContracts", _initialContracts.length);

        for (uint256 i = 0; i < _initialUserManagers.length; i++) {
            _grantRole(USER_MANAGER_ROLE, _initialUserManagers[i]);
            emit UserManagerAdded(_initialUserManagers[i]);
        }

        for (uint256 i = 0; i < _initialAdmins.length; i++) {
            _grantRole(GENERAL_ADMIN_ROLE, _initialAdmins[i]);
            emit GeneralAdminAdded(_initialAdmins[i]);
        }

        for (uint256 i = 0; i < _2FAManagers.length; i++) {
            _grantRole(USER_2FA_ROLE, _2FAManagers[i]);
            emit User2FAAdded(_2FAManagers[i]);
        }

        for (uint256 i = 0; i < _initialContracts.length; i++) {
            _grantRole(CONTRACT_ROLE, _initialContracts[i]);
            emit ContractAdded(_initialContracts[i]);
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Required UUPS authorization hook; only callable by MASTER_ADMIN_ROLE.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(MASTER_ADMIN_ROLE) {}

    /**
     * @dev Check if the array size is within the limit.
     * @param _arrayName Name of the array to check.
     * @param _size Size of the array to check.
     */
    function _checkArraySizeLimit(string memory _arrayName, uint256 _size) internal view {
        if (_size > s_maxRolesSize) {
            revert UM_ARRAY_SIZE_LIMIT_EXCEEDED(_arrayName, _size);
        }
    }

    /**
     * @dev Check if the user has the role or not.
     * @param _role Role to check.
     * @param _user User to check.
     * @param _checkIfHasRole If true, checks if the user has the role, otherwise checks if the user does not have the role.
     */
    function _checkRole(bytes32 _role, address _user, bool _checkIfHasRole) internal view {
        // if _checkIfHasRole is true, checks if the user has the role, 
        // otherwise checks if the user does not have the role.
        if (_checkIfHasRole){
            if (hasRole(_role, _user)) revert UM_ROLE_ALREADY_EXIST(_role, _user);
        } else {
            if (!hasRole(_role, _user)) revert UM_ROLE_DOES_NOT_EXIST(_role, _user);
        }
    }

    /**
     * @notice setMaxRolesSize
     * @dev This function sets the maximum size of the roles in a batch.
     */
    function setMaxRolesSize(uint256 _maxRolesSize) external onlyRole(MASTER_ADMIN_ROLE) {
        if (_maxRolesSize == 0) revert UM_ZERO_MAX_ROLES_SIZE();
        s_maxRolesSize = _maxRolesSize;
        emit MaxRolesSizeUpdated(_maxRolesSize);
    }

    /**
     * @notice setEmergency function
     * @dev This function sets the emergency mode.
     * @param _emergency The emergency mode status.
     */
    function setEmergency(bool _emergency) external onlyRole(MASTER_ADMIN_ROLE) {
        s_emergency = _emergency;
        if (_emergency) {
            emit EmergencyModeActivated(_emergency);
        } else {
            emit EmergencyModeDeactivated(_emergency);
        }
    }

    /**
     * @notice isEmergency function
     * @dev This function checks if the contract is in emergency mode
     */
    function isEmergency() external view onlyContractOrGeneralAdmin returns (bool) {
        return s_emergency;
    }

    /**
     * @notice Returns all members that have the specified role
     * @dev This function wraps the parent implementation and adds access control
     * @param role The role to query members for
     * @return An array of addresses that have the specified role
     */
    function getRoleMembers(bytes32 role)
        public
        view
        override
        onlyGeneralAdminOrUserManager
        returns (address[] memory)
    {
        return super.getRoleMembers(role);
    }

    /*-------USERS-------*/

    /**
     * @notice Grant USER_ROLE to a batch of addresses.
     * @param users Array of user addresses to add.
     * @return True if operation succeeded.
     */
    function addUsers(address[] calldata users) external onlyRole(USER_MANAGER_ROLE) returns (bool) {
        _checkArraySizeLimit("users", users.length);
        for (uint256 i = 0; i < users.length; i++) {
            _checkRole(USER_ROLE, users[i], true);
            _grantRole(USER_ROLE, users[i]);
            emit UserAdded(users[i]);
        }
        return true;
    }

    /**
     * @notice Revoke USER_ROLE from a batch of addresses.
     * @param users Array of user addresses to remove.
     * @return True if operation succeeded.
     */
    function removeUsers(address[] calldata users) external onlyRole(USER_MANAGER_ROLE) returns (bool) {
        _checkArraySizeLimit("users", users.length);
        for (uint256 i = 0; i < users.length; i++) {
            _checkRole(USER_ROLE, users[i], false);
            _revokeRole(USER_ROLE, users[i]);
            emit UserRemoved(users[i]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has USER_ROLE.
     * @param user Address to query.
     * @return True if the address holds USER_ROLE.
     */
    function isUser(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(USER_ROLE, user);
    }

    /*-------USER_MANAGERS-------*/

    /**
     * @notice Grant USER_MANAGER_ROLE to a batch of addresses.
     * @param usersManager Array of addresses to add as user managers.
     * @return True if operation succeeded.
     */
    function addUsersManager(address[] calldata usersManager) external onlyRole(USER_MANAGER_ROLE) returns (bool) {
        _checkArraySizeLimit("usersManager", usersManager.length);
        for (uint256 i = 0; i < usersManager.length; i++) {
            _checkRole(USER_MANAGER_ROLE, usersManager[i], true);
            _grantRole(USER_MANAGER_ROLE, usersManager[i]);
            emit UserManagerAdded(usersManager[i]);
        }
        return true;
    }

    /**
     * @notice Revoke USER_MANAGER_ROLE from a batch of addresses.
     * @param usersManager Array of addresses to remove as user managers.
     * @return True if operation succeeded.
     */
    function removeUsersManager(address[] calldata usersManager) external onlyRole(USER_MANAGER_ROLE) returns (bool) {
        _checkArraySizeLimit("usersManager", usersManager.length);
        for (uint256 i = 0; i < usersManager.length; i++) {
            _checkRole(USER_MANAGER_ROLE, usersManager[i], false);
            _revokeRole(USER_MANAGER_ROLE, usersManager[i]);
            emit UserManagerRemoved(usersManager[i]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has USER_MANAGER_ROLE.
     * @param user Address to query.
     * @return True if the address holds USER_MANAGER_ROLE.
     */
    function isUserManager(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(USER_MANAGER_ROLE, user);
    }

    /*-------LIQUIDITY_MANAGERS-------*/

    /**
     * @notice Grant LIQUIDITY_MANAGER_ROLE to a batch of addresses.
     * @param liquidityManagers Array of addresses to add as liquidity managers.
     * @return True if operation succeeded.
     */
    function addLiquidityManagers(address[] calldata liquidityManagers)
        external
        onlyRole(GENERAL_ADMIN_ROLE)
        returns (bool)
    {
        _checkArraySizeLimit("liquidityManagers", liquidityManagers.length);
        for (uint256 index = 0; index < liquidityManagers.length; index++) {
            _checkRole(LIQUIDITY_MANAGER_ROLE, liquidityManagers[index], true);
            _grantRole(LIQUIDITY_MANAGER_ROLE, liquidityManagers[index]);
            emit LiquidityManagerAdded(liquidityManagers[index]);
        }
        return true;
    }

    /**
     * @notice Revoke LIQUIDITY_MANAGER_ROLE from a batch of addresses.
     * @param liquidityManagers Array of addresses to remove as liquidity managers.
     * @return True if operation succeeded.
     */
    function removeLiquidityManagers(address[] calldata liquidityManagers)
        external
        onlyRole(GENERAL_ADMIN_ROLE)
        returns (bool)
    {
        _checkArraySizeLimit("liquidityManagers", liquidityManagers.length);
        for (uint256 index = 0; index < liquidityManagers.length; index++) {
            _checkRole(LIQUIDITY_MANAGER_ROLE, liquidityManagers[index], false);
            _revokeRole(LIQUIDITY_MANAGER_ROLE, liquidityManagers[index]);
            emit LiquidityManagerRemoved(liquidityManagers[index]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has LIQUIDITY_MANAGER_ROLE.
     * @param user Address to query.
     * @return True if the address holds LIQUIDITY_MANAGER_ROLE.
     */
    function isLiquidityManager(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(LIQUIDITY_MANAGER_ROLE, user);
    }

    /*-------VAULT_MANAGERS-------*/

    /**
     * @notice Grant VAULT_MANAGER_ROLE to a batch of addresses.
     * @param vaultManagers Array of addresses to add as vault managers.
     * @return True if operation succeeded.
     */
    function addVaultManagers(address[] calldata vaultManagers) external onlyRole(GENERAL_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("vaultManagers", vaultManagers.length);
        for (uint256 index = 0; index < vaultManagers.length; index++) {
            _checkRole(VAULT_MANAGER_ROLE, vaultManagers[index], true);
            _grantRole(VAULT_MANAGER_ROLE, vaultManagers[index]);
            emit VaultManagerAdded(vaultManagers[index]);
        }
        return true;
    }

    /**
     * @notice Revoke VAULT_MANAGER_ROLE from a batch of addresses.
     * @param vaultManagers Array of addresses to remove as vault managers.
     * @return True if operation succeeded.
     */
    function removeVaultManagers(address[] calldata vaultManagers)
        external
        onlyRole(GENERAL_ADMIN_ROLE)
        returns (bool)
    {
        _checkArraySizeLimit("vaultManagers", vaultManagers.length);
        for (uint256 index = 0; index < vaultManagers.length; index++) {
            _checkRole(VAULT_MANAGER_ROLE, vaultManagers[index], false);
            _revokeRole(VAULT_MANAGER_ROLE, vaultManagers[index]);
            emit VaultManagerRemoved(vaultManagers[index]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has VAULT_MANAGER_ROLE.
     * @param user Address to query.
     * @return True if the address holds VAULT_MANAGER_ROLE.
     */
    function isVaultManager(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(VAULT_MANAGER_ROLE, user);
    }

    /*-------USER_2FA-------*/

    /**
     * @notice Grant USER_2FA_ROLE to a batch of addresses.
     * @param users2FA Array of addresses to add to 2FA role.
     * @return True if operation succeeded.
     */
    function addUser2FAs(address[] calldata users2FA) external onlyRole(GENERAL_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("users2FA", users2FA.length);
        for (uint256 index = 0; index < users2FA.length; index++) {
            _checkRole(USER_2FA_ROLE, users2FA[index], true);
            _grantRole(USER_2FA_ROLE, users2FA[index]);
            emit User2FAAdded(users2FA[index]);
        }
        return true;
    }

    /**
     * @notice Revoke USER_2FA_ROLE from a batch of addresses.
     * @param users2FA Array of addresses to remove from 2FA role.
     * @return True if operation succeeded.
     */
    function removeUser2FAs(address[] calldata users2FA) external onlyRole(GENERAL_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("users2FA", users2FA.length);
        for (uint256 index = 0; index < users2FA.length; index++) {
            _checkRole(USER_2FA_ROLE, users2FA[index], false);
            _revokeRole(USER_2FA_ROLE, users2FA[index]);
            emit User2FARemoved(users2FA[index]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has USER_2FA_ROLE.
     * @param user Address to query.
     * @return True if the address holds USER_2FA_ROLE.
     */
    function is2FA(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(USER_2FA_ROLE, user);
    }

    /*-------CONTRACTS-------*/
    /**
     * @notice Grant CONTRACT_ROLE to a batch of addresses.
     * @param contracts Array of addresses to add as contracts.
     * @return True if operation succeeded.
     */
    function addContracts(address[] calldata contracts) external onlyRole(GENERAL_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("contracts", contracts.length);
        for (uint256 index = 0; index < contracts.length; index++) {
            _checkRole(CONTRACT_ROLE, contracts[index], true);
            _grantRole(CONTRACT_ROLE, contracts[index]);
            emit ContractAdded(contracts[index]);
        }
        return true;
    }

    /**
     * @notice Revoke CONTRACT_ROLE from a batch of addresses.
     * @param contracts Array of addresses to remove as contracts.
     * @return True if operation succeeded.
     */
    function removeContracts(address[] calldata contracts) external onlyRole(GENERAL_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("contracts", contracts.length);
        for (uint256 index = 0; index < contracts.length; index++) {
            _checkRole(CONTRACT_ROLE, contracts[index], false);
            _revokeRole(CONTRACT_ROLE, contracts[index]);
            emit ContractRemoved(contracts[index]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has CONTRACT_ROLE.
     * @param user Address to query.
     * @return True if the address holds CONTRACT_ROLE.
     */
    function isContract(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(CONTRACT_ROLE, user);
    }

    /*-------GENERAL_ADMINS-------*/

    /**
     * @notice Grant GENERAL_ADMIN_ROLE to a batch of addresses.
     * @param generalAdmins Array of addresses to add as general admins.
     * @return True if operation succeeded.
     */
    function addGeneralAdmins(address[] calldata generalAdmins) external onlyRole(GENERAL_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("generalAdmins", generalAdmins.length);
        for (uint256 i = 0; i < generalAdmins.length; i++) {
            _checkRole(GENERAL_ADMIN_ROLE, generalAdmins[i], true);
            _grantRole(GENERAL_ADMIN_ROLE, generalAdmins[i]);
            emit GeneralAdminAdded(generalAdmins[i]);
        }
        return true;
    }

    /**
     * @notice Revoke GENERAL_ADMIN_ROLE from a batch of addresses.
     * @param generalAdmins Array of addresses to remove as general admins.
     * @return True if operation succeeded.
     */
    function removeGeneralAdmins(address[] calldata generalAdmins)
        external
        onlyRole(GENERAL_ADMIN_ROLE)
        returns (bool)
    {
        _checkArraySizeLimit("generalAdmins", generalAdmins.length);
        for (uint256 index = 0; index < generalAdmins.length; index++) {
            _checkRole(GENERAL_ADMIN_ROLE, generalAdmins[index], false);
            _revokeRole(GENERAL_ADMIN_ROLE, generalAdmins[index]);
            emit GeneralAdminRemoved(generalAdmins[index]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has GENERAL_ADMIN_ROLE.
     * @param user Address to query.
     * @return True if the address holds GENERAL_ADMIN_ROLE.
     */
    function isGeneralAdmin(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(GENERAL_ADMIN_ROLE, user);
    }

    /*-------MASTER_ADMINS-------*/

    /**
     * @notice Grant MASTER_ADMIN_ROLE to a batch of addresses.
     * @param masterAdmins Array of addresses to add as master admins.
     * @return True if operation succeeded.
     */
    function addMasterAdmins(address[] calldata masterAdmins) external onlyRole(MASTER_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("masterAdmins", masterAdmins.length);
        for (uint256 index = 0; index < masterAdmins.length; index++) {
            _checkRole(MASTER_ADMIN_ROLE, masterAdmins[index], true);
            _grantRole(MASTER_ADMIN_ROLE, masterAdmins[index]);
            emit MasterAdminAdded(masterAdmins[index]);
        }
        return true;
    }

    /**
     * @notice Revoke MASTER_ADMIN_ROLE from a batch of addresses.
     * @param masterAdmins Array of addresses to remove as master admins.
     * @return True if operation succeeded.
     */
    function removeMasterAdmins(address[] calldata masterAdmins) external onlyRole(MASTER_ADMIN_ROLE) returns (bool) {
        _checkArraySizeLimit("masterAdmins", masterAdmins.length);
        for (uint256 index = 0; index < masterAdmins.length; index++) {
            _checkRole(MASTER_ADMIN_ROLE, masterAdmins[index], false);
            _revokeRole(MASTER_ADMIN_ROLE, masterAdmins[index]);
            emit MasterAdminRemoved(masterAdmins[index]);
        }
        return true;
    }

    /**
     * @notice Check whether an address has MASTER_ADMIN_ROLE.
     * @param user Address to query.
     * @return True if the address holds MASTER_ADMIN_ROLE.
     */
    function isMasterAdmin(address user) external view onlyContractOrUserManager returns (bool) {
        return hasRole(MASTER_ADMIN_ROLE, user);
    }

    /**
     * @notice Sets a 2FA code for the specified user.
     * @dev Function can only be called by an account with USER_2FA_ROLE.
     * @param user The address of the user for which the 2FA code is being set.
     * @param code The 2FA code to associate with the user.
     * @param expiredTime The timestamp until which the 2FA code is valid.
     * @param value The expected value associated with this 2FA code.
     * @param signature The signature verifying this 2FA setup.
     */
    function set2FA(address user, string calldata code, uint256 expiredTime, uint256 value, bytes calldata signature) external onlyRole(USER_2FA_ROLE) {
        User2FA storage user2FAInfo = s_user2FA[user];
        
        user2FAInfo.code = code;
        user2FAInfo.timestamp = expiredTime;       
        user2FAInfo.value = value;
        user2FAInfo.signature = signature;
        emit Code2FAUpdated(user);
    }

    /**
     * @notice Validates the provided 2FA code for a user.
     * @dev Function is restricted to callers with USER_MANAGER_ROLEor approved contracts.
     * It checks that the supplied 2FA code matches the stored code and that it has not expired (i.e., within 5 minutes of issuance).
     * @param user The address of the user whose 2FA code is being verified.
     * @param code The 2FA code to validate.
     * @param value The expected value tied to the 2FA verification.
     */
    function check2FA(address user, string calldata code, uint256 value) external onlyContractOrUserManager {
        User2FA memory user2FAInfo = s_user2FA[user];

        bytes32 messageHash = keccak256(abi.encodePacked(user, block.chainid, address(this), user2FAInfo.value, user2FAInfo.timestamp));

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        if (ECDSA.recover(ethSignedMessageHash, user2FAInfo.signature) != user) {
            revert UM_INVALID_2FA_INVALID_SIGNATURE();
        }

        if (keccak256(abi.encode(user2FAInfo.code)) != keccak256(abi.encode(code))) {
            revert UM_INVALID_2FA_CODE();
        }

        if (user2FAInfo.timestamp < block.timestamp) {
            revert UM_2FA_CODE_EXPIRED();
        }
        if (user2FAInfo.value != value) {
            revert UM_INVALID_2FA_VALUE();
        }
        s_user2FA[user].timestamp = 0;
    }
}
