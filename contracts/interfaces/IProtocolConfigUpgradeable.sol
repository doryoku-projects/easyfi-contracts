// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Interface for the ProtocolConfig contract, which manages protocol configuration settings.
interface IProtocolConfigUpgradeable {
    function initialize(
        address _userManager,
        bytes32[] calldata addressKeys,
        address[] calldata addressValues,
        bytes32[] calldata uintKeys,
        uint256[] calldata uintValues
    ) external;

    function setAddress(bytes32 key, address newVal) external;

    function setUint(bytes32 key, uint256 newVal) external;

    function getAddress(bytes32 key) external view returns (address);

    function getUint(bytes32 key) external view returns (uint256);

  
}
