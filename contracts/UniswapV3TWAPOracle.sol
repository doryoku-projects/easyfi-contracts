// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v4-core/src/libraries/TickMath.sol";
import "@uniswap/v4-core/src/libraries/FullMath.sol";
import "@uniswap/v4-core/src/libraries/FixedPoint96.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

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
    function _getTWAPTick(
        address pool,
        uint32 secondsAgo
    ) internal view returns (int24 tick) {
        require(secondsAgo != 0, "secondsAgo cannot be 0");
        require(pool != address(0), "Invalid pool address");

        uint32[] memory secondsArray = new uint32[](2);
        secondsArray[0] = secondsAgo;
        secondsArray[1] = 0;

        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(
            secondsArray
        );

        int56 tickDifference = tickCumulatives[1] - tickCumulatives[0];

        tick = int24(tickDifference / int56(int32(secondsAgo)));
    }

    /**
     * @notice Calculate the TWAP price in sqrtPriceX96 format
     * @param pool Address of the Uniswap V3 pool
     * @param secondsAgo Number of seconds in the past to calculate TWAP from
     * @return sqrtPriceX96 The square root of the price in Q96 format
     */
    function _getTWAPPriceX96(
        address pool,
        uint32 secondsAgo
    ) internal view returns (uint160 sqrtPriceX96) {
        int24 twapTick = _getTWAPTick(pool, secondsAgo);
        sqrtPriceX96 = TickMath.getSqrtPriceAtTick(twapTick);
    }

    /**
     * @notice Calculate the TWAP price with decimal adjustment
     * @param pool Address of the Uniswap V3 pool
     * @param _token0 Address of the base token
     * @param twapWindow Number of seconds in the past to calculate TWAP from
     * @return price The price with 8 decimal places
     */
    function getTWAPPrice(
        address pool,
        address _token0,
        address /* _token1 */,
        uint32 twapWindow
    ) internal view returns (uint256 price) {
        address token0 = IUniswapV3Pool(pool).token0();
        address token1 = IUniswapV3Pool(pool).token1();

        uint160 sqrtPriceX96 = _getTWAPPriceX96(pool, twapWindow);

        uint256 priceX96 = FullMath.mulDiv(
            sqrtPriceX96,
            sqrtPriceX96,
            FixedPoint96.Q96
        );

        uint8 d0 = IERC20Metadata(token0).decimals();
        uint8 d1 = IERC20Metadata(token1).decimals();

        if (_token0 == token0) {
            if (d0 >= d1) {
                price = FullMath.mulDiv(
                    priceX96,
                    1e8 * (10 ** (d0 - d1)),
                    FixedPoint96.Q96
                );
            } else {
                price = FullMath.mulDiv(
                    priceX96,
                    1e8,
                    FixedPoint96.Q96 * (10 ** (d1 - d0))
                );
            }
        } else {
            if (priceX96 > 0) {
                uint256 invPriceX96 = FullMath.mulDiv(
                    FixedPoint96.Q96,
                    FixedPoint96.Q96,
                    priceX96
                );
                if (d1 >= d0) {
                    price = FullMath.mulDiv(
                        invPriceX96,
                        1e8 * (10 ** (d1 - d0)),
                        FixedPoint96.Q96
                    );
                } else {
                    price = FullMath.mulDiv(
                        invPriceX96,
                        1e8,
                        FixedPoint96.Q96 * (10 ** (d0 - d1))
                    );
                }
            } else {
                price = 0;
            }
        }
    }
    /**
     * @notice Calculate the amount out with decimal adjustment
     */
    function computeAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 price,
        uint256 amountIn
    ) internal view returns (uint256) {
        uint8 dIn = IERC20Metadata(tokenIn).decimals();
        uint8 dOut = IERC20Metadata(tokenOut).decimals();

        if (dOut >= dIn) {
            return FullMath.mulDiv(price, amountIn * (10 ** (dOut - dIn)), 1e8);
        } else {
            return FullMath.mulDiv(price, amountIn, (10 ** (dIn - dOut)) * 1e8);
        }
    }
}
