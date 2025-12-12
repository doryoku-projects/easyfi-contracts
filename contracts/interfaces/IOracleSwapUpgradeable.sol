// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

/// @notice OracleSwapUpgradeable interface for interacting with the OracleSwap contract.
interface IOracleSwapUpgradeable {
    function setTokenOracles(address[] calldata tokens, address[] calldata oracles) external;

    function getTokenOracle(address token) external view returns (address);

    function setSwapRouter(address _swapRouter) external;

    function setSlippageParameters(uint256 _numerator) external;

    function getLiquidityFromAmounts(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external returns (uint128 liquidityAmount);

    function getAmountsFromLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidityAmount
    ) external returns (uint256 amount0Min, uint256 amount1Min);

    function getBalancedAmounts(address token0Address, address token1Address, uint256 amountDesired, uint24 fee)
        external
        returns (uint256 amountToken0Desired, uint256 amountToken1Desired);

    function convertToMainTokenAndSend(
        address user,
        uint256 amount0,
        uint256 amount1,
        address token0,
        address token1,
        uint24 fee
    ) external returns (uint256 totalAmountMainToken);

    function swapTokens(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, address recipient)
        external
        returns (uint256 amountOut);

    function testFunction() external view returns (uint256 mainTokenBalance);

    function setTWAPWindow(uint32 window) external;

    function getTWAPWindow() external view returns (uint32);
}
