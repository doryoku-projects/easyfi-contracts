// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./UserAccessControl.sol";
import "./errors/LiquidityHelperErrors.sol";
import "./interfaces/IOracleSwapUpgradeable.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/ILiquidityManagerUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";

/**
 * @title LiquidityHelperUpgradeable
 * @notice This contract is responsible of helping the LiquidityManager with some liquidity operations.
 */
contract LiquidityHelperUpgradeable is UserAccessControl, LiquidityHelperErrors {
    IProtocolConfigUpgradeable private s_config;

    bytes32 private constant NFPM_KEY = keccak256("NFTPositionMgr");
    bytes32 private constant ORACLE_SWAP_KEY = keccak256("OracleSwap");
    bytes32 private constant LIQUIDITY_MANAGER_KEY = keccak256("LiquidityManager");
    bytes32 private constant MAIN_TOKEN_KEY = keccak256("MainToken");
    bytes32 private constant BP_KEY = keccak256("BP");

    event liquidityAdded(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    function initialize(address _protocolConfig, address _userManagerAddress) public initializer {
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_userManager = IUserManagerUpgradeable(_userManagerAddress);
        s_userManagerAddress = _userManagerAddress;
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
        return true;
    }

    /**
     * @notice Sets the new user manager address.
     * @param _newUserManagerAddress The new address for the user manager, which must be non-zero.
     * @return bool Returns true upon successful update.
     */
    function setUserManagerAddress(address _newUserManagerAddress) public onlyGeneralOrMasterAdmin returns (bool) {
        if (_newUserManagerAddress == address(0)) revert LH_ZERO_ADDRESS();
        if (_newUserManagerAddress == s_userManagerAddress) {
            revert LH_ADDRESS_UNCHANGED();
        }
        s_userManagerAddress = _newUserManagerAddress;
        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
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
        uint256 percentageToMint = (tokenAdded * _BP()) / (tokenDesired + tokenAdded);
        uint256 tokenToMint = (percentageToMint * leftoverAmount) / _BP();

        uint256 tokenToSwap = leftoverAmount - tokenToMint;

        if (!IERC20(tokenFrom).transfer(address(_oracleSwap()), tokenToSwap)) {
            revert LH_TRANSFER_FOR_SWAP_FAILED();
        }

        uint256 swappedAmount = _oracleSwap().swapTokens(tokenFrom, tokenTo, fee, tokenToSwap, address(this));
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

        uint128 liquidityAmount = _oracleSwap().getLiquidityFromAmounts(
            token0Address, token1Address, fee, tickLower, tickUpper, amount0Desired, amount1Desired
        );
        (uint256 amount0Min, uint256 amount1Min) = _oracleSwap().getAmountsFromLiquidity(
            token0Address, token1Address, fee, tickLower, tickUpper, liquidityAmount
        );

        if (!IERC20(token0Address).approve(address(_nfpm()), amount0Desired)) {
            revert LH_APPROVE_INCREASE_LIQ_TOKEN0_FAILED();
        }

        if (!IERC20(token1Address).approve(address(_nfpm()), amount1Desired)) {
            revert LH_APPROVE_INCREASE_LIQ_TOKEN1_FAILED();
        }

        (uint128 increasedLiquidity, uint256 amount0Increased, uint256 amount1Increased) = _nfpm().increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp
            })
        );
        emit liquidityAdded(tokenId, increasedLiquidity, amount0Increased, amount1Increased);

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

        return (usedFrom, usedTo, returnFrom, returnTo);
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
        (,, address token0Address, address token1Address, uint24 fee, int24 tickLower, int24 tickUpper,,,,,) =
            _nfpm().positions(tokenId);

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        uint256 balance0 = IERC20(token0Address).balanceOf(address(_liquidityManager()));
        uint256 balance1 = IERC20(token1Address).balanceOf(address(_liquidityManager()));

        if (balance0 < leftoverAmount0) {
            revert LH_INSUFFICIENT_LM_BALANCE_TOKEN0();
        }

        if (balance1 < leftoverAmount1) {
            revert LH_INSUFFICIENT_LM_BALANCE_TOKEN1();
        }

        if (leftoverAmount0 > 0) {
            if (!token0.transferFrom(address(_liquidityManager()), address(this), leftoverAmount0)) {
                revert LH_TRANSFER_TOKEN0_FAILED();
            }
        }
        if (leftoverAmount1 > 0) {
            if (!token1.transferFrom(address(_liquidityManager()), address(this), leftoverAmount1)) {
                revert LH_TRANSFER_TOKEN1_FAILED();
            }
        }

        uint256 threshold = 10000;

        addedUsed0 = 0;
        addedUsed1 = 0;
        returnToken0 = 0;
        returnToken1 = 0;

        if (leftoverAmount0 > threshold) {
            (uint256 used0, uint256 used1, uint256 ret0, uint256 ret1) = _processLeftover(
                tokenId,
                token0Address,
                token1Address,
                leftoverAmount0,
                amountToken0Desired,
                amount0Added,
                token0Address,
                token1Address,
                fee,
                tickLower,
                tickUpper
            );
            addedUsed0 = used0;
            addedUsed1 = used1;
            returnToken0 = ret0;
            returnToken1 = ret1;
        } else if (leftoverAmount1 > threshold) {
            (uint256 used1, uint256 used0, uint256 ret1, uint256 ret0) = _processLeftover(
                tokenId,
                token1Address,
                token0Address,
                leftoverAmount1,
                amountToken1Desired,
                amount1Added,
                token0Address,
                token1Address,
                fee,
                tickLower,
                tickUpper
            );
            addedUsed0 = used0;
            addedUsed1 = used1;
            returnToken0 = ret0;
            returnToken1 = ret1;
        } else {
            returnToken0 = leftoverAmount0;
            returnToken1 = leftoverAmount1;
        }

        if (returnToken0 > 0) {
            if (!IERC20(token0Address).approve(address(_liquidityManager()), returnToken0)) {
                revert LH_APPROVE_LM_TOKEN0_FAILED();
            }
        }
        if (returnToken1 > 0) {
            if (!IERC20(token1Address).approve(address(_liquidityManager()), returnToken1)) {
                revert LH_APPROVE_LM_TOKEN1_FAILED();
            }
        }

        return (addedUsed0, addedUsed1, returnToken0, returnToken1);
    }
}
