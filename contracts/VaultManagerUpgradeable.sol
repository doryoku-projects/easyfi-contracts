// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "./UserAccessControl.sol";
import "./errors/VaultManagerErrors.sol";

import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IUserManagerUpgradeable.sol";
import "./interfaces/ILiquidityManagerUpgradeable.sol";
import "./interfaces/IProtocolConfigUpgradeable.sol";
import "./interfaces/IFundsManagerUpgradeable.sol";

/**
 * @title VaultManagerUpgradeable
 * @notice This contract is responsible of managing the vaults and liquidity positions for users.
 * It allows users to mint, increase, decrease, and collect fees from their liquidity positions.
 */
contract VaultManagerUpgradeable is UUPSUpgradeable, UserAccessControl, VaultManagerErrors, IERC721Receiver {
    using SafeERC20 for IERC20;

    IProtocolConfigUpgradeable private s_config;

    bytes32 private constant CFG_LIQUIDITY_MANAGER = keccak256("LiquidityManager");
    bytes32 private constant CFG_NFPM = keccak256("NFTPositionMgr");
    bytes32 private constant CFG_MAIN_TOKEN = keccak256("MainToken");
    bytes32 private constant CFG_COMPANY_FEE_PCT = keccak256("CompanyFeePct");
    bytes32 private constant CFG_AGGREGATOR = keccak256("Aggregator");
    bytes32 private constant CFG_FUNDS_MANAGER = keccak256("FundsManager");
    bytes32 private constant BP_KEY = keccak256("BP");

    uint256 private s_companyFees;
    uint256 private s_maxWithdrawalSize;

    struct UserInfo {
        uint256 tokenId;
        address token0;
        address token1;
        int128 tickLower;
        int128 tickUpper;
        uint256 feeToken0;
        uint256 feeToken1;
        uint256 collectedFees;
        uint256 depositLiquidity;
    }

    struct PackageInfo {
        uint256 packageId;
        uint256 liquidityCapLimit;
        uint256 feeCapLimit;
        uint256 userFeePct;
    }

    mapping(address => mapping( uint256 => mapping(bytes32 => UserInfo))) private userInfo;
    mapping(address =>  mapping(uint256 => PackageInfo)) private packageInfo;

    mapping(address => mapping(bytes32 => mapping(uint256 => uint256))) collectedFeesByPackages;

    bytes32 private constant CFG_CLIENT_ADDRESS = keccak256("ClientAddress");
    bytes32 private constant CFG_CLIENT_FEE_PCT = keccak256("ClientFeePct");


    event ERC721Deposited(address indexed user, uint256 tokenId);
    event WithdrawCompanyFees(uint256 clientFee, uint256 companyFee);
    event ProtocolConfigSet();
    event UserManagerSet();
    event UserInfoReset(address indexed user);
    event EmergencyERC20BatchWithdrawal(address indexed to);
    event EmergencyERC721BatchWithdrawal(address indexed to);
    event UserPackageUpdated(address indexed user, uint256 packageId);
    event Withdrawn(address indexed user, uint256 amount);
    event LiquidityEvent(address indexed user, uint256 indexed packageId, uint256 amount);


    function initialize(address _protocolConfig, address _userManager, uint256 _maxWithdrawalSize) public initializer {
        if (_protocolConfig == address(0) || _userManager == address(0)) {
            revert VM_ZERO_ADDRESS();
        }
        if (_maxWithdrawalSize == 0) {
            revert VM_ZERO_MAX_WITHDRAWAL_SIZE();
        }
        __UUPSUpgradeable_init();

        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_userManager = IUserManagerUpgradeable(_userManager);
        s_maxWithdrawalSize = _maxWithdrawalSize;
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
     * @dev Basic points(BP) instance from central config.
     */
    function _BP() internal view returns (uint256) {
        return s_config.getUint(BP_KEY);
    }

    /**
     * @notice setMaxWithdrawalSize
     * @dev This function sets the maximum size of the withdrawals for a batch.
     */
    function setMaxWithdrawalSize(uint256 _maxWithdrawalSize) external onlyMasterAdmin {
        if (_maxWithdrawalSize == 0) return;
        s_maxWithdrawalSize = _maxWithdrawalSize;
    }

    /**
     * @notice Set the address of the new ProtocolConfig contract.
     * @param _newProtocolConfig Address of the new ProtocolConfig contract.
     */
    function setProtocolConfigAddress(address _newProtocolConfig) public onlyMasterAdmin returns (bool) {
        if (_newProtocolConfig == address(0)) revert VM_ZERO_ADDRESS();
        if (_newProtocolConfig == address(s_config)) {
            revert VM_ADDRESS_UNCHANGED();
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
        if (_newUserManagerAddress == address(0)) revert VM_ZERO_ADDRESS();
        if (_newUserManagerAddress == address(s_userManager)) {
            revert VM_ADDRESS_UNCHANGED();
        }

        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
        emit UserManagerSet();
        return true;
    }

    /**
     * @notice Returns the company fee percentage.
     * @return uint256 fee percentage.
     */
    function getCompanyFeePct() external view onlyGeneralOrMasterAdmin returns (uint256) {
        return s_config.getUint(CFG_COMPANY_FEE_PCT);
    }

    /**
     * @notice Returns the client fee percentage.
     * @return uint256 fee percentage.
     */
    function getClientFeePct() external view onlyGeneralOrMasterAdmin returns (uint256) {
        return s_config.getUint(CFG_CLIENT_FEE_PCT);
    }

    /**
     * @notice Returns the client address.
     * @return address client address.
     */
    function getClient() external view onlyGeneralOrMasterAdmin returns (address) {
        return s_config.getAddress(CFG_CLIENT_ADDRESS);
    }

    /**
     * @notice Function for obtaining the company fees.
     * @return companyFees Company fees.
     */
    function getCompanyFees() external view onlyGeneralOrMasterAdmin returns (uint256) {
        return s_companyFees;
    }

    /**
     * @notice Retrieve stored user position info for a given pool.
     * @param user Address of the user.
     * @param poolId Identifier of the pool.
     * @return _userInfo Struct containing the user's position details.
     */
    function getUserInfo(address user, string calldata poolId, uint256 packageId)
        external
        view
        onlyVaultManager
        returns (UserInfo memory _userInfo)
    {
        _userInfo = userInfo[user][packageId][_formatPoolId(poolId)];
    }

       /**
     * @notice Retrieve stored user position info for a given pool.
     * @param user Address of the user.
     * @return _packageInfo Struct containing the user's package details.
     */
    function getUserPackageInfo(address user, uint256 package_Id)
        external
        view
        onlyVaultManager
        returns (PackageInfo memory _packageInfo)
    {
        _packageInfo = packageInfo[user][package_Id];
    }

    /**
     * @notice Retrieve stored user position info for a given pool.
     * @param user Address of the user.
     * @param poolId Identifier of the pool.
     * @param packageId Identifier of the pool.
     * @return uint256 collected fee
     */
    function getCollectedFeesByPackage(address user, string calldata poolId, uint256 packageId)
        external
        view
        returns (uint256)
    {
        return collectedFeesByPackages[user][_formatPoolId(poolId)][packageId];
    }
    /**
     * @notice Format a pool identifier string as a bytes32 key.
     * @param poolId The pool identifier.
     * @return The keccak256 hash of the encoded poolId.
     */
    function _formatPoolId(string calldata poolId) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId));
    }

    /**
     * @notice Returns the liquidity manager interface.
     * @return ILiquidityManagerUpgradeable instance.
     */
    function _liquidityManager() internal view returns (ILiquidityManagerUpgradeable) {
        return ILiquidityManagerUpgradeable(s_config.getAddress(CFG_LIQUIDITY_MANAGER));
    }

    /**
     * @notice Returns the Nonfungible Position Manager instance.
     * @return INonfungiblePositionManager instance.
     */
    function _nfpm() internal view returns (INonfungiblePositionManager) {
        return INonfungiblePositionManager(s_config.getAddress(CFG_NFPM));
    }

    /**
     * @notice Returns the main token contract instance.
     * @return IERC20 instance.
     */
    function _mainToken() internal view returns (IERC20) {
        return IERC20(s_config.getAddress(CFG_MAIN_TOKEN));
    }

    /**
     * @notice Returns the company fee percentage.
     * @return uint256 fee percentage.
     */
    function _companyFeePct(address user, uint256 package_Id) internal view returns (uint256) {
        uint256 companyFeePct = _BP() - packageInfo[user][package_Id].userFeePct;
        return companyFeePct;
    }

    /**
     * @notice Returns the client fee percentage.
     * @return uint256 fee percentage.
     */
    function _clientFeePct() internal view returns (uint256) {
        return s_config.getUint(CFG_CLIENT_FEE_PCT);
    }

    /**
     * @notice Returns the aggregator address.
     * @return address aggregator.
     */
    function _aggregator() internal view returns (address) {
        return s_config.getAddress(CFG_AGGREGATOR);
    }

    /**
     * @notice Returns the Vault address.
     * @return address fundsManager.
     */
    function _fundsManager() internal view returns (address) {
        return s_config.getAddress(CFG_FUNDS_MANAGER);
    }

    /**
     * @notice Returns the client address.
     * @return address client.
     */
    function _client() internal view returns (address) {
        return s_config.getAddress(CFG_CLIENT_ADDRESS);
    }

    /**
     * @dev Reset stored user position info for a pool to defaults.
     * @param user Address of the user.
     * @param poolId Identifier of the pool.
     */
    function _resetUserInfo(address user, string calldata poolId, uint256 packageId) internal {
        bytes32 poolIdHash = _formatPoolId(poolId);
        UserInfo storage userPosition = userInfo[user][packageId][poolIdHash];

        userPosition.tokenId = 0;
        userPosition.token0 = address(0);
        userPosition.token1 = address(0);
        userPosition.tickLower = 0;
        userPosition.tickUpper = 0;
        userPosition.feeToken0 = 0;
        userPosition.feeToken1 = 0;
        emit UserInfoReset(user);
    }

    /**
     * @dev Checks if a user's deposit for a pool would exceed their liquidity cap.
     * @param user Address of the user whose cap is being checked.
     * @param poolId Identifier of the pool for which the deposit is made.
     * @param amount Amount of liquidity the user wants to add.
     */
    function _checkLiquidityCap(
        address user, 
        string calldata poolId, 
        uint256 packageId,
        uint256 amount
    ) internal view {
        if (packageInfo[user][packageId].liquidityCapLimit != 0) {
            uint256 newTotal = userInfo[user][packageId][_formatPoolId(poolId)].depositLiquidity + amount;

            if (newTotal > packageInfo[user][packageId].liquidityCapLimit) {
                revert VM_PACKAGE_LIQUIDITY_CAP_EXCEEDED();
            }
        } else {
            revert VM_LIQUIDITY_CAP_NOT_SET();
        }
    }


    /**
     * @notice Mint a new position or increase liquidity on an existing one via LiquidityManager.
     * @param poolId Identifier of the pool.
     * @param token0Address Address of token0.
     * @param token1Address Address of token1.
     * @param fee Fee tier of the pool.
     * @param tickLower Lower tick boundary.
     * @param tickUpper Upper tick boundary.
     * @param amountMainTokenDesired Amount of main token to deposit.
     * @param userAddress Address of the user.
     * @return tokenId ID of the minted or updated position.
     */
    function mintOrIncreaseLiquidityPosition(
        string calldata poolId,
        uint256 packageId,
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountMainTokenDesired,
        address userAddress
    ) external onlyVaultManager notEmergency returns (uint256 tokenId) {
        _checkLiquidityCap(userAddress, poolId, packageId, amountMainTokenDesired);
        IERC20 mainToken = _mainToken();

        uint256 balanceBefore = mainToken.balanceOf(address(this));
        mainToken.safeTransferFrom(_aggregator(), address(this), amountMainTokenDesired);
        uint256 actualReceived = mainToken.balanceOf(address(this)) - balanceBefore;

        mainToken.safeIncreaseAllowance(address(_liquidityManager()), actualReceived);

        bytes32 poolIdHash = _formatPoolId(poolId);

        UserInfo storage _userInfo = userInfo[userAddress][packageId][poolIdHash];

        if (_userInfo.tokenId != 0) {
            if (
                !(
                    _userInfo.tickLower == tickLower
                        && _userInfo.tickUpper == tickUpper
                )
            ) revert VM_RANGE_MISMATCH();
            
            if (_userInfo.token0 != token0Address && _userInfo.token1 != token1Address) revert VM_TOKEN_MISMATCH();
            
            tokenId =
                _increaseLiquidityToPosition(_userInfo.tokenId, actualReceived, userAddress);
        } else {
            tokenId = _mintPosition(
                poolId, packageId, token0Address, token1Address, fee, tickLower, tickUpper, actualReceived, userAddress
            );
        }
        _userInfo.depositLiquidity += actualReceived;
        emit LiquidityEvent (userAddress, packageId, amountMainTokenDesired);
    }

    /**
     * @dev Internal: mint a new position for a user.
     * @param poolId Identifier of the pool.
     * @param token0Address Address of token0.
     * @param token1Address Address of token1.
     * @param fee Fee tier of the pool.
     * @param tickLower Lower tick boundary.
     * @param tickUpper Upper tick boundary.
     * @param amountMainTokenDesired Amount of main token to deposit.
     * @param userAddress Address of the user.
     * @return tokenId ID of the newly minted position.
     */
    function _mintPosition(
        string calldata poolId,
        uint256 packageId,
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountMainTokenDesired,
        address userAddress
    ) internal returns (uint256) {
        bytes32 poolIdHash = _formatPoolId(poolId);

        if (userInfo[userAddress][packageId][poolIdHash].tokenId != 0) {
            revert VM_ALREADY_HAS_POSITION();
        }

        ILiquidityManagerUpgradeable.MintResult memory _mintResult = _liquidityManager().mintPosition(
            token0Address, token1Address, fee, tickLower, tickUpper, amountMainTokenDesired, userAddress, true
        );
        uint256 tokenId = _mintResult.tokenId;

        UserInfo storage userData = userInfo[userAddress][packageId][poolIdHash];        
        userData.tokenId = tokenId;
        userData.token0 = token0Address;
        userData.token1 = token1Address;
        userData.tickLower = int128(tickLower);
        userData.tickUpper = int128(tickUpper);
        userData.feeToken0 = 0;
        userData.feeToken1 = 0;

        _nfpm().approve(address(0), tokenId);

        emit ERC721Deposited(userAddress, tokenId);
        return tokenId;
    }

    /**
     * @dev Internal: increase liquidity on an existing position.
     * @param tokenId ID of the position.
     * @param amountMainTokenDesired Amount of main token to add.
     * @param userAddress Address of the user.
     * @return tokenId Same ID of the position after increase.
     */
    function _increaseLiquidityToPosition(uint256 tokenId, uint256 amountMainTokenDesired, address userAddress)
        internal
        returns (uint256)
    {
        _liquidityManager().increaseLiquidityPosition(tokenId, amountMainTokenDesired, userAddress);

        return tokenId;
    }

    /**
     * @notice Decrease or withdraw a percentage of liquidity for a user’s position.
     * @param user Address of the position owner.
     * @param poolId Identifier of the pool.
     * @param percentageToRemove Percentage of liquidity to remove (basis points).
     */
    function decreaseLiquidityPosition(address user, string calldata poolId, uint256 packageId, uint128 percentageToRemove, bool isAdmin)
        external
        onlyVaultManager
        notEmergency
    {
        uint256 _companyFeePctInstance = _companyFeePct(user, packageId);
        INonfungiblePositionManager _nfpmInstance = _nfpm();
        ILiquidityManagerUpgradeable _liquidityManagerInstance = _liquidityManager();

        bytes32 poolIdHash = _formatPoolId(poolId);
        if (userInfo[user][packageId][poolIdHash].tokenId == 0) revert VM_NO_POSITION();

        uint256 tokenId = userInfo[user][packageId][poolIdHash].tokenId;

        (,, address token0Address, address token1Address,,,,,,,,) = _nfpmInstance.positions(tokenId);

        _nfpmInstance.approve(address(_liquidityManagerInstance), tokenId);

        bool send;

        // If the user wants to withdraw all their liquidity, we collect the fees first
        if (percentageToRemove == _BP()) {
            send = true;
            uint256 storedFee0 = userInfo[user][packageId][poolIdHash].feeToken0;
            uint256 storedFee1 = userInfo[user][packageId][poolIdHash].feeToken1;

            IERC20 token0 = IERC20(token0Address);
            IERC20 token1 = IERC20(token1Address);

            if (storedFee0 > 0) {
                token0.safeIncreaseAllowance(address(_liquidityManagerInstance), storedFee0);
            }

            if (storedFee1 > 0) {
                token1.safeIncreaseAllowance(address(_liquidityManagerInstance), storedFee1);
            }

            (, , uint256 companyTax, uint256 collectedMainToken) = ILiquidityManagerUpgradeable(address(_liquidityManagerInstance))
            .collectFeesFromPosition(tokenId, isAdmin ? _fundsManager() : user, storedFee0, storedFee1, _companyFeePctInstance, send);
            _updateFees(user, poolIdHash, packageId, collectedMainToken);
            s_companyFees += companyTax;
        } else {
            (uint256 collected0, uint256 collected1, ,) = ILiquidityManagerUpgradeable(address(_liquidityManagerInstance))
                .collectFeesFromPosition(tokenId, user, 0, 0, _companyFeePctInstance, send);

            uint256 actualCollected0 = 0;
            if (collected0 > 0) {
                uint256 balance0Before = IERC20(token0Address).balanceOf(address(this));
                IERC20(token0Address).safeTransferFrom(address(_liquidityManagerInstance), address(this), collected0);
                actualCollected0 = IERC20(token0Address).balanceOf(address(this)) - balance0Before;
            }

            uint256 actualCollected1 = 0;
            if (collected1 > 0) {
                uint256 balance1Before = IERC20(token1Address).balanceOf(address(this));
                IERC20(token1Address).safeTransferFrom(address(_liquidityManagerInstance), address(this), collected1);
                actualCollected1 = IERC20(token1Address).balanceOf(address(this)) - balance1Before;
            }

            userInfo[user][packageId][poolIdHash].feeToken0 += actualCollected0;
            userInfo[user][packageId][poolIdHash].feeToken1 += actualCollected1;
        }

        uint256 currentDeposit = userInfo[user][packageId][poolIdHash].depositLiquidity;
        if (currentDeposit > 0) {
            uint256 reduction = (currentDeposit * percentageToRemove) / _BP();
            if (percentageToRemove == _BP()) {
                userInfo[user][packageId][poolIdHash].depositLiquidity = 0;
            } else {
                userInfo[user][packageId][poolIdHash].depositLiquidity = currentDeposit - reduction;
            }
        }
        uint256 removedAmount = _liquidityManagerInstance.decreaseLiquidityPosition(tokenId, percentageToRemove, isAdmin ? _fundsManager() : user, false);   
        if(isAdmin) _updateFees(user, poolIdHash, packageId, removedAmount);
        percentageToRemove == _BP() ? _resetUserInfo(user, poolId, packageId) : _nfpm().approve(address(0), tokenId);
        
        emit LiquidityEvent (user, packageId, removedAmount);
    }

    /**
     * @notice Collect accumulated fees for a user’s position.
     * @param user Address of the position owner.
     * @param poolId Identifier of the pool.
     * @return collectedToken0 Total token0 fees collected.
     * @return collectedToken1 Total token1 fees collected.
     */
    function collectFees(address user, string calldata poolId, uint256 packageId)
        external
        onlyVaultManager
        notEmergency
        returns (uint256 collectedToken0, uint256 collectedToken1)
    {
        INonfungiblePositionManager _nfpmInstance = _nfpm();
        ILiquidityManagerUpgradeable _liquidityManagerInstance = _liquidityManager();

        bytes32 poolIdHash = _formatPoolId(poolId);
        uint256 tokenId = userInfo[user][packageId][poolIdHash].tokenId;
        if (tokenId == 0) revert VM_NO_POSITION();

        (,, address token0Address, address token1Address,,,,,,,,) = _nfpmInstance.positions(tokenId);

        uint256 storedFee0 = userInfo[user][packageId][poolIdHash].feeToken0;
        uint256 storedFee1 = userInfo[user][packageId][poolIdHash].feeToken1;

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        token0.safeIncreaseAllowance(address(_liquidityManagerInstance), storedFee0);

        token1.safeIncreaseAllowance(address(_liquidityManagerInstance), storedFee1);

        _nfpmInstance.approve(address(_liquidityManagerInstance), tokenId);

        (uint256 lmCollected0, uint256 lmCollected1, uint256 companyTax,) =
            _liquidityManagerInstance.collectFeesFromPosition(tokenId, user, storedFee0, storedFee1, _companyFeePct(user, packageId), true);

        s_companyFees += companyTax;

        _nfpmInstance.approve(address(0), tokenId);

        userInfo[user][packageId][poolIdHash].feeToken0 = 0;
        userInfo[user][packageId][poolIdHash].feeToken1 = 0;

        collectedToken0 = lmCollected0 + storedFee0;
        collectedToken1 = lmCollected1 + storedFee1;

        emit LiquidityEvent (user, packageId, 0);
    }

    /**
     * @notice Handle incoming ERC721 tokens from NFPM.
     * @dev Called by the NonfungiblePositionManager on safeTransfer.
     * @param operator Address initiating the transfer.
     */
    function onERC721Received(address operator, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(_nfpm())) {
            revert VM_ON_RECEIVE_INVALID_SENDER();
        }

        if (operator != address(_liquidityManager())) {
            revert VM_ON_RECEIVE_INVALID_OPERATOR();
        }

        return this.onERC721Received.selector;
    }

    /**
     * @notice Migrate a user’s position to a new tick range.
     * @param user Address of the position owner.
     * @param manager Address authorized to manage the position.
     * @param poolId Identifier of the pool.
     * @param tickLower New lower tick boundary.
     * @param tickUpper New upper tick boundary.
     * @return newTokenId ID of the newly minted position NFT.
     */
    function migratePosition(address user, address manager, string calldata poolId, uint256 packageId, int24 tickLower, int24 tickUpper)
        external
        onlyVaultManager
        notEmergency
        returns (uint256 newTokenId)
    {
        INonfungiblePositionManager _nfpmInstance = _nfpm();
        ILiquidityManagerUpgradeable _liquidityManagerInstance = _liquidityManager();

        bytes32 poolIdHash = _formatPoolId(poolId);
        uint256 tokenId = userInfo[user][packageId][poolIdHash].tokenId;

        if (tokenId == 0) revert VM_NO_POSITION();

        if (!(userInfo[user][packageId][poolIdHash].tickLower != tickLower || userInfo[user][packageId][poolIdHash].tickUpper != tickUpper)) {
            revert VM_SAME_TICK_RANGE();
        }

        (,, address token0Address, address token1Address,,,,,,,,) = _nfpmInstance.positions(tokenId);

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        _nfpmInstance.approve(address(_liquidityManagerInstance), tokenId);

        (uint256 _newTokenId, uint256 cumulatedFee0, uint256 cumulatedFee1, uint256 returnToken0, uint256 returnToken1) =
            _liquidityManagerInstance.moveRangeOfPosition(manager, tokenId, tickLower, tickUpper);

        uint256 actualCumulatedFee0 = 0;
        if (cumulatedFee0 > 0) {
            uint256 balance0Before = token0.balanceOf(address(this));
            token0.safeTransferFrom(address(_liquidityManagerInstance), address(this), cumulatedFee0);
            actualCumulatedFee0 = token0.balanceOf(address(this)) - balance0Before;
        }

        uint256 actualCumulatedFee1 = 0;
        if (cumulatedFee1 > 0) {
            uint256 balance1Before = token1.balanceOf(address(this));
            token1.safeTransferFrom(address(_liquidityManagerInstance), address(this), cumulatedFee1);
            actualCumulatedFee1 = token1.balanceOf(address(this)) - balance1Before;
        }

        userInfo[user][packageId][poolIdHash].tokenId = _newTokenId;
        userInfo[user][packageId][poolIdHash].tickLower = tickLower;
        userInfo[user][packageId][poolIdHash].tickUpper = tickUpper;
        userInfo[user][packageId][poolIdHash].feeToken0 += actualCumulatedFee0 + returnToken0;
        userInfo[user][packageId][poolIdHash].feeToken1 += actualCumulatedFee1 + returnToken1;

        _nfpmInstance.approve(address(0), _newTokenId);

        newTokenId = _newTokenId;
        emit LiquidityEvent (user, packageId, 0);

    }

    /**
     * @notice Withdraw a percentage of the company’s accumulated fees.
     * @param to Recipient address.
     */
     // all uniswap fees are in the name of company fees, so this function is used to withdraw them
    function withdrawCompanyFees(address to) external onlyMasterAdmin {
        uint256 _clientPercentage = _clientFeePct();
        address _clientAddress = _client();
        IERC20 _mainTokenInstance = _mainToken();
        
        if (s_companyFees == 0) revert VM_COMPANY_FEES_ZERO();
        if (_clientAddress == address(0)) revert VM_ZERO_ADDRESS();
        if (_clientPercentage == 0) revert VM_COMPANY_FEES_ZERO();

        uint256 amountToWithdrawForCompany;
        uint256 amountToWithdrawForClient;
        
        //If the company has fees, we withdraw a percentage of them
        if (s_companyFees > 0) {
            amountToWithdrawForClient = (s_companyFees * _clientPercentage) / _BP();

            if (amountToWithdrawForClient < 1) revert VM_COMPANY_FEES_ZERO();
            
            amountToWithdrawForCompany = s_companyFees - amountToWithdrawForClient;

            s_companyFees -= (amountToWithdrawForCompany + amountToWithdrawForClient);

            _mainTokenInstance.safeTransfer(to, amountToWithdrawForCompany);
            _mainTokenInstance.safeTransfer(_clientAddress, amountToWithdrawForClient);
        }
        emit WithdrawCompanyFees(amountToWithdrawForClient,amountToWithdrawForCompany);
    }

    function decreasePositionAndWithdrawFees(address user, string calldata poolId, uint256 packageId) 
        external
        onlyGeneralAdmin
        notEmergency
    {
        this.decreaseLiquidityPosition(user, poolId, packageId, uint128(_BP()), true);
    }

    /**
     * @notice Emergency batch withdrawal of multiple ERC20 tokens.
     * @param tokens Array of token addresses.
     * @param to Recipient address.
     */
    function emergencyERC20BatchWithdrawal(address[] calldata tokens, address to) external onlyMasterAdmin onEmergency {
        if (tokens.length > s_maxWithdrawalSize) revert VM_ARRAY_SIZE_LIMIT_EXCEEDED("tokens", tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(tokens[i]).safeTransfer(to, balance);
            }
        }
        emit EmergencyERC20BatchWithdrawal(to);
    }

    /**
     * @notice Emergency batch withdrawal of Uniswap V3 NFT positions.
     * @param nftContract Address of the ERC721 contract.
     * @param tokenIds Array of token IDs to withdraw.
     * @param to Recipient address.
     */
    function emergencyERC721BatchWithdrawal(address nftContract, uint256[] calldata tokenIds, address to)
        external
        onlyMasterAdmin
        onEmergency
    {
        if (tokenIds.length > s_maxWithdrawalSize) revert VM_ARRAY_SIZE_LIMIT_EXCEEDED("tokenIds", tokenIds.length);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            if (IERC721(nftContract).ownerOf(tokenId) == address(this)) {
                IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
            }
        }
        emit EmergencyERC721BatchWithdrawal(to);
    }

    /**
     * @notice setUserPackage
     * @param user Address of the user..
     * @param packageId Identifier of the Package.
     */

    function setUserPackage(address user, uint256 packageId) external onlyGeneralOrMasterAdmin {
        IProtocolConfigUpgradeable.CapInfo memory capInfo = s_config.getPackageCap(packageId);
        if (capInfo.liquidityCap == 0 && capInfo.feeCap == 0) {
            revert VM_INVALID_PACKAGE_ID();
        }
        PackageInfo storage package = packageInfo[user][packageId];
        if (package.packageId  == packageId) {
            revert VM_USER_PACKAGE_ALREADY_EXIST();
        }
        package.liquidityCapLimit = capInfo.liquidityCap;
        package.feeCapLimit = capInfo.feeCap;
        package.packageId = packageId;
        package.userFeePct = capInfo.userFeesPct;
        emit UserPackageUpdated(user, packageId);
    }

    /**
     * @notice updateFees
     * @param user Address of the position owner.
     * @param poolIdHash Identifier of the pool.
     * @param amount Collected Fees from the position.
     */
    function _updateFees(address user, bytes32 poolIdHash, uint256 packageId, uint256 amount) internal {
        UserInfo storage _userInfo = userInfo[user][packageId][poolIdHash];
        PackageInfo storage _packageInfo = packageInfo[user][packageId];
        _userInfo.collectedFees += amount;
        collectedFeesByPackages[user][poolIdHash][_packageInfo.packageId] += amount;
    }

    /**
     * @notice withdrawFunds
     * @param user Address of the user.
     * @param poolId Identifier of the pool.
     */
    function withdrawFunds(address user, string calldata poolId, uint256 packageId) 
        external
        onlyVaultManager
        notEmergency 
    {
        UserInfo storage _userInfo = userInfo[user][packageId][_formatPoolId(poolId)];
        uint256 amount  = _userInfo.collectedFees;
        _userInfo.collectedFees = 0;
        IFundsManagerUpgradeable(_fundsManager()).withdrawFunds(user, address(_mainToken()), amount);
    }

    function setPackageCap( uint256 _liquidityCap, uint256 _feeCap, uint256 _userFeesPct ) external onlyGeneralOrMasterAdmin {
       if (_userFeesPct > _BP()) revert VM_PERCENTAGE_OVERFLOW();
       s_config.setPackageCap(_liquidityCap, _feeCap, _userFeesPct);
    }

    function updatePackageCap( uint256 _packageId, uint256 _liquidityCap, uint256 _feeCap, uint256 _userFeesPct ) external onlyGeneralOrMasterAdmin {
       if (_userFeesPct > _BP()) revert VM_PERCENTAGE_OVERFLOW();
       s_config.updatePackageCap(_packageId, _liquidityCap, _feeCap, _userFeesPct);
    }


}

