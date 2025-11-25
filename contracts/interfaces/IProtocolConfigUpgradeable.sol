// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Interface for the ProtocolConfig contract, which manages protocol configuration settings.
interface IProtocolConfigUpgradeable {
    struct CapInfo {
        uint256 liquidityCap;
        uint256 feeCap;
        uint256 userFeesPct;
        uint256 expiryTime;
    }

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

    function getPackageCap(uint256 packageId) external view returns (CapInfo memory);

    function setPackageCap( uint256 _liquidityCap, uint256 _feeCap, uint256 _userFeesPct) external;

    function updatePackageCap ( uint256 packageId, uint256 _liquidityCap, uint256 _feeCap, uint256 _userFeesPct) external;

}
