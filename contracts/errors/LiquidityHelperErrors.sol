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
     * @notice swap returned zero amount
     */
    error LH_SWAP_RETURNED_ZERO();

    /**
     * @notice LiquidityManager has insufficient token0
     */
    error LH_INSUFFICIENT_LM_BALANCE_TOKEN0();
    /**
     * @notice LiquidityManager has insufficient token1
     */
    error LH_INSUFFICIENT_LM_BALANCE_TOKEN1();
}
