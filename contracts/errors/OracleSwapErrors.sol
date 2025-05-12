// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract OracleSwapErrors {
    /**
     * @notice tokens.length != oracles.length
     */
    error OS_ARRAY_LENGTH_MISMATCH();
    /**
     * @notice token == address(0)
     */
    error OS_INVALID_TOKEN_ADDRESS();
    /**
     * @notice oracle == address(0)
     */
    error OS_INVALID_ORACLE_ADDRESS();
    /**
     * @notice numerator out of bounds
     */
    error OS_INVALID_SLIPPAGE_NUMERATOR();
    /**
     * @notice address input was zero
     */
    error OS_ZERO_ADDRESS();
    /**
     * @notice new address equals current
     */
    error OS_ADDRESS_UNCHANGED();
    /**
     * @notice s_swapRouterAddress == address(0)
     */
    error OS_SWAP_ROUTER_NOT_SET();
    /**
     * @notice oracleIn == address(0)
     */
    error OS_ORACLE_NOT_SET_IN();
    /**
     * @notice oracleOut == address(0)
     */
    error OS_ORACLE_NOT_SET_OUT();
    /**
     * @notice answerIn <= 0
     */
    error OS_INVALID_PRICE_IN();
    /**
     * @notice updatedAtIn too old
     */
    error OS_STALE_PRICE_IN();
    /**
     * @notice answeredInRoundIn < roundIDIn
     */
    error OS_STALE_ROUND_IN();
    /**
     * @notice answerOut <= 0
     */
    error OS_INVALID_PRICE_OUT();
    /**
     * @notice updatedAtOut too old
     */
    error OS_STALE_PRICE_OUT();
    /**
     * @notice answeredInRoundOut < roundIDOut
     */
    error OS_STALE_ROUND_OUT();
    /**
     * @notice getAmounts: pool == address(0)
     */
    error OS_POOL_NOT_EXIST();
    /**
     * @notice mainToken.transferFrom failed
     */
    error OS_TRANSFER_FROM_LM_FAILED();
    /**
     * @notice balanceOf(this) < amountDesired
     */
    error OS_INSUFFICIENT_MAIN_BALANCE();
    /**
     * @notice token0.approve failed
     */
    error OS_APPROVE_TOKEN0_FAILED();
    /**
     * @notice token1.approve failed
     */
    error OS_APPROVE_TOKEN1_FAILED();
    /**
     * @notice token0.transferFrom failed
     */
    error OS_TOKEN0_TRANSFER_FAILED();
    /**
     * @notice balanceOf(this) < amount0
     */
    error OS_INSUFFICIENT_TOKEN0_BALANCE();
    /**
     * @notice token1.transferFrom failed
     */
    error OS_TOKEN1_TRANSFER_FAILED();
    /**
     * @notice balanceOf(this) < amount1
     */
    error OS_INSUFFICIENT_TOKEN1_BALANCE();
    /**
     * @notice both mainAmount0 and mainAmount1 == 0
     */
    error OS_NOT_ENOUGH_TOKENS();
}
