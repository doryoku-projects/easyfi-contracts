// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/swap-router-contracts/contracts/interfaces/IV3SwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v4-core/src/libraries/TickMath.sol";
import "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";

import "./UserAccessControl.sol";
import "./errors/OracleSwapErrors.sol";

import "./interfaces/IUserManagerUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";
import "./UniswapV3TWAPOracle.sol";

/**
 * @title OracleSwapUpgradeable
 * @notice This contract is responsible of swapping tokens using Uniswap V3 and managing token oracles.
 */
contract OracleSwapUpgradeable is UUPSUpgradeable, UserAccessControl, OracleSwapErrors {
    using SafeERC20 for IERC20;
    using UniswapV3TWAPOracle for address;

    uint256 internal s_slippageNumerator;

    IProtocolConfigUpgradeable private s_config;

    uint256 private constant PRECISION_FACTOR = 1e18;
    uint256 private constant MIN_TWAP_WINDOW = 60;
    uint256 private constant MAX_TWAP_WINDOW = 86400;
    bytes32 private constant MAIN_TOKEN_KEY = keccak256("MainToken");
    bytes32 private constant SWAP_ROUTER_KEY = keccak256("SwapRouter");
    bytes32 private constant UNISWAP_FACTORY_KEY = keccak256("Factory");
    bytes32 private constant LIQUIDITY_MANAGER_KEY = keccak256("LiquidityManager");
    bytes32 private constant BP_KEY = keccak256("BP");
    bytes32 private constant TWAP_WINDOW = keccak256("TWAPWindow");

    mapping(address => address) private s_tokenOracles;

    event SlippageParametersUpdated(uint256 newNumerator);
    event TokensSwapped(
        address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 computedAmountOutMinimum
    );
    event TokenOracleUpdated(address indexed token, address indexed oracle);
    event TWAPWindowUpdated(uint32 newWindow);
    event ProtocolConfigSet();
    event UserManagerSet();

    function initialize(address _protocolConfig, address _userManagerAddress) public initializer {
        __UUPSUpgradeable_init();
        if (_protocolConfig == address(0) || _userManagerAddress == address(0)){
            revert OS_ZERO_ADDRESS();
        }
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_slippageNumerator = 99_00; // 99.00%

        s_userManager = IUserManagerUpgradeable(_userManagerAddress);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
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
        emit ProtocolConfigSet();
        return true;
    }

    /**
     * @notice Set the address of the new UserManager.
     * @param _newUserManagerAddress Address of the new UserManager.
     */
    function setUserManagerAddress(address _newUserManagerAddress) public onlyGeneralOrMasterAdmin returns (bool) {
        if (_newUserManagerAddress == address(0)) revert OS_ZERO_ADDRESS();
        if (_newUserManagerAddress == address(s_userManager)) {
            revert OS_ADDRESS_UNCHANGED();
        }

        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
        emit UserManagerSet();
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
    function _swapRouter() internal view returns (IV3SwapRouter) {
        return IV3SwapRouter(s_config.getAddress(SWAP_ROUTER_KEY));
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
    function _BP() internal view returns (uint256) {
        return s_config.getUint(BP_KEY);
    }

    /**
     * @notice Get the current TWAP window.
     * @return uint32 TWAP window in seconds.
     */
    function _twapWindow() internal view returns (uint32) {
        return uint32(s_config.getUint(TWAP_WINDOW));
    }

    /**
     * @notice Update slippage tolerance parameters.
     * @param _numerator New slippage numerator in basis points.
     */
    function setSlippageParameters(uint256 _numerator) external onlyGeneralOrMasterAdmin {
        if (_numerator <= (_BP() * 95) / 100 || _numerator > _BP()) { // 95.00%
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

    function getTwapPrice(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn) external view returns (uint256, uint256) {
        address pool = _factory().getPool(tokenIn, tokenOut, fee);
        uint256 price = pool.getTWAPPrice(tokenIn, tokenOut, _twapWindow());
        uint256 computedAmountOut = UniswapV3TWAPOracle._computeAmountOut(
            tokenIn,
            tokenOut,
            price,
            amountIn
        );

        return (price, computedAmountOut);
    }

    /**
     * @notice Swap an input token for an output token via Uniswap V3, calculating minimum output to protect against slippage.
     * @param tokenIn Address of the token to sell.
     * @param tokenOut Address of the token to buy.
     * @param fee Fee tier of the Uniswap V3 pool.
     * @param amountIn Amount of tokenIn to swap.
     * @param recipient Address to receive the output tokens.
     * @return actualReceived Actual amount of tokenOut received.
     */
    function swapTokens(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, address recipient)
        public
        onlyLiquidityManager
        returns (uint256 actualReceived)
    {
        IV3SwapRouter _swapRouterInstance = _swapRouter();
        if (address(_swapRouterInstance) == address(0)) {
            revert OS_SWAP_ROUTER_NOT_SET();
        }

        address pool = _factory().getPool(tokenIn, tokenOut, fee);
        if (pool == address(0)) revert OS_POOL_NOT_SET();

        uint256 price = pool.getTWAPPrice(tokenIn, tokenOut, _twapWindow());

        uint256 computedAmountOut = UniswapV3TWAPOracle._computeAmountOut(
            tokenIn,
            tokenOut,
            price,
            amountIn
        );

        uint256 computedAmountOutMinimum = (computedAmountOut * s_slippageNumerator) / _BP();

        IERC20(tokenIn).safeIncreaseAllowance(address(_swapRouterInstance), amountIn);

        IV3SwapRouter.ExactInputSingleParams memory params = IV3SwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: computedAmountOutMinimum < 1e6
                    ? 0
                    : computedAmountOutMinimum,
                sqrtPriceLimitX96: 0
            });

        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(recipient);
        _swapRouterInstance.exactInputSingle(params);
        actualReceived = IERC20(params.tokenOut).balanceOf(recipient) - balanceBefore;

        emit TokensSwapped(tokenIn, tokenOut, amountIn, actualReceived, computedAmountOutMinimum);
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
        uint256 _bp = _BP();
        address pool = _factory().getPool(token0, token1, fee);
        if (pool == address(0)) revert OS_POOL_NOT_EXIST();

        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

        uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        (uint256 amount0, uint256 amount1) =
            LiquidityAmounts.getAmountsForLiquidity(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, liquidityAmount);

        amount0Min = (amount0 * s_slippageNumerator) / _bp;
        amount1Min = (amount1 * s_slippageNumerator) / _bp;
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
        IERC20 _mainTokenInstance = _mainToken();
        address _liquidityManagerAddressInstance = _liquidityManagerAddress();

        uint256 balanceBefore = _mainTokenInstance.balanceOf(address(this));
        _mainTokenInstance.safeTransferFrom(_liquidityManagerAddressInstance, address(this), amountDesired);
        uint256 actualReceived = _mainTokenInstance.balanceOf(address(this)) - balanceBefore;

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        bool isToken0Main = _isMainToken(address(token0));
        bool isToken1Main = _isMainToken(address(token1));

        uint256 halfMain = actualReceived / 2;

        amountToken0Desired = isToken0Main
            ? halfMain
            : swapTokens(
                address(_mainTokenInstance),
                address(token0),
                fee,
                halfMain,
                address(this)
            );
        amountToken1Desired = isToken1Main
            ? halfMain
            : swapTokens(
                address(_mainTokenInstance),
                address(token1),
                fee,
                halfMain,
                address(this)
            );

        token0.safeIncreaseAllowance(_liquidityManagerAddressInstance, amountToken0Desired);
        token1.safeIncreaseAllowance(_liquidityManagerAddressInstance, amountToken1Desired);
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
        IERC20 _mainTokenInstance = _mainToken();
        address _liquidityManagerAddressInstance = _liquidityManagerAddress();

        IERC20 token0ERC20 = IERC20(token0);
        IERC20 token1ERC20 = IERC20(token1);

        uint256 actualAmount0 = 0;
        uint256 actualAmount1 = 0;

        if (amount0 > 0) {
            uint256 balance0Before = token0ERC20.balanceOf(address(this));
            token0ERC20.safeTransferFrom(_liquidityManagerAddressInstance, address(this), amount0);
            actualAmount0 = token0ERC20.balanceOf(address(this)) - balance0Before;
        }

        if (amount1 > 0) {
            uint256 balance1Before = token1ERC20.balanceOf(address(this));
            token1ERC20.safeTransferFrom(_liquidityManagerAddressInstance, address(this), amount1);
            actualAmount1 = token1ERC20.balanceOf(address(this)) - balance1Before;
        }

        uint256 mainAmount0;
        uint256 mainAmount1;
        bool token0IsMain = _isMainToken(token0);
        bool token1IsMain = _isMainToken(token1);

        mainAmount0 = token0IsMain
            ? actualAmount0
            : (
                actualAmount0 > 0
                    ? swapTokens(token0, address(_mainTokenInstance), fee, actualAmount0, address(this))
                    : 0
            );
        mainAmount1 = token1IsMain
            ? actualAmount1
            : (
                actualAmount1 > 0
                    ? swapTokens(token1, address(_mainTokenInstance), fee, actualAmount1, address(this) )
                    : 0
            );

        if (mainAmount0 == 0 && mainAmount1 == 0) {
            revert OS_NOT_ENOUGH_TOKENS();
        }

        uint256 amountMainToken = mainAmount0 + mainAmount1;
        uint256 balanceBefore = _mainTokenInstance.balanceOf(user);
        _mainTokenInstance.safeTransfer(user, amountMainToken);
        totalAmountMainToken = _mainTokenInstance.balanceOf(user) - balanceBefore;
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
