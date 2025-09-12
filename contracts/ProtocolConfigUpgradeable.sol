// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./UserAccessControl.sol";
import "./errors/ProtocolConfigErrors.sol";

/**
 * @title ProtocolConfigUpgradeable
 * @notice Centralized storage for all protocol-wide addresses and numeric parameters.
 */
contract ProtocolConfigUpgradeable is UserAccessControl, ProtocolConfigErrors {

    struct CapInfo {
        uint256 liquidityCap;
        uint256 feeCap;
        uint256 userFeesPct;
    }

    uint256 private s_packageCounter;

    mapping(bytes32 => address) private s_addresses;
    mapping(bytes32 => uint256) private s_uints;
    mapping(uint256 => CapInfo) private s_packageCap;

    event ConfigAddressUpdated(bytes32 indexed key, address oldAddr, address newAddr);
    event ConfigUintUpdated(bytes32 indexed key, uint256 oldValue, uint256 newValue);
    event UserManagerSet();
    event PackageCreated(uint256 indexed packageId, uint256 liquidityCap, uint256 feeCap, uint256 userFeesPct);
    event PackageUpdated(uint256 indexed packageId, uint256 liquidityCap, uint256 feeCap, uint256 userFeesPct);


    /**
     * @notice Initialize all config entries in batch
     * @param _userManager Address of the UserManager (handles role checks)
     * @param addressKeys Keys for address-type config entries
     * @param addressValues Corresponding address values
     * @param uintKeys Keys for uint-type config entries
     * @param uintValues Corresponding uint256 values
     */
    function initialize(
        address _userManager,
        bytes32[] calldata addressKeys,
        address[] calldata addressValues,
        bytes32[] calldata uintKeys,
        uint256[] calldata uintValues
    ) public initializer {
        if(_userManager == address(0)) revert PC_ZERO_ADDRESS();
        __UUPSUpgradeable_init();
        
        if (addressKeys.length == 0) revert PC_ZERO_ADDRESS();
        if (uintKeys.length == 0) revert PC_ZERO_ADDRESS();
        if (addressKeys.length != addressValues.length) revert PC_ARRAY_LEN_MISMATCH();
        if (uintKeys.length != uintValues.length) revert PC_ARRAY_LEN_MISMATCH();

        s_userManager = IUserManagerUpgradeable(_userManager);

        for (uint256 i = 0; i < addressKeys.length; i++) {
            if (addressValues[i] == address(0)) revert PC_ZERO_ADDRESS();
            _setAddress(addressKeys[i], addressValues[i]);
        }

        for (uint256 i = 0; i < uintKeys.length; i++) {
            _setUint(uintKeys[i], uintValues[i]);
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address) internal override onlyMasterAdmin {}

    /**
     * @notice Set the address of the new UserManager.
     * @param _newUserManagerAddress Address of the new UserManager.
     */
    function setUserManagerAddress(address _newUserManagerAddress) public onlyGeneralOrMasterAdmin returns (bool) {
        if (_newUserManagerAddress == address(0)) revert PC_ZERO_ADDRESS();
        if (_newUserManagerAddress == address(s_userManager)) {
            revert PC_ADDRESS_UNCHANGED();
        }

        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
        emit UserManagerSet();
        return true;
    }

    function setAddress(bytes32 key, address newVal) external onlyGeneralOrMasterAdmin {
        _setAddress(key, newVal);
    }

    function _setAddress(bytes32 key, address newVal) private {
        if (newVal == address(0)) revert PC_ZERO_ADDRESS();
        address old = s_addresses[key];
        if (old == newVal) revert PC_ADDRESS_UNCHANGED();
        s_addresses[key] = newVal;
        emit ConfigAddressUpdated(key, old, newVal);
    }

    function setUint(bytes32 key, uint256 newVal) external onlyGeneralOrMasterAdmin {
        _setUint(key, newVal);
    }

    function _setUint(bytes32 key, uint256 newVal) private {
        if (newVal == 0) revert PC_INVALID_UINT();
        uint256 old = s_uints[key];
        if (old == newVal) revert PC_UINT_UNCHANGED();
        s_uints[key] = newVal;
        emit ConfigUintUpdated(key, old, newVal);
    }

    function getAddress(bytes32 key) external view onlyVaultOrLiquidityManager returns (address) {
        address val = s_addresses[key];
        if (val == address(0)) revert PC_ADDRESS_NOT_SET();
        return val;
    }

    function getUint(bytes32 key) external view onlyVaultOrLiquidityManager returns (uint256) {
        uint256 val = s_uints[key];
        if (val == 0) revert PC_UINT_NOT_SET();
        return val;
    }

    function setPackageCap(
        uint256 _liquidityCap,
        uint256 _feeCap,
        uint256 _userFeesPct
    ) external onlyVaultOrLiquidityManager {
        s_packageCounter++;
        uint256 packageId = s_packageCounter;

        CapInfo storage capInfo = s_packageCap[packageId];

        capInfo.liquidityCap = _liquidityCap;
        capInfo.feeCap = _feeCap;
        capInfo.userFeesPct = _userFeesPct;
        emit PackageCreated(packageId, _liquidityCap, _feeCap, _userFeesPct);
    }

    function updatePackageCap(
        uint256 packageId,
        uint256 _liquidityCap,
        uint256 _feeCap,
        uint256 _userFeesPct
    ) external onlyVaultOrLiquidityManager {
        CapInfo storage capInfo = s_packageCap[packageId];
        if (capInfo.liquidityCap == 0 && capInfo.feeCap == 0) {
            revert PACKAGE_NOT_EXIST();
        }
        if (capInfo.liquidityCap == _liquidityCap && capInfo.feeCap == _feeCap) {
            revert ALREADY_PACKAGE_ID_INFO_UPDATED();
        }
        capInfo.liquidityCap = _liquidityCap;
        capInfo.feeCap = _feeCap;
        capInfo.userFeesPct = _userFeesPct;
        emit PackageUpdated(packageId, _liquidityCap, _feeCap, _userFeesPct);
    }

    function getPackageCap(uint256 packageId) external onlyVaultOrLiquidityManager view returns (CapInfo memory) {
        return s_packageCap[packageId];
    }
}
