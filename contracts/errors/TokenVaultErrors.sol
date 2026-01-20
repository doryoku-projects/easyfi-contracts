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
    error TV_INVALID_POOL();

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
}
