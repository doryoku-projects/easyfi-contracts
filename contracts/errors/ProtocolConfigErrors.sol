// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract ProtocolConfigErrors {
    /**
     * @notice Thrown when an address input is the zero address
     */
    error PC_ZERO_ADDRESS();

    /**
     * @notice Thrown when setting an address to the same as current
     */
    error PC_ADDRESS_UNCHANGED();

    /**
     * @notice Thrown when provided key/value arrays have mismatched lengths
     */
    error PC_ARRAY_LEN_MISMATCH();

    /**
     * @notice Thrown when a uint256 input is zero but must be non-zero
     */
    error PC_INVALID_UINT();

    /**
     * @notice Thrown when updating a uint256 to the same as current
     */
    error PC_UINT_UNCHANGED();

    /**
     * @notice Thrown when attempting to read an address that has not been set
     */
    error PC_ADDRESS_NOT_SET();

    /**
     * @notice Thrown when attempting to read a uint256 that has not been set
     */
    error PC_UINT_NOT_SET();

    error ALREADY_PACKAGE_ID_INFO_UPDATED();

    error PACKAGE_NOT_EXIST();

    error PC_PERCENTAGE_OVERFLOW();
}
