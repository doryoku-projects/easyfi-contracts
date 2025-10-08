// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract VaultManagerErrors {
    /**
     * @notice  userManager address is zero
     */
    error VM_ZERO_ADDRESS();
    /**
     * @notice  maxWithdrawalSize is zero
     */
    error VM_ZERO_MAX_WITHDRAWAL_SIZE();
    /**
     * @notice  userManager address is unchanged
     */
    error VM_ADDRESS_UNCHANGED();
    /**
     * @notice tickLower/tickUpper mismatch on increase
     */
    error VM_RANGE_MISMATCH();
    /**
     * @notice tokenId != 0 on mint
     */
    error VM_ALREADY_HAS_POSITION();
    /**
     * @notice tokenId == 0 on decrease/collect/migrate
     */
    error VM_NO_POSITION();
    /**
     * @notice msg.sender ≠ NFT manager
     */
    error VM_ON_RECEIVE_INVALID_SENDER();
    /**
     * @notice operator ≠ liquidityManager
     */
    error VM_ON_RECEIVE_INVALID_OPERATOR();
    /**
     * @notice migrate to same tick range
     */
    error VM_SAME_TICK_RANGE();
    /**
     * @notice no company fees to withdraw
     */
    error VM_COMPANY_FEES_ZERO();
    /**
     * @notice This error is reverted when the maximum size of an array is exceeded.
     * @param arrayName The name of the array that exceeded the size limit.
     * @param size The size of the array that exceeded the limit.
     */
    error VM_ARRAY_SIZE_LIMIT_EXCEEDED(string arrayName, uint256 size);
    /**
     * @notice Thrown when attempting to add liquidity to a package beyond its allowed cap
     */
    error VM_PACKAGE_LIQUIDITY_CAP_EXCEEDED();
    /**
     * @notice Thrown when the provided package ID is invalid or does not exist
     */
    error VM_INVALID_PACKAGE_ID();
    /**
     * @notice Thrown when a reward operation is attempted before reaching the required cap
     */
    error VM_REWARD_CAP_NOT_REACHED();
    /**
     * @notice Thrown when a user already has an active package and cannot create another
     */
    error VM_USER_PACKAGE_ALREADY_EXIST();
    /**
     * @notice Thrown when the token provided does not match the expected token for the operation
     */
    error VM_TOKEN_MISMATCH();
    /**
     * @notice Thrown when the PC percentage value exceeds the allowed maximum
     */
    error VM_PERCENTAGE_OVERFLOW();
}
