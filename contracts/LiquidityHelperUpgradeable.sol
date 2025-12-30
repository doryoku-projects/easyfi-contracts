// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./UserAccessControl.sol";
import "./errors/LiquidityHelperErrors.sol";

import "./interfaces/IOracleSwapUpgradeable.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/ILiquidityManagerUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";
import "./UniswapV3TWAPOracle.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

/**
 * @title LiquidityHelperUpgradeable
 * @notice This contract is responsible of helping the LiquidityManager with some liquidity operations.
 */
contract LiquidityHelperUpgradeable is UUPSUpgradeable, UserAccessControl, LiquidityHelperErrors {
    using SafeERC20 for IERC20;
    using UniswapV3TWAPOracle for address;

    IProtocolConfigUpgradeable private s_config;

    bytes32 private constant NFPM_KEY = keccak256("NFTPositionMgr");
    bytes32 private constant ORACLE_SWAP_KEY = keccak256("OracleSwap");
    bytes32 private constant LIQUIDITY_MANAGER_KEY = keccak256("LiquidityManager");
    bytes32 private constant BP_KEY = keccak256("BP");
    bytes32 private constant MAIN_TOKEN_KEY = keccak256("MainToken");
    bytes32 private constant UNISWAP_FACTORY_KEY = keccak256("Factory");
    bytes32 private constant TWAP_WINDOW = keccak256("TWAPWindow");

    event LiquidityAdded(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    event ProtocolConfigSet();
    event UserManagerSet();

    function initialize(address _protocolConfig, address _userManagerAddress) public initializer {
        __UUPSUpgradeable_init();
        if (_protocolConfig == address(0)|| _userManagerAddress == address(0)){
            revert LH_ZERO_ADDRESS();
        }
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_userManager = IUserManagerUpgradeable(_userManagerAddress);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Authorizes the upgrade of the contract to a new implementation.
     * @param newImplementation The address of the proposed new contract implementation.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyMasterAdmin {}

    /**
     * @notice Set the address of the new ProtocolConfig contract.
     * @param _newProtocolConfig Address of the new ProtocolConfig contract.
     */
    function setProtocolConfigAddress(address _newProtocolConfig) public onlyMasterAdmin returns (bool) {
        if (_newProtocolConfig == address(0)) revert LH_ZERO_ADDRESS();
        if (_newProtocolConfig == address(s_config)) {
            revert LH_ADDRESS_UNCHANGED();
        }

        s_config = IProtocolConfigUpgradeable(_newProtocolConfig);
        emit ProtocolConfigSet();

        return true;
    }

    /**
     * @notice Sets the new user manager address.
     * @param _newUserManagerAddress The new address for the user manager, which must be non-zero.
     * @return bool Returns true upon successful update.
     */
    function setUserManagerAddress(address _newUserManagerAddress) public onlyGeneralOrMasterAdmin returns (bool) {
        if (_newUserManagerAddress == address(0)) revert LH_ZERO_ADDRESS();
        if (_newUserManagerAddress == address(s_userManager)) {
            revert LH_ADDRESS_UNCHANGED();
        }
        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
        emit UserManagerSet();
        return true;
    }

    /**
     * @dev Fetch Nonfungible Position Manager instance from central config.
     */
    function _nfpm() internal view returns (INonfungiblePositionManager) {
        return INonfungiblePositionManager(s_config.getAddress(NFPM_KEY));
    }

    /**
     * @dev Fetch liquidity manager instance from central config.
     */
    function _liquidityManager() internal view returns (ILiquidityManagerUpgradeable) {
        return ILiquidityManagerUpgradeable(s_config.getAddress(LIQUIDITY_MANAGER_KEY));
    }

    /**
     * @dev Fetch oracle swap instance from central config.
     */
    function _oracleSwap() internal view returns (IOracleSwapUpgradeable) {
        return IOracleSwapUpgradeable(s_config.getAddress(ORACLE_SWAP_KEY));
    }

    /**
     * @dev Basic points(BP) instance from central config.
     */
    function _BP() internal view returns (uint256) {
        return s_config.getUint(BP_KEY);
    }
    
    /**
     * @dev Fetch Uniswap V3 Factory instance from central config.
     */
    function _factory() internal view returns (IUniswapV3Factory) {
        return IUniswapV3Factory(s_config.getAddress(UNISWAP_FACTORY_KEY));
    }

    /**
     * @notice Get the current TWAP window.
     * @return uint32 TWAP window in seconds.
     */
    function _twapWindow() internal view returns (uint32) {
        return uint32(s_config.getUint(TWAP_WINDOW));
    }

    /**
     * @dev Fetch main token instance from central config.
     */
    function _mainToken() internal view returns (IERC20) {
        return IERC20(s_config.getAddress(MAIN_TOKEN_KEY));
    }

    /**
     * @dev Processes leftovers for one token by:
     *   - determining how much of the leftover to use directly
     *   - swapping the remainder into the complementary token,
     *   - calling increaseLiquidity with the combined amounts, and
     *   - computing new leftover amounts based on the actual used tokens.
     *
     * @param tokenId ID of the position.
     * @param tokenFrom The address of the token with leftovers (e.g., token0 if processing leftoverAmount0).
     * @param tokenTo The other token address.
     * @param leftoverAmount The leftover amount for tokenFrom.
     * @param tokenDesired The originally desired amount for tokenFrom.
     * @param tokenAdded The amount of tokenFrom already added in liquidity.
     * @param token0Address The token0 address of the position (used for liquidity calls).
     * @param token1Address The token1 address of the position.
     * @param fee The pool fee.
     * @param tickLower Lower tick of the position.
     * @param tickUpper Upper tick of the position.
     * @return usedFrom The amount of tokenFrom used in the liquidity addition.
     * @return usedTo The amount of tokenTo used in the liquidity addition.
     * @return returnFrom The remaining tokenFrom not used (to be returned to user).
     * @return returnTo The remaining tokenTo not used (to be returned to user).
     */
    function _processLeftover(
        uint256 tokenId,
        address tokenFrom,
        address tokenTo,
        uint256 leftoverAmount,
        uint256 tokenDesired,
        uint256 tokenAdded,
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper
    ) internal returns (uint256 usedFrom, uint256 usedTo, uint256 returnFrom, uint256 returnTo) {
        uint256 _bp = _BP();
        INonfungiblePositionManager _nfpmInstance = _nfpm();
        IOracleSwapUpgradeable _oracleSwapInstance = _oracleSwap();

        uint256 percentageToMint = (tokenAdded * _bp) / (tokenDesired + tokenAdded);
        uint256 tokenToMint = (percentageToMint * leftoverAmount) / _bp;

        uint256 tokenToSwap = leftoverAmount - tokenToMint;

        uint256 balanceBefore = IERC20(tokenFrom).balanceOf(address(_oracleSwapInstance));
        IERC20(tokenFrom).safeTransfer(address(_oracleSwapInstance), tokenToSwap);
        uint256 actualTransferred = IERC20(tokenFrom).balanceOf(address(_oracleSwapInstance)) - balanceBefore;
        
        uint256 swappedAmount = _oracleSwapInstance.swapTokens(tokenFrom, tokenTo, fee, actualTransferred, address(this));
        if (swappedAmount == 0) revert LH_SWAP_RETURNED_ZERO();

        uint256 amount0Desired;
        uint256 amount1Desired;
        if (tokenFrom == token0Address) {
            amount0Desired = tokenToMint;
            amount1Desired = swappedAmount;
        } else {
            amount0Desired = swappedAmount;
            amount1Desired = tokenToMint;
        }

        uint128 liquidityAmount = _oracleSwapInstance.getLiquidityFromAmounts(
            token0Address, token1Address, fee, tickLower, tickUpper, amount0Desired, amount1Desired
        );
        (uint256 amount0Min, uint256 amount1Min) = _oracleSwapInstance.getAmountsFromLiquidity(
            token0Address, token1Address, fee, tickLower, tickUpper, liquidityAmount
        );

        IERC20(token0Address).safeIncreaseAllowance(address(_nfpmInstance), amount0Desired);

        IERC20(token1Address).safeIncreaseAllowance(address(_nfpmInstance), amount1Desired);

        (uint128 increasedLiquidity, uint256 amount0Increased, uint256 amount1Increased) = _nfpmInstance.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp
            })
        );
        emit LiquidityAdded(tokenId, increasedLiquidity, amount0Increased, amount1Increased);

        if (tokenFrom == token0Address) {
            usedFrom = amount0Increased;
            usedTo = amount1Increased;

            returnFrom = tokenToMint > amount0Increased ? tokenToMint - amount0Increased : 0;
            returnTo = swappedAmount > amount1Increased ? swappedAmount - amount1Increased : 0;
        } else {
            usedFrom = amount1Increased;
            usedTo = amount0Increased;
            returnFrom = tokenToMint > amount1Increased ? tokenToMint - amount1Increased : 0;
            returnTo = swappedAmount > amount0Increased ? swappedAmount - amount0Increased : 0;
        }
    }

    /**
     * @dev Handles leftover tokens after minting/increasing liquidity:
     *   - If one of the token leftovers exceeds a configured threshold, attempts to re-add liquidity for that token
     *   - Approves any remaining leftovers to the OracleSwap and converts them to MainToken, sending MainToken to the user.
     *
     * @param tokenId The NFT position ID.
     * @param leftoverAmount0 Leftover amount of token0.
     * @param amountToken0Desired Desired amount of token0 for the initial mint.
     * @param amount0Added Amount of token0 already added.
     * @param leftoverAmount1 Leftover amount of token1.
     * @param amountToken1Desired Desired amount of token1 for the initial mint.
     * @param amount1Added Amount of token1 already added.
     * @return addedUsed0 Amount of token0 used in the liquidity addition.
     * @return addedUsed1 Amount of token1 used in the liquidity addition.
     * @return returnToken0 Amount of token0 returned to the user.
     * @return returnToken1 Amount of token1 returned to the user.
     */
    function handleLeftovers(
        uint256 tokenId,
        uint256 leftoverAmount0,
        uint256 amountToken0Desired,
        uint256 amount0Added,
        uint256 leftoverAmount1,
        uint256 amountToken1Desired,
        uint256 amount1Added
    )
        public
        onlyLiquidityManager
        notEmergency
        returns (uint256 addedUsed0, uint256 addedUsed1, uint256 returnToken0, uint256 returnToken1)
    {
        INonfungiblePositionManager _nfpmInstance = _nfpm();
        ILiquidityManagerUpgradeable _liquidityManagerInstance = _liquidityManager();
        
        (,, address token0Address, address token1Address, uint24 fee, int24 tickLower, int24 tickUpper,,,,,) =
            _nfpmInstance.positions(tokenId);

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        uint256 balance0 = IERC20(token0Address).balanceOf(address(_liquidityManagerInstance));
        uint256 balance1 = IERC20(token1Address).balanceOf(address(_liquidityManagerInstance));

        if (balance0 < leftoverAmount0) {
            revert LH_INSUFFICIENT_LM_BALANCE_TOKEN0();
        }

        if (balance1 < leftoverAmount1) {
            revert LH_INSUFFICIENT_LM_BALANCE_TOKEN1();
        }

        uint256 actualLeft0 = 0;
        uint256 actualLeft1 = 0;

        if (leftoverAmount0 > 0) {
            uint256 balance0Before = token0.balanceOf(address(this));
            token0.safeTransferFrom(address(_liquidityManagerInstance), address(this), leftoverAmount0);
            actualLeft0 = token0.balanceOf(address(this)) - balance0Before;
        }

        if (leftoverAmount1 > 0) {
            uint256 balance1Before = token1.balanceOf(address(this));
            token1.safeTransferFrom(address(_liquidityManagerInstance), address(this), leftoverAmount1);
            actualLeft1 = token1.balanceOf(address(this)) - balance1Before;
        }

        uint256 threshold = 10000;
        address mainToken = s_config.getAddress(MAIN_TOKEN_KEY);

        addedUsed0 = 0;
        addedUsed1 = 0;
        returnToken0 = 0;
        returnToken1 = 0;

        bool process0;
        if (actualLeft0 > 0) {
            if (token0Address == mainToken) {
                process0 = actualLeft0 > threshold;
            } else {
                address pool = _factory().getPool(token0Address, mainToken, fee);
                uint256 price = pool.getTWAPPrice(token0Address, mainToken, _twapWindow());
                uint256 computedAmountOut = UniswapV3TWAPOracle.computeAmountOut(token0Address, mainToken, price, actualLeft0);
                process0 = computedAmountOut > threshold;
            }
        }
        bool process1;
        if (actualLeft1 > 0) {
            if (token1Address == mainToken) {
                process1 = actualLeft1 > threshold;
            } else {
                address pool = _factory().getPool(token1Address, mainToken, fee);
                uint256 price = pool.getTWAPPrice(token1Address, mainToken, _twapWindow());
                uint256 computedAmountOut = UniswapV3TWAPOracle.computeAmountOut(token1Address, mainToken, price, actualLeft1);
                process1 = computedAmountOut > threshold;
            }
        }
        if (process0) {
            (uint256 used0, uint256 used1, uint256 ret0, uint256 ret1) = _processLeftover(
                tokenId,
                token0Address,
                token1Address,
                actualLeft0,
                amountToken0Desired,
                amount0Added,
                token0Address,
                token1Address,
                fee,
                tickLower,
                tickUpper
            );
            addedUsed0 += used0;
            addedUsed1 += used1;
            returnToken0 += ret0;
            returnToken1 += ret1;
        } else {
            returnToken0 += actualLeft0;
        }
        if (process1) {
            (uint256 used1, uint256 used0, uint256 ret1, uint256 ret0) = _processLeftover(
                tokenId,
                token1Address,
                token0Address,
                actualLeft1,
                amountToken1Desired,
                amount1Added,
                token0Address,
                token1Address,
                fee,
                tickLower,
                tickUpper
            );
            addedUsed0 += used0;
            addedUsed1 += used1;
            returnToken0 += ret0;
            returnToken1 += ret1;
        } else {
            returnToken1 += actualLeft1;
        }

        if (returnToken0 > 0) {
            IERC20(token0Address).safeIncreaseAllowance(address(_liquidityManagerInstance), returnToken0);
        }
        if (returnToken1 > 0) {
            IERC20(token1Address).safeIncreaseAllowance(address(_liquidityManagerInstance), returnToken1);
        }
    }
}
