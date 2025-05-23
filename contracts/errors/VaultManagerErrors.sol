// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract VaultManagerErrors {
    /**
     * @notice  _companyFee == 0
     */
    error VM_INVALID_COMPANY_FEE();
    /**
     * @notice  userManager address is zero
     */
    error VM_ZERO_ADDRESS();
    /**
     * @notice  userManager address is unchanged
     */
    error VM_ADDRESS_UNCHANGED();
    /**
     * @notice transferFrom to vault failed
     */
    error VM_TRANSFER_FROM_FAILED();
    /**
     * @notice balanceOf < desired
     */
    error VM_INSUFFICIENT_BALANCE();
    /**
     * @notice approve(...) returned false
     */
    error VM_APPROVE_FAILED();
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
     * @notice transferFrom vault → manager failed
     */
    error VM_PREVIOUS_FEES_TRANSFER_FAILED();
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
     * @notice transfer mainToken to owner failed
     */
    error VM_TRANSFER_COMPANY_FEES_FAILED();
    /**
     * @notice This event is emitted when the maximum size of an array is exceeded.
     * @param arrayName The name of the array that exceeded the size limit.
     * @param size The size of the array that exceeded the limit.
     */
    error VM_ARRAY_SIZE_LIMIT_EXCEEDED(string arrayName, uint256 size);
}
