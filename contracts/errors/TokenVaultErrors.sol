// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract TokenVaultErrors {
    /**
     * @notice Reverted when an address parameter is the zero address.
     */
    error TV_ZERO_ADDRESS();

    /**
     * @notice Reverted when a basis points value exceeds the protocol maximum (e.g., 10000).
     */
    error TV_BPS_TOO_HIGH();

    /**
     * @notice Reverted when the token is not supported or enabled in the vault.
     */
    error TV_INVALID_TOKEN();

    /**
     * @notice Reverted when the pool ID does not exist or the pool is not active.
     */
    error TV_INVALID_YIELD();

    /**
     * @notice Reverted when attempting to deposit a zero amount.
     */
    error TV_ZERO_AMOUNT();

    /**
     * @notice Reverted when attempting to withdraw from a position that has already been withdrawn.
     */
    error TV_ALREADY_WITHDRAWN();

    /**
     * @notice Reverted when the caller is not the owner of the position.
     */
    error TV_UNAUTHORIZED();

    /**
     * @notice Reverted when trying to withdraw funds before the lock period has expired.
     */
    error TV_STILL_LOCKED();

    /**
     * @notice Reverted when there is an input array length mismatch.
     */
    error TV_INPUT_MISMATCH();

    /**
     * @notice Reverted when the approved amount for withdrawal exceeds the expected payout.
     */
    error TV_APPROVED_AMOUNT_TOO_HIGH();

    error TV_INVALID_NATIVE_AMOUNT();

    error TV_NATIVE_TRANSFER_FAILED();

    /**
     * @notice Reverted when a legacy deposit ID has already been migrated.
     */
    error TV_ALREADY_MIGRATED();

    /**
     * @notice Reverted when a zero principal is passed to migrateDeposit.
     */
    error TV_ZERO_PRINCIPAL();

    /**
     * @notice Reverted when unlock timestamp is not in the future relative to deposit timestamp.
     */
    error TV_INVALID_TIMESTAMPS();
}
