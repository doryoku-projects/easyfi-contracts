// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract LiquidityHelperErrors {
    /**
     * @notice new address is zero
     */
    error LH_ZERO_ADDRESS();
    /**
     * @notice new address equals current
     */
    error LH_ADDRESS_UNCHANGED();
    /**
     * @notice transfer to oracleSwap for swap failed
     */
    error LH_TRANSFER_FOR_SWAP_FAILED();
    /**
     * @notice swap returned zero amount
     */
    error LH_SWAP_RETURNED_ZERO();
    /**
     * @notice  approve to increaseLiquidity failed for token0
     */
    error LH_APPROVE_INCREASE_LIQ_TOKEN0_FAILED();
    /**
     * @notice approve to increaseLiquidity failed for token1
     */
    error LH_APPROVE_INCREASE_LIQ_TOKEN1_FAILED();
    /**
     * @notice LiquidityManager has insufficient token0
     */
    error LH_INSUFFICIENT_LM_BALANCE_TOKEN0();
    /**
     * @notice LiquidityManager has insufficient token1
     */
    error LH_INSUFFICIENT_LM_BALANCE_TOKEN1();
    /**
     * @notice transferFrom LiquidityManager of token0 failed
     */
    error LH_TRANSFER_TOKEN0_FAILED();
    /**
     * @notice transferFrom LiquidityManager of token1 failed
     */
    error LH_TRANSFER_TOKEN1_FAILED();
    /**
     * @notice approve to LiquidityManager for returned token0 failed
     */
    error LH_APPROVE_LM_TOKEN0_FAILED();
    /**
     * @notice approve to LiquidityManager for returned token1 failed
     */
    error LH_APPROVE_LM_TOKEN1_FAILED();
}
