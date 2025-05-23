// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v4-core/src/libraries/TickMath.sol";
import "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";

import "./UserAccessControl.sol";
import "./errors/OracleSwapErrors.sol";

import "./interfaces/IUserManagerUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";

/**
 * @title OracleSwapUpgradeable
 * @notice This contract is responsible of swapping tokens using Uniswap V3 and managing token oracles.
 */
contract OracleSwapUpgradeable is UserAccessControl, OracleSwapErrors {
    using SafeERC20 for IERC20;

    uint256 internal s_slippageNumerator;

    IProtocolConfigUpgradeable private s_config;

    uint256 private constant PRECISION_FACTOR = 1e18;
    bytes32 private constant MAIN_TOKEN_KEY = keccak256("MainToken");
    bytes32 private constant SWAP_ROUTER_KEY = keccak256("SwapRouter");
    bytes32 private constant UNISWAP_FACTORY_KEY = keccak256("Factory");
    bytes32 private constant LIQUIDITY_MANAGER_KEY = keccak256("LiquidityManager");
    bytes32 private constant BP_KEY = keccak256("BP");

    mapping(address => address) private s_tokenOracles;

    event SwapRouterSet(address indexed swapRouter);
    event SlippageParametersUpdated(uint256 newNumerator);
    event TokensSwapped(
        address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 amountOutMinimum
    );
    event TokenOracleUpdated(address indexed token, address indexed oracle);
    event oraclesSet(address indexed oracleIn, address indexed oracleOut);

    function initialize(address _protocolConfig, address _userManagerAddress) external initializer {
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_slippageNumerator = 9900;

        s_userManagerAddress = _userManagerAddress;
        s_userManager = IUserManagerUpgradeable(_userManagerAddress);
    }

    /**
     * @dev Required function for UUPS upgradeable contracts to authorize upgrades.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyMasterAdmin {}

    /**
     * @notice Set the address of the new ProtocolConfig contract.
     * @param _newProtocolConfig Address of the new ProtocolConfig contract.
     */
    function setProtocolConfigAddress(address _newProtocolConfig) public onlyMasterAdmin returns (bool) {
        if (_newProtocolConfig == address(0)) revert OS_ZERO_ADDRESS();
        if (_newProtocolConfig == address(s_config)) {
            revert OS_ADDRESS_UNCHANGED();
        }

        s_config = IProtocolConfigUpgradeable(_newProtocolConfig);
        return true;
    }

    /**
     * @notice Batch-assign multiple oracles to multiple tokens.
     * @param tokens Array of token addresses.
     * @param oracles Array of corresponding oracle addresses.
     */
    function setTokenOracles(address[] calldata tokens, address[] calldata oracles) external onlyGeneralOrMasterAdmin {
        if (tokens.length != oracles.length) revert OS_ARRAY_LENGTH_MISMATCH();

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            address oracle = oracles[i];

            if (token == address(0)) revert OS_INVALID_TOKEN_ADDRESS();
            if (oracle == address(0)) revert OS_INVALID_ORACLE_ADDRESS();

            s_tokenOracles[token] = oracle;
            emit TokenOracleUpdated(token, oracle);
        }
    }

    /**
     * @dev Fetch main token instance from central config.
     */
    function _mainToken() internal view returns (IERC20) {
        return IERC20(s_config.getAddress(MAIN_TOKEN_KEY));
    }

    /**
     * @dev Fetch swap router instance from central config.
     */
    function _swapRouter() internal view returns (ISwapRouter) {
        return ISwapRouter(s_config.getAddress(SWAP_ROUTER_KEY));
    }

    /**
     * @dev Fetch Uniswap V3 Factory instance from central config.
     */
    function _factory() internal view returns (IUniswapV3Factory) {
        return IUniswapV3Factory(s_config.getAddress(UNISWAP_FACTORY_KEY));
    }

    /**
     * @dev Fetch liquidity manager instance from central config.
     */
    function _liquidityManagerAddress() internal view returns (address) {
        return s_config.getAddress(LIQUIDITY_MANAGER_KEY);
    }

    /**
     * @dev Basic points(BP) instance from central config.
     */
    function _BP() internal view returns (uint16) {
        return uint16(s_config.getUint(BP_KEY));
    }

    /**
     * @notice Update slippage tolerance parameters.
     * @param _numerator New slippage numerator in basis points.
     */
    function setSlippageParameters(uint256 _numerator) external onlyGeneralOrMasterAdmin {
        if (_numerator <= 9500 || _numerator > _BP()) {
            revert OS_INVALID_SLIPPAGE_NUMERATOR();
        }

        s_slippageNumerator = _numerator;
        emit SlippageParametersUpdated(_numerator);
    }

    /**
     * @notice Get the oracle address assigned to a given token.
     * @param token Address of the token.
     * @return address of the corresponding price oracle.
     */
    function getTokenOracle(address token) external view onlyGeneralOrMasterAdmin returns (address) {
        return s_tokenOracles[token];
    }

    /**
     * @notice Swap an input token for an output token via Uniswap V3, calculating minimum output to protect against slippage.
     * @param tokenIn Address of the token to sell.
     * @param tokenOut Address of the token to buy.
     * @param fee Fee tier of the Uniswap V3 pool.
     * @param amountIn Amount of tokenIn to swap.
     * @param recipient Address to receive the output tokens.
     * @return amountOut Actual amount of tokenOut received.
     */
    function swapTokens(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, address recipient)
        public
        onlyLiquidityManager
        returns (uint256 amountOut)
    {
        if (address(_swapRouter()) == address(0)) {
            revert OS_SWAP_ROUTER_NOT_SET();
        }

        address oracleIn = s_tokenOracles[tokenIn];
        address oracleOut = s_tokenOracles[tokenOut];

        if (oracleIn == address(0)) revert OS_ORACLE_NOT_SET_IN();
        if (oracleOut == address(0)) revert OS_ORACLE_NOT_SET_OUT();

        AggregatorV3Interface priceFeedTokenIn = AggregatorV3Interface(oracleIn);
        AggregatorV3Interface priceFeedTokenOut = AggregatorV3Interface(oracleOut);

        (uint80 roundIDIn, int256 answerIn,, uint256 updatedAtIn, uint80 answeredInRoundIn) =
            priceFeedTokenIn.latestRoundData();

        if (answerIn <= 0) revert OS_INVALID_PRICE_IN();
        if (updatedAtIn == 0 || updatedAtIn < block.timestamp - 24 hours) {
            revert OS_STALE_PRICE_IN();
        }
        if (answeredInRoundIn < roundIDIn) revert OS_STALE_ROUND_IN();

        (uint80 roundIDOut, int256 answerOut,, uint256 updatedAtOut, uint80 answeredInRoundOut) =
            priceFeedTokenOut.latestRoundData();

        if (answerOut <= 0) revert OS_INVALID_PRICE_OUT();
        if (updatedAtOut == 0 || updatedAtOut < block.timestamp - 24 hours) {
            revert OS_STALE_PRICE_OUT();
        }
        if (answeredInRoundOut < roundIDOut) revert OS_STALE_ROUND_OUT();

        uint8 tokenInDecimals = IERC20Metadata(tokenIn).decimals();
        uint8 tokenOutDecimals = IERC20Metadata(tokenOut).decimals();

        uint8 decimalsDifference = tokenInDecimals >= tokenOutDecimals
            ? tokenInDecimals - tokenOutDecimals
            : tokenOutDecimals - tokenInDecimals;

        uint256 parsedAnswerIn = uint256(answerIn);
        uint256 parsedAnswerOut = uint256(answerOut);

        uint256 computedAmountOut;
        if (tokenInDecimals >= tokenOutDecimals) {
            computedAmountOut =
                (parsedAnswerIn * amountIn * PRECISION_FACTOR) / (parsedAnswerOut * 10 ** decimalsDifference);
            computedAmountOut = computedAmountOut / PRECISION_FACTOR;
        } else {
            computedAmountOut =
                (parsedAnswerIn * amountIn * 10 ** decimalsDifference * PRECISION_FACTOR) / parsedAnswerOut;
            computedAmountOut = computedAmountOut / PRECISION_FACTOR;
        }

        uint256 computedAmountOutMinimum = (computedAmountOut * s_slippageNumerator) / _BP();

        IERC20(tokenIn).safeIncreaseAllowance(address(_swapRouter()), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: recipient,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: computedAmountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        amountOut = _swapRouter().exactInputSingle(params);

        emit TokensSwapped(tokenIn, tokenOut, amountIn, amountOut, computedAmountOut);
    }

    /**
     * @notice Calculate the liquidity amount required for desired token amounts within a tick range.
     * @param token0 Address of token0.
     * @param token1 Address of token1.
     * @param fee Fee tier of the Uniswap V3 pool.
     * @param tickLower Lower tick boundary.
     * @param tickUpper Upper tick boundary.
     * @param amount0Desired Desired amount of token0.
     * @param amount1Desired Desired amount of token1.
     * @return liquidityAmount Amount of liquidity needed for those token amounts.
     */
    function getLiquidityFromAmounts(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external view onlyLiquidityManager returns (uint128 liquidityAmount) {
        address pool = _factory().getPool(token0, token1, fee);
        if (pool == address(0)) revert OS_POOL_NOT_EXIST();

        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

        uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        liquidityAmount = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, amount0Desired, amount1Desired
        );
    }

    /**
     * @notice Calculates the minimum amounts of token0 and token1 obtainable from a given liquidity amount.
     * @param token0 The address of the first token.
     * @param token1 The address of the second token.
     * @param fee The fee tier associated with the pool.
     * @param tickLower The lower tick boundary for the liquidity range.
     * @param tickUpper The upper tick boundary for the liquidity range.
     * @param liquidityAmount The amount of liquidity for which token amounts are calculated.
     * @return amount0Min The minimum amount of token0 accounting for slippage.
     * @return amount1Min The minimum amount of token1 accounting for slippage.
     */
    function getAmountsFromLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidityAmount
    ) external view onlyLiquidityManager returns (uint256 amount0Min, uint256 amount1Min) {
        address pool = _factory().getPool(token0, token1, fee);
        if (pool == address(0)) revert OS_POOL_NOT_EXIST();

        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

        uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        (uint256 amount0, uint256 amount1) =
            LiquidityAmounts.getAmountsForLiquidity(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, liquidityAmount);

        amount0Min = (amount0 * s_slippageNumerator) / _BP();
        amount1Min = (amount1 * s_slippageNumerator) / _BP();
    }

    /**
     * @notice Swaps a specified amount of main token to desired tokens to achieve a balanced liquidity position.
     * @param token0Address The address of token0.
     * @param token1Address The address of token1.
     * @param amountDesired The total desired amount of the main token to be distributed between token0 and token1.
     * @param fee The fee tier used for the swapping operations.
     * @return amountToken0Desired The resulting desired amount of token0 after executing the swap(s).
     * @return amountToken1Desired The resulting desired amount of token1 after executing the swap(s).
     */
    function getBalancedAmounts(address token0Address, address token1Address, uint256 amountDesired, uint24 fee)
        external
        onlyLiquidityManager
        returns (uint256 amountToken0Desired, uint256 amountToken1Desired)
    {
        uint256 balanceBefore = _mainToken().balanceOf(address(this));
        _mainToken().safeTransferFrom(_liquidityManagerAddress(), address(this), amountDesired);
        uint256 actualReceived = _mainToken().balanceOf(address(this)) - balanceBefore;

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        bool isToken0Main = _isMainToken(address(token0));
        bool isToken1Main = _isMainToken(address(token1));

        uint256 halfMain = actualReceived / 2;

        if (isToken0Main) {
            uint256 swappedAmount = swapTokens(address(_mainToken()), address(token1), fee, halfMain, address(this));
            amountToken0Desired = halfMain;
            amountToken1Desired = swappedAmount;
        } else if (isToken1Main) {
            uint256 swappedAmount = swapTokens(address(_mainToken()), address(token0), fee, halfMain, address(this));
            amountToken0Desired = swappedAmount;
            amountToken1Desired = halfMain;
        } else {
            uint256 swappedAmount0 = swapTokens(address(_mainToken()), address(token0), fee, halfMain, address(this));
            uint256 swappedAmount1 = swapTokens(address(_mainToken()), address(token1), fee, halfMain, address(this));
            amountToken0Desired = swappedAmount0;
            amountToken1Desired = swappedAmount1;
        }

        token0.safeIncreaseAllowance(_liquidityManagerAddress(), amountToken0Desired);
        token1.safeIncreaseAllowance(_liquidityManagerAddress(), amountToken1Desired);
    }

    /**
     * @notice Convert received tokens to main token (MainToken) and send to user.
     * @param user Address to receive the converted main token.
     * @param amount0 Amount of token0 received.
     * @param amount1 Amount of token1 received.
     * @param token0 Address of token0.
     * @param token1 Address of token1.
     * @param fee Fee tier for swaps.
     * @return totalAmountMainToken Total main token sent to user.
     */
    function convertToMainTokenAndSend(
        address user,
        uint256 amount0,
        uint256 amount1,
        address token0,
        address token1,
        uint24 fee
    ) external onlyLiquidityManager returns (uint256 totalAmountMainToken) {
        IERC20 token0ERC20 = IERC20(token0);
        IERC20 token1ERC20 = IERC20(token1);

        uint256 actualAmount0 = 0;
        uint256 actualAmount1 = 0;

        if (amount0 > 0) {
            uint256 balance0Before = token0ERC20.balanceOf(address(this));
            token0ERC20.safeTransferFrom(_liquidityManagerAddress(), address(this), amount0);
            actualAmount0 = token0ERC20.balanceOf(address(this)) - balance0Before;
        }

        if (amount1 > 0) {
            uint256 balance1Before = token1ERC20.balanceOf(address(this));
            token1ERC20.safeTransferFrom(_liquidityManagerAddress(), address(this), amount1);
            actualAmount1 = token1ERC20.balanceOf(address(this)) - balance1Before;
        }

        uint256 mainAmount0;
        uint256 mainAmount1;
        bool token0IsMain = _isMainToken(token0);
        bool token1IsMain = _isMainToken(token1);

        if (token0IsMain) {
            mainAmount0 = actualAmount0;
            mainAmount1 =
                (actualAmount1 > 0) ? swapTokens(token1, address(_mainToken()), fee, actualAmount1, address(this)) : 0;
        } else if (token1IsMain) {
            mainAmount1 = actualAmount1;
            mainAmount0 =
                (actualAmount0 > 0) ? swapTokens(token0, address(_mainToken()), fee, actualAmount0, address(this)) : 0;
        } else {
            mainAmount0 =
                (actualAmount0 > 0) ? swapTokens(token0, address(_mainToken()), fee, actualAmount0, address(this)) : 0;
            mainAmount1 =
                (actualAmount1 > 0) ? swapTokens(token1, address(_mainToken()), fee, actualAmount1, address(this)) : 0;
        }

        if (mainAmount0 == 0 && mainAmount1 == 0) {
            revert OS_NOT_ENOUGH_TOKENS();
        }

        totalAmountMainToken = mainAmount0 + mainAmount1;

        _mainToken().safeTransfer(user, totalAmountMainToken);
    }

    /**
     * @notice Checks if the given token address is Main Token.
     * @param token Address of the token to check.
     * @return bool indicating whether the token is Main Token.
     */
    function _isMainToken(address token) internal view returns (bool) {
        return token == address(_mainToken());
    }
}
