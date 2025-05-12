// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract LiquidityManagerErrors {
    /**
     * @notice address input was zero
     */
    error LM_ZERO_ADDRESS();
    /**
     * @notice new address equals current
     */
    error LM_ADDRESS_UNCHANGED();
    /**
     * @notice _tokenId == 0 in getPositionData
     */
    error LM_NO_ACTIVE_POSITION();
    /**
     * @notice approve to liquidityHelper for token0 failed
     */
    error LM_APPROVE_HELPER_TOKEN0_FAILED();
    /**
     * @notice approve to liquidityHelper for token1 failed
     */
    error LM_APPROVE_HELPER_TOKEN1_FAILED();
    /**
     * @notice transferFrom liquidityHelper for token0 failed
     */
    error LM_TRANSFER_FROM_HELPER_TOKEN0_FAILED();
    /**
     * @notice transferFrom liquidityHelper for token1 failed
     */
    error LM_TRANSFER_FROM_HELPER_TOKEN1_FAILED();
    /**
     * @notice approve to oracleSwap for token0 failed
     */
    error LM_APPROVE_ORACLESWAP_TOKEN0_FAILED();
    /**
     * @notice approve to oracleSwap for token1 failed
     */
    error LM_APPROVE_ORACLESWAP_TOKEN1_FAILED();
    /**
     * @notice transferFrom vaultManager failed
     */
    error LM_TRANSFER_FROM_VAULT_FAILED();
    /**
     * @notice vault balance < amountDesired
     */
    error LM_INSUFFICIENT_BALANCE();
    /**
     * @notice approve to oracleSwap for mainToken failed
     */
    error LM_APPROVE_ORACLESWAP_FAILED();
    /**
     * @notice transferFrom oracleSwap for token0 failed
     */
    error LM_TRANSFER_FROM_ORACLE_TOKEN0_FAILED();
    /**
     * @notice transferFrom oracleSwap for token1 failed
     */
    error LM_TRANSFER_FROM_ORACLE_TOKEN1_FAILED();
    /**
     * @notice approve to NonfungiblePositionManager for token0 failed
     */
    error LM_APPROVE_NFPMGR_TOKEN0_FAILED();
    /**
     * @notice approve to NonfungiblePositionManager for token1 failed
     */
    error LM_APPROVE_NFPMGR_TOKEN1_FAILED();
    /**
     * @notice ownerOf(tokenId) != this
     */
    error LM_NOT_NFT_OWNER();
    /**
     * @notice percentageToRemove > s_BP
     */
    error LM_PERCENTAGE_TOO_HIGH();
    /**
     * @notice liquidity == 0
     */
    error LM_NO_LIQUIDITY();
    /**
     * @notice this.balanceOf(token0) < collected0
     */
    error LM_INSUFFICIENT_TOKEN0_BALANCE();
    /**
     * @notice this.balanceOf(token1) < collected1
     */
    error LM_INSUFFICIENT_TOKEN1_BALANCE();
    /**
     * @notice transferFrom vaultManager of previousCollected0
     */
    error LM_PREV_FEES_TRANSFER0_FAILED();
    /**
     * @notice transferFrom vaultManager of previousCollected1
     */
    error LM_PREV_FEES_TRANSFER1_FAILED();
    /**
     * @notice approve vaultManager for collected0
     */
    error LM_APPROVE_VAULT_TOKEN0_FAILED();
    /**
     * @notice approve vaultManager for collected1
     */
    error LM_APPROVE_VAULT_TOKEN1_FAILED();
}
