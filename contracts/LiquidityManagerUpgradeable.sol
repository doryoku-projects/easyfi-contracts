// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./UserAccessControl.sol";
import "./errors/LiquidityManagerErrors.sol";

import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IOracleSwapUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";
import "./interfaces/ILiquidityHelperUpgradeable.sol";

/**
 * @title LiquidityManagerUpgradeable
 * @notice This contract is responsible of managing liquidity positions in Uniswap v3
 * and interacting with the OracleSwap and LiquidityHelper contracts.
 */
contract LiquidityManagerUpgradeable is UUPSUpgradeable, UserAccessControl, LiquidityManagerErrors {
    using SafeERC20 for IERC20;

    IProtocolConfigUpgradeable private s_config;

    bytes32 private constant NFPM_KEY = keccak256("NFTPositionMgr");
    bytes32 private constant LIQ_HELPER_KEY = keccak256("LiquidityHelper");
    bytes32 private constant ORACLE_SWAP_KEY = keccak256("OracleSwap");
    bytes32 private constant VAULT_KEY = keccak256("VaultManager");
    bytes32 private constant MAIN_TOKEN_KEY = keccak256("MainToken");
    bytes32 private constant BP_KEY = keccak256("BP");

    struct LeftoverResult {
        uint256 extraUsed0;
        uint256 extraUsed1;
        uint256 actualReturnToken0;
        uint256 actualReturnToken1;
    }

    struct MintResult {
        uint256 tokenId;
        uint256 mintedAmount0;
        uint256 mintedAmount1;
        uint256 actualReturnToken0;
        uint256 actualReturnToken1;
    }

    event PositionMinted(uint256 indexed tokenId, uint256 amount0, uint256 amount1);
    event LiquidityAdded(uint256 indexed tokenId, uint256 amount0, uint256 amount1);
    event AmountsDesired(uint256 indexed amount0Desired, uint256 indexed amount1Desired);
    event LiquidityRemoved(uint256 indexed tokenId, uint256 amountMainToken, uint256 amount0, uint256 amount1);
    event FeesCollected(uint256 indexed tokenId, uint256 amount0, uint256 amount1);
    event PositionMigrated(
        uint256 indexed oldTokenId, uint256 indexed newTokenId, uint256 cumulatedFee0, uint256 cumulatedFee1
    );
    event PositionBurned(uint256 indexed tokenId);
    event ProtocolConfigSet();
    event UserManagerSet();

    function initialize(address _protocolConfig, address _userManagerAddress) public initializer {
        __UUPSUpgradeable_init();
        if (_protocolConfig == address(0) || _userManagerAddress == address(0)){
            revert LM_ZERO_ADDRESS();
        }
        s_userManager = IUserManagerUpgradeable(_userManagerAddress);
        s_config = IProtocolConfigUpgradeable(_protocolConfig);
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
        if (_newProtocolConfig == address(0)) revert LM_ZERO_ADDRESS();
        if (_newProtocolConfig == address(s_config)) {
            revert LM_ADDRESS_UNCHANGED();
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
        if (_newUserManagerAddress == address(0)) revert LM_ZERO_ADDRESS();
        if (_newUserManagerAddress == address(s_userManager)) {
            revert LM_ADDRESS_UNCHANGED();
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
     * @dev Fetch liquidity helper instance from central config.
     */
    function _liquidityHelper() internal view returns (ILiquidityHelperUpgradeable) {
        return ILiquidityHelperUpgradeable(s_config.getAddress(LIQ_HELPER_KEY));
    }

    /**
     * @dev Fetch oracle swap instance from central config.
     */
    function _oracleSwap() internal view returns (IOracleSwapUpgradeable) {
        return IOracleSwapUpgradeable(s_config.getAddress(ORACLE_SWAP_KEY));
    }

    /**
     * @dev Fetch main token instance from central config.
     */
    function _mainToken() internal view returns (IERC20) {
        return IERC20(s_config.getAddress(MAIN_TOKEN_KEY));
    }

    /**
     * @dev Fetch vault manager instance from central config.
     */
    function _vaultManager() internal view returns (address) {
        return s_config.getAddress(VAULT_KEY);
    }

    /**
     * @dev Basic points(BP) instance from central config.
     */
    function _BP() internal view returns (uint256) {
        return s_config.getUint(BP_KEY);
    }

    /**
     * @notice Retrieve detailed data for a given position.
     * @param _tokenId ID of the position.
     * @return nonce Position nonce.
     * @return operator Approved operator for the position.
     * @return token0Addr Address of token0.
     * @return token1Addr Address of token1.
     * @return fee Fee tier of the position.
     * @return tickLower Lower tick boundary of the position.
     * @return tickUpper Upper tick boundary of the position.
     * @return liquidity Current liquidity of the position.
     * @return feeGrowthInside0LastX128 Last recorded fee growth for token0.
     * @return feeGrowthInside1LastX128 Last recorded fee growth for token1.
     * @return tokensOwed0 Outstanding token0 fees owed.
     * @return tokensOwed1 Outstanding token1 fees owed.
     */
    function getPositionData(uint256 _tokenId)
        external
        view
        onlyLiquidityManager
        returns (
            uint96 nonce,
            address operator,
            address token0Addr,
            address token1Addr,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        if (_tokenId == 0) revert LM_NO_ACTIVE_POSITION();

        (
            nonce,
            operator,
            token0Addr,
            token1Addr,
            fee,
            tickLower,
            tickUpper,
            liquidity,
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128,
            tokensOwed0,
            tokensOwed1
        ) = _nfpm().positions(_tokenId);
    }

    /**
     * @dev Internal helper that handles the leftover logic common to both mintPosition and increaseLiquidityPosition.
     *
     * @param tokenId         ID of the liquidity position.
     * @param token0Address   Address of token0.
     * @param token1Address   Address of token1.
     * @param token0ERC       IERC20 instance for token0.
     * @param token1ERC       IERC20 instance for token1.
     * @param amount0Desired  The desired amount for token0 (before mint/increase).
     * @param amount1Desired  The desired amount for token1.
     * @param usedAmount0     The amount of token0 actually used.
     * @param usedAmount1     The amount of token1 actually used.
     * @param user            The user address.
     * @param fee             The fee parameter for the pool.
     * @return _leftover Struct containing details about token usage and returns:
     *  - extraUsed0: Additional token0 amount used beyond the expected amount.
     *  - extraUsed1: Additional token1 amount used beyond the expected amount.
     *  - actualReturnToken0: Unused token0 amount returned after minting liquidity.
     *  - actualReturnToken1: Unused token1 amount returned after minting liquidity.
     */
    function _handleLeftoverLogic(
        uint256 tokenId,
        address token0Address,
        address token1Address,
        IERC20 token0ERC,
        IERC20 token1ERC,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 usedAmount0,
        uint256 usedAmount1,
        address user,
        uint24 fee
    ) internal returns (LeftoverResult memory _leftover) {
        uint256 leftoverAmount0 = amount0Desired - usedAmount0;
        uint256 leftoverAmount1 = amount1Desired - usedAmount1;
        IOracleSwapUpgradeable _oracleSwapInstance = IOracleSwapUpgradeable(_oracleSwap());
        ILiquidityHelperUpgradeable _liquidityHelperInstance = ILiquidityHelperUpgradeable(_liquidityHelper());

        if (leftoverAmount0 > 0) {
            token0ERC.safeIncreaseAllowance(address(_liquidityHelperInstance), leftoverAmount0);
        }
        if (leftoverAmount1 > 0) {
            token1ERC.safeIncreaseAllowance(address(_liquidityHelperInstance), leftoverAmount1);
        }

        (uint256 extraUsed0Local, uint256 extraUsed1Local, uint256 returnToken0, uint256 returnToken1) =
        _liquidityHelperInstance.handleLeftovers(
            tokenId, leftoverAmount0, amount0Desired, usedAmount0, leftoverAmount1, amount1Desired, usedAmount1
        );

        // Track actual received amounts for token0
        uint256 actualReturnToken0 = 0;
        if (returnToken0 > 0) {
            uint256 balance0Before = token0ERC.balanceOf(address(this));
            token0ERC.safeTransferFrom(address(_liquidityHelperInstance), address(this), returnToken0);
            actualReturnToken0 = token0ERC.balanceOf(address(this)) - balance0Before;
            token0ERC.safeIncreaseAllowance(address(_oracleSwapInstance), actualReturnToken0);
        }

        // Track actual received amounts for token1
        uint256 actualReturnToken1 = 0;
        if (returnToken1 > 0) {
            uint256 balance1Before = token1ERC.balanceOf(address(this));
            token1ERC.safeTransferFrom(address(_liquidityHelperInstance), address(this), returnToken1);
            actualReturnToken1 = token1ERC.balanceOf(address(this)) - balance1Before;
            token1ERC.safeIncreaseAllowance(address(_oracleSwapInstance), actualReturnToken1);
        }

        if (actualReturnToken0 > 0 || actualReturnToken1 > 0) {
            if (user != _vaultManager()) {
                _oracleSwapInstance.convertToMainTokenAndSend(
                    user, actualReturnToken0, actualReturnToken1, token0Address, token1Address, fee
                );
            }
        }
        _leftover.extraUsed0 = extraUsed0Local;
        _leftover.extraUsed1 = extraUsed1Local;
        _leftover.actualReturnToken0 = actualReturnToken0;
        _leftover.actualReturnToken1 = actualReturnToken1;
    }

    /**
     * @notice Mint a new Uniswap V3 position with up to 1% slippage and transfer it to the vault.
     * @param token0 Address of token0 in the pool.
     * @param token1 Address of token1 in the pool.
     * @param fee Fee tier of the pool.
     * @param tickLower Lower tick boundary for the position.
     * @param tickUpper Upper tick boundary for the position.
     * @param amountDesired Desired amount of the main token to allocate.
     * @param user Address to which any converted liquidity or fees should be sent.
     * @param isVault Whether the call is initiated by the vault (true) or an external sender (false).
     * @return _mintResult Struct containing details of the minted liquidity position:
     *  - tokenId: ID of the newly minted position NFT.
     *  - mintedAmount0: Actual amount of token0 deposited into the position.
     *  - mintedAmount1: Actual amount of token1 deposited into the position.
     *  - actualReturnToken0: Unused token0 amount returned to the caller.
     *  - actualReturnToken1: Unused token1 amount returned to the caller.
     */
    function mintPosition(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountDesired,
        address user,
        bool isVault
    )
        public
        onlyLiquidityManager
        notEmergency
        returns (MintResult memory _mintResult)
    {
        // Cache storage variables to reduce SLOADs
        IERC20 _mainTokenInstance = _mainToken();
        address _vaultManagerInstance = _vaultManager();
        IOracleSwapUpgradeable _oracleSwapInstance = _oracleSwap();

        uint256 actualAmountReceived = amountDesired;

        if (isVault) {
            uint256 balanceBefore = _mainTokenInstance.balanceOf(address(this));
            _mainTokenInstance.safeTransferFrom(_vaultManagerInstance, address(this), amountDesired);
            actualAmountReceived = _mainTokenInstance.balanceOf(address(this)) - balanceBefore;
        }

        _mainTokenInstance.safeIncreaseAllowance(address(_oracleSwapInstance), actualAmountReceived);

        (uint256 amount0Desired, uint256 amount1Desired) =
            _oracleSwapInstance.getBalancedAmounts(token0, token1, actualAmountReceived, fee);

        IERC20 token0ERC = IERC20(token0);
        IERC20 token1ERC = IERC20(token1);

        uint256 balance0Before = token0ERC.balanceOf(address(this));
        token0ERC.safeTransferFrom(address(_oracleSwapInstance), address(this), amount0Desired);
        uint256 actualAmount0Desired = token0ERC.balanceOf(address(this)) - balance0Before;

        uint256 balance1Before = token1ERC.balanceOf(address(this));
        token1ERC.safeTransferFrom(address(_oracleSwapInstance), address(this), amount1Desired);
        uint256 actualAmount1Desired = token1ERC.balanceOf(address(this)) - balance1Before;

        emit AmountsDesired(actualAmount0Desired, actualAmount1Desired);

        return
            _mint(token0, token1, fee, tickLower, tickUpper, actualAmount0Desired, actualAmount1Desired, user);
    }

    /**
     * @notice Internal helper to mint a new position.
     * @param token0 Address of token0.
     * @param token1 Address of token1.
     * @param fee Fee of the position.
     * @param tickLower Lower tick of the position.
     * @param tickUpper Upper tick of the position.
     * @param amount0Desired Amount of token0 desired.
     * @param amount1Desired Amount of token1 desired.
     * @param user Address to which any converted main token should be sent.
     * @return _mintResult Mint result.
     */
    function _mint(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, address user)
        internal
        returns (MintResult memory _mintResult)
    {
        IOracleSwapUpgradeable _oracleSwapInstance = IOracleSwapUpgradeable(_oracleSwap());
        INonfungiblePositionManager _nfpmInstance = INonfungiblePositionManager(_nfpm());
        address _vaultManagerInstance = _vaultManager();
        IERC20 token0ERC = IERC20(token0);
        IERC20 token1ERC = IERC20(token1);

        uint128 liquidityAmount = _oracleSwapInstance.getLiquidityFromAmounts(token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired);

        (uint256 amount0Min, uint256 amount1Min) =
            _oracleSwapInstance.getAmountsFromLiquidity(token0, token1, fee, tickLower, tickUpper, liquidityAmount);

        token0ERC.safeIncreaseAllowance(address(_nfpmInstance), amount0Desired);
        token1ERC.safeIncreaseAllowance(address(_nfpmInstance), amount1Desired);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min,
            recipient: address(this),
            deadline: block.timestamp
        });

        (uint256 tokenId,, uint256 usedAmount0, uint256 usedAmount1) = _nfpmInstance.mint(params);

        _nfpmInstance.approve(address(_liquidityHelper()), tokenId);

        LeftoverResult memory _leftover;
        if (amount0Desired > usedAmount0 || amount1Desired > usedAmount1) {
            _leftover = _handleLeftoverLogic(
                tokenId,
                token0,
                token1,
                token0ERC,
                token1ERC,
                amount0Desired,
                amount1Desired,
                usedAmount0,
                usedAmount1,
                user,
                fee
            );
        }

        _mintResult.mintedAmount0 = usedAmount0 + _leftover.extraUsed0;
        _mintResult.mintedAmount1 = usedAmount1 + _leftover.extraUsed1;
        _mintResult.actualReturnToken0 = _leftover.actualReturnToken0;
        _mintResult.actualReturnToken1 = _leftover.actualReturnToken1;

        if (IERC721(address(_nfpmInstance)).ownerOf(tokenId) != address(this)) {
            revert LM_NOT_NFT_OWNER();
        }

        _nfpmInstance.approve(address(0), tokenId);

        _nfpmInstance.safeTransferFrom(address(this), _vaultManagerInstance, tokenId);

        _mintResult.tokenId = tokenId;
        emit PositionMinted(tokenId, _mintResult.mintedAmount0, _mintResult.mintedAmount1);
    }

    /**
     * @notice Add additional liquidity to an existing position.
     * @param tokenId ID of the position NFT.
     * @param amountDesired Desired amount of the main token to add.
     * @param user Address to which any converted liquidity or fees should be sent.
     * @return increasedAmount0 Amount of token0 added.
     * @return increasedAmount1 Amount of token1 added.
     */
    function increaseLiquidityPosition(uint256 tokenId, uint256 amountDesired, address user)
        external
        onlyLiquidityManager
        notEmergency
        returns (uint256 increasedAmount0, uint256 increasedAmount1)
    {
        IERC20 _mainTokenInstance = IERC20(_mainToken());
        INonfungiblePositionManager _nfpmInstance = INonfungiblePositionManager(_nfpm());
        IOracleSwapUpgradeable _oracleSwapInstance = IOracleSwapUpgradeable(_oracleSwap());

        uint256 balanceBefore = _mainTokenInstance.balanceOf(address(this));
        _mainTokenInstance.safeTransferFrom(address(_vaultManager()), address(this), amountDesired);
        uint256 actualAmountReceived = _mainTokenInstance.balanceOf(address(this)) - balanceBefore;

        _mainTokenInstance.safeIncreaseAllowance(address(_oracleSwapInstance), actualAmountReceived);

        (,, address token0Address, address token1Address, uint24 fee, int24 tickLower, int24 tickUpper,,,,,) =
            _nfpmInstance.positions(tokenId);

        IERC20 token0ERC = IERC20(token0Address);
        IERC20 token1ERC = IERC20(token1Address);

        (uint256 amount0Desired, uint256 amount1Desired) =
            _oracleSwapInstance.getBalancedAmounts(token0Address, token1Address, actualAmountReceived, fee);

        // Track actual amounts received for token0
        uint256 balance0Before = token0ERC.balanceOf(address(this));
        token0ERC.safeTransferFrom(address(_oracleSwapInstance), address(this), amount0Desired);
        uint256 actualAmount0Desired = token0ERC.balanceOf(address(this)) - balance0Before;

        // Track actual amounts received for token1
        uint256 balance1Before = token1ERC.balanceOf(address(this));
        token1ERC.safeTransferFrom(address(_oracleSwapInstance), address(this), amount1Desired);
        uint256 actualAmount1Desired = token1ERC.balanceOf(address(this)) - balance1Before;

        uint128 liquidityAmount = _oracleSwapInstance.getLiquidityFromAmounts(
            token0Address, token1Address, fee, tickLower, tickUpper, actualAmount0Desired, actualAmount1Desired
        );

        (uint256 amount0Min, uint256 amount1Min) = _oracleSwapInstance.getAmountsFromLiquidity(
            token0Address, token1Address, fee, tickLower, tickUpper, liquidityAmount
        );

        token0ERC.safeIncreaseAllowance(address(_nfpmInstance), actualAmount0Desired);
        token1ERC.safeIncreaseAllowance(address(_nfpmInstance), actualAmount1Desired);

        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
            tokenId: tokenId,
            amount0Desired: actualAmount0Desired,
            amount1Desired: actualAmount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min,
            deadline: block.timestamp
        });

        (, uint256 _increasedAmount0, uint256 _increasedAmount1) = _nfpmInstance.increaseLiquidity(params);

        LeftoverResult memory _leftover;

        if (actualAmount0Desired > _increasedAmount0 || actualAmount1Desired > _increasedAmount1) {
            _leftover = _handleLeftoverLogic(
                tokenId,
                token0Address,
                token1Address,
                token0ERC,
                token1ERC,
                actualAmount0Desired,
                actualAmount1Desired,
                _increasedAmount0,
                _increasedAmount1,
                user,
                fee
            );
        }

        increasedAmount0 = _increasedAmount0 + _leftover.extraUsed0;
        increasedAmount1 = _increasedAmount1 + _leftover.extraUsed1;

        emit LiquidityAdded(tokenId, increasedAmount0, increasedAmount1);
    }

    /**
     * @notice Remove or withdraw a percentage of liquidity from a position.
     * @dev Internal helper to decrease liquidity and collect raw tokens from Uniswap V3.
     * @param tokenId ID of the position NFT.
     * @param percentageToRemove Percentage of liquidity to remove (basis points, e.g. 5000 = 50%).
     * @return collected0 Amount of token0 collected.
     * @return collected1 Amount of token1 collected.
     * @return token0Address Address of token0.
     * @return token1Address Address of token1.
     * @return fee Fee of the position.
     */
    function _decreaseAndCollect(uint256 tokenId, uint128 percentageToRemove)
        internal
        returns (uint256 collected0, uint256 collected1, address token0Address, address token1Address, uint24 fee)
    {
        IOracleSwapUpgradeable _oracleSwapInstance = _oracleSwap();
        INonfungiblePositionManager _nfpmInstance = _nfpm();

        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;

        (
            ,
            ,
            token0Address,
            token1Address,
            fee,
            tickLower,
            tickUpper,
            liquidity,
            ,
            ,
            ,
        ) = _nfpmInstance.positions(tokenId);

        if (percentageToRemove > _BP()) revert LM_PERCENTAGE_TOO_HIGH();
        if (liquidity == 0) revert LM_NO_LIQUIDITY();

        uint128 liquidityToRemove = (percentageToRemove * liquidity) / uint128(_BP());

        (uint256 amount0Min, uint256 amount1Min) = _oracleSwapInstance.getAmountsFromLiquidity(
            token0Address, token1Address, fee, tickLower, tickUpper, liquidityToRemove
        );

        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
            tokenId: tokenId,
            liquidity: liquidityToRemove,
            amount0Min: amount0Min,
            amount1Min: amount1Min,
            deadline: block.timestamp
        });

        _nfpmInstance.decreaseLiquidity(params);

        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        uint256 balanceFee0Before = IERC20(token0Address).balanceOf(address(this));
        uint256 balanceFee1Before = IERC20(token1Address).balanceOf(address(this));

        _nfpmInstance.collect(collectParams);

        collected0 = IERC20(token0Address).balanceOf(address(this)) - balanceFee0Before;
        collected1 = IERC20(token1Address).balanceOf(address(this)) - balanceFee1Before;

        if (percentageToRemove == _BP()) {
            _nfpmInstance.burn(tokenId);
            emit PositionBurned(tokenId);
        }
    }

    /**
     * @notice Decrease liquidity of an existing position and convert it to the main token.
     * @param tokenId ID of the position NFT.
     * @param percentageToRemove Percentage of liquidity to remove (basis points, e.g. 5000 = 50%).
     * @param user Address to which any converted main token should be sent.
     * @param migrate Whether to migrate remaining position into a new one (true) or simply withdraw (false).
     * @return collectedMainToken Amount of main token received after conversion.
     */
    function decreaseLiquidityPosition(uint256 tokenId, uint128 percentageToRemove, address user, bool migrate)
        public
        onlyLiquidityManager
        notEmergency
        returns (uint256 collectedMainToken)
    {
        (uint256 collected0, uint256 collected1, address token0Address, address token1Address, uint24 fee) = _decreaseAndCollect(tokenId, percentageToRemove);

        IOracleSwapUpgradeable _oracleSwapInstance = _oracleSwap();
        if (IERC20(token0Address).balanceOf(address(this)) < collected0) {
            revert LM_INSUFFICIENT_TOKEN0_BALANCE();
        }
        if (IERC20(token1Address).balanceOf(address(this)) < collected1) {
            revert LM_INSUFFICIENT_TOKEN1_BALANCE();
        }

        IERC20(token0Address).safeIncreaseAllowance(address(_oracleSwapInstance), collected0);
        IERC20(token1Address).safeIncreaseAllowance(address(_oracleSwapInstance), collected1);

        collectedMainToken = _oracleSwapInstance.convertToMainTokenAndSend(
            migrate ? address(this) : user, collected0, collected1, token0Address, token1Address, fee
        );

        emit LiquidityRemoved(tokenId, collectedMainToken, collected0, collected1);
    }

    /**
     * @notice Collect accumulated fees for a given position.
     * @param tokenId ID of the position NFT.
     * @param user Address to which user’s share of fees should be sent.
     * @param previousCollected0 Amount of token0 fees previously collected.
     * @param previousCollected1 Amount of token1 fees previously collected.
     * @param companyTax Basis point percentage of fees to allocate to the company.
     * @param send If true, fees are converted and sent; if false, fees are approved back to the vault.
     * @return collected0 Newly collected token0 fees.
     * @return collected1 Newly collected token1 fees.
     * @return companyFees Amount of fees in main token allocated to the company.
     */
    function collectFeesFromPosition(
        uint256 tokenId,
        address user,
        uint256 previousCollected0,
        uint256 previousCollected1,
        uint256 companyTax,
        bool send
    ) public onlyLiquidityManager notEmergency returns (uint256 collected0, uint256 collected1, uint256 companyFees) {
        address _vaultManagerInstance = _vaultManager();
        INonfungiblePositionManager _nfpmInstance = INonfungiblePositionManager(_nfpm());
        IOracleSwapUpgradeable _oracleSwapInstance = IOracleSwapUpgradeable(_oracleSwap());

        (,, address token0Address, address token1Address, uint24 fee,,,,,,,) = _nfpmInstance.positions(tokenId);

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        uint256 balance0BeforeCollect = token0.balanceOf(address(this));
        uint256 balance1BeforeCollect = token1.balanceOf(address(this));
        
        _nfpmInstance.collect(collectParams);

        collected0 = token0.balanceOf(address(this)) - balance0BeforeCollect;
        collected1 = token1.balanceOf(address(this)) - balance1BeforeCollect;

        uint256 actualPreviousCollected0 = 0;
        if (previousCollected0 > 0) {
            uint256 balance0Before = token0.balanceOf(address(this));
            token0.safeTransferFrom(_vaultManagerInstance, address(this), previousCollected0);
            actualPreviousCollected0 = token0.balanceOf(address(this)) - balance0Before;
        }

        uint256 actualPreviousCollected1 = 0;
        if (previousCollected1 > 0) {
            uint256 balance1Before = token1.balanceOf(address(this));
            token1.safeTransferFrom(_vaultManagerInstance, address(this), previousCollected1);
            actualPreviousCollected1 = token1.balanceOf(address(this)) - balance1Before;
        }

        uint256 totalCollected0 = collected0 + actualPreviousCollected0;
        uint256 totalCollected1 = collected1 + actualPreviousCollected1;

        emit FeesCollected(tokenId, collected0, collected1);

        if (send) {
            uint256 companyTax0 = (totalCollected0 * companyTax) / _BP();
            uint256 companyTax1 = (totalCollected1 * companyTax) / _BP();
            uint256 userTax0 = totalCollected0 - companyTax0;
            uint256 userTax1 = totalCollected1 - companyTax1;

            if (totalCollected0 > 0) {
                token0.safeIncreaseAllowance(address(_oracleSwapInstance), totalCollected0);
            }
            if (totalCollected1 > 0) {
                token1.safeIncreaseAllowance(address(_oracleSwapInstance), totalCollected1);
            }

            if (userTax0 > 0 || userTax1 > 0) {
                _oracleSwapInstance.convertToMainTokenAndSend(user, userTax0, userTax1, token0Address, token1Address, fee);
            }

            companyFees = (companyTax0 > 0 || companyTax1 > 0)
                ? _oracleSwapInstance.convertToMainTokenAndSend(
                    _vaultManagerInstance, companyTax0, companyTax1, token0Address, token1Address, fee
                )
                : 0;
        } else {
            if (collected0 > 0) {
                token0.safeIncreaseAllowance(_vaultManagerInstance, collected0);
            }
            if (collected1 > 0) {
                token1.safeIncreaseAllowance(_vaultManagerInstance, collected1);
            }
        }
    }

    /**
     * @notice Move the tick range of an existing position in a single call.
     * @param manager Address of the position manager.
     * @param tokenId ID of the existing position NFT.
     * @param tickLower New lower tick boundary.
     * @param tickUpper New upper tick boundary.
     * @return newTokenId ID of the newly minted position NFT.
     * @return cumulatedFee0 Total token0 fees collected prior to migration.
     * @return cumulatedFee1 Total token1 fees collected prior to migration.
     */
    function moveRangeOfPosition(address manager, uint256 tokenId, int24 tickLower, int24 tickUpper)
        external
        onlyLiquidityManager
        notEmergency
        returns (uint256 newTokenId, uint256 cumulatedFee0, uint256 cumulatedFee1, uint256 returnToken0, uint256 returnToken1)
    {
        address _vaultManagerInstance = _vaultManager();

        (cumulatedFee0, cumulatedFee1,) = collectFeesFromPosition(tokenId, manager, 0, 0, 0, false);
        (uint256 collected0, uint256 collected1, address token0Address, address token1Address, uint24 fee) = _decreaseAndCollect(tokenId, uint128(_BP()));

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        MintResult memory _mintResult =
            _mint(token0Address, token1Address, fee, tickLower, tickUpper, collected0, collected1, _vaultManagerInstance);

        uint256 _returnToken0 = _mintResult.actualReturnToken0;
        uint256 _returnToken1 = _mintResult.actualReturnToken1;

        if (_returnToken0 > 0) {
            token0.safeIncreaseAllowance(_vaultManagerInstance, _returnToken0);
        }
        if (_returnToken1 > 0) {
            token1.safeIncreaseAllowance(_vaultManagerInstance, _returnToken1);
        }

        newTokenId = _mintResult.tokenId;
        returnToken0 = _returnToken0;
        returnToken1 = _returnToken1;
        emit PositionMigrated(tokenId, newTokenId, cumulatedFee0, cumulatedFee1);
    }
}
