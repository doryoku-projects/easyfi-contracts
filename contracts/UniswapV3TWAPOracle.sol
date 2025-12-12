// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v4-core/src/libraries/TickMath.sol";

/**
 * @title UniswapV3TWAPOracle
 * @notice Library for calculating Time-Weighted Average Price (TWAP) from Uniswap V3 pools
 * @dev Provides functions to compute TWAP tick, sqrtPriceX96, and decimal price
 */
library UniswapV3TWAPOracle {
    /**
     * @notice Calculate the time-weighted average tick over a specified period
     * @param pool Address of the Uniswap V3 pool
     * @param secondsAgo Number of seconds in the past to calculate TWAP from
     * @return tick The time-weighted average tick
     */
    function getTWAPTick(
        address pool,
        uint32 secondsAgo
    ) internal view returns (int24 tick) {
        require(secondsAgo != 0, "secondsAgo cannot be 0");
        require(pool != address(0), "Invalid pool address");

        uint32[] memory secondsArray = new uint32[](2);
        secondsArray[0] = secondsAgo; // past point
        secondsArray[1] = 0; // now

        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(
            secondsArray
        );

        // difference between current cumulative tick and past cumulative tick
        int56 tickDifference = tickCumulatives[1] - tickCumulatives[0];

        // TWAP tick = diff / secondsAgo
        tick = int24(tickDifference / int56(int32(secondsAgo)));

        // NOTE: Uniswap docs: if rounding needed, adjust manually.
        // For most use cases, the integer division is sufficient
    }

    /**
     * @notice Calculate the TWAP price in sqrtPriceX96 format
     * @param pool Address of the Uniswap V3 pool
     * @param secondsAgo Number of seconds in the past to calculate TWAP from
     * @return sqrtPriceX96 The square root of the price in Q96 format
     */
    function getTWAPPriceX96(
        address pool,
        uint32 secondsAgo
    ) internal view returns (uint160 sqrtPriceX96) {
        int24 twapTick = getTWAPTick(pool, secondsAgo);
        sqrtPriceX96 = TickMath.getSqrtPriceAtTick(twapTick);
    }

    /**
     * @notice Calculate the TWAP price in decimal format (token0/token1)
     * @param pool Address of the Uniswap V3 pool
     * @param secondsAgo Number of seconds in the past to calculate TWAP from
     * @return price The price as a ratio of token0/token1
     * @dev Price is calculated as (sqrtPriceX96^2) / 2^192
     */
    function getTWAPPrice(
        address pool,
        uint32 secondsAgo
    ) internal view returns (uint256 price) {
        uint160 sqrtPriceX96 = getTWAPPriceX96(pool, secondsAgo);

        // price = (sqrtPriceX96^2) / 2^192
        price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
    }

    /**
     * @notice Get the current spot price from the pool (not time-weighted)
     * @param pool Address of the Uniswap V3 pool
     * @return sqrtPriceX96 The current square root price in Q96 format
     * @return tick The current tick
     */
    function getCurrentPrice(
        address pool
    ) internal view returns (uint160 sqrtPriceX96, int24 tick) {
        require(pool != address(0), "Invalid pool address");
        (sqrtPriceX96, tick, , , , , ) = IUniswapV3Pool(pool).slot0();
    }
}
