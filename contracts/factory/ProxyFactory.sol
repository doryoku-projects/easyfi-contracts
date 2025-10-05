// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;


import { CREATE3 } from "solady/src/utils/CREATE3.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ProxyFactory is AccessControl {

    bytes32 private constant GENERAL_ADMIN_ROLE = keccak256("GENERAL_ADMIN_ROLE");

    event GeneralAdminAdded(address indexed user);
    event ProxyDeployed(address indexed proxyAddress, address indexed admin);

    constructor(address[] memory _initialAdmins) {
        for (uint256 i = 0; i < _initialAdmins.length; i++) {
            _grantRole(GENERAL_ADMIN_ROLE, _initialAdmins[i]);
            emit GeneralAdminAdded(_initialAdmins[i]);
        }
    }

    function deploy(
        address implementation,
        bytes memory initializer,
        bytes32 salt
    ) external onlyRole(GENERAL_ADMIN_ROLE) returns (address deployedAddress) {

        bytes memory proxyCreationCode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,  // Proxy bytecode
            abi.encode(implementation, initializer)  // Constructor args
        );
        deployedAddress = CREATE3.deploy(salt, proxyCreationCode, 0);
        emit ProxyDeployed(deployedAddress, address(0));
    }

    function getDeployed(bytes32 salt) external view returns (address deployed) {
        deployed = CREATE3.getDeployed(salt);
    }
}

interface IAccessControl {
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
}