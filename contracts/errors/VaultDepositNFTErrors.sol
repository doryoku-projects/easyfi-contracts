// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract VaultDepositNFTErrors {
    /**
     * @notice  msg.sender is not the vault
     */
    error NFT_ONLY_VAULT();
    /**
     * @notice  address is zero
     */
    error NFT_ZERO_ADDRESS();
    /**
     * @notice  tokenId does not exist
     */
    error NFT_INVALID_TOKEN_ID();
}