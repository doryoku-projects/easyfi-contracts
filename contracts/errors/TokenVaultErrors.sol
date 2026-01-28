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
     * @notice Reverted when the length of tokens and oracles arrays do not match.
     */
    error TV_ARRAY_LENGTH_MISMATCH();

    /**
     * @notice Reverted when an oracle address is invalid (zero address).
     */
    error TV_INVALID_ORACLE_ADDRESS();

    /**
     * @notice Reverted when no oracle is set for a token.
     */
    error TV_ORACLE_NOT_SET();

    /**
     * @notice Reverted when the retrieved price is invalid (<= 0).
     */
    error TV_INVALID_PRICE();

    /**
     * @notice Reverted when the retrieved price is stale.
     */
    error TV_STALE_PRICE();

    /**
     * @notice Reverted when the answer round is older than the current round.
     */
    error TV_STALE_ROUND();

    /**
     * @notice Reverted when a native transfer (ETH/POL) fails.
     */
    error TV_NATIVE_TRANSFER_FAILED();

    /**
     * @notice Reverted when the native amount sent does not match the expected amount.
     */
    error TV_INVALID_NATIVE_AMOUNT();
}
