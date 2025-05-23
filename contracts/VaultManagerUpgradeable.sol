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

/**
 * @title VaultManagerUpgradeable
 * @notice This contract is responsible of managing the vaults and liquidity positions for users.
 * It allows users to mint, increase, decrease, and collect fees from their liquidity positions.
 */
contract VaultManagerUpgradeable is UserAccessControl, VaultManagerErrors {
    using SafeERC20 for IERC20;

    IProtocolConfigUpgradeable private s_config;

    bytes32 private constant CFG_LIQUIDITY_MANAGER = keccak256("LiquidityManager");
    bytes32 private constant CFG_NFPM = keccak256("NFTPositionMgr");
    bytes32 private constant CFG_MAIN_TOKEN = keccak256("MainToken");
    bytes32 private constant CFG_COMPANY_FEE_PCT = keccak256("CompanyFeePct");
    bytes32 private constant CFG_AGGREGATOR = keccak256("Aggregator");

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
    }

    mapping(address => mapping(bytes32 => UserInfo)) private userInfo;

    event ERC721Deposited(address indexed user, uint256 tokenId);
    event WithDrawCompanyFees(uint256 amount);

    function initialize(address _protocolConfig, address _userManager, uint256 _maxWithdrawalSize) public initializer {
        __UUPSUpgradeable_init();

        s_config = IProtocolConfigUpgradeable(_protocolConfig);
        s_userManager = IUserManagerUpgradeable(_userManager);
        s_userManagerAddress = _userManager;
        s_maxWithdrawalSize = _maxWithdrawalSize;
    }

    /**
     * @dev Required function for UUPS upgradeable contracts to authorize upgrades.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyMasterAdmin {}

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
        return true;
    }

    /**
     * @notice Set the address of the new UserManager.
     * @param _newUserManagerAddress Address of the new UserManager.
     */
    function setUserManagerAddress(address _newUserManagerAddress) public onlyGeneralOrMasterAdmin returns (bool) {
        if (_newUserManagerAddress == address(0)) revert VM_ZERO_ADDRESS();
        if (_newUserManagerAddress == s_userManagerAddress) {
            revert VM_ADDRESS_UNCHANGED();
        }

        s_userManagerAddress = _newUserManagerAddress;
        s_userManager = IUserManagerUpgradeable(_newUserManagerAddress);
        return true;
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
     * @return userInformation Struct containing the user's position details.
     */
    function getUserInfo(address user, string calldata poolId)
        external
        view
        onlyVaultManager
        returns (UserInfo memory userInformation)
    {
        userInformation = userInfo[user][_formatPoolId(poolId)];
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
    function _companyFeePct() internal view returns (uint256) {
        return s_config.getUint(CFG_COMPANY_FEE_PCT);
    }

    /**
     * @notice Returns the aggregator address.
     * @return address aggregator.
     */
    function _aggregator() internal view returns (address) {
        return s_config.getAddress(CFG_AGGREGATOR);
    }

    /**
     * @dev Reset stored user position info for a pool to defaults.
     * @param user Address of the user.
     * @param poolId Identifier of the pool.
     */
    function _resetUserInfo(address user, string calldata poolId) internal {
        bytes32 poolIdHash = _formatPoolId(poolId);

        userInfo[user][poolIdHash].tokenId = 0;
        userInfo[user][poolIdHash].token0 = address(0);
        userInfo[user][poolIdHash].token1 = address(0);
        userInfo[user][poolIdHash].tickLower = 0;
        userInfo[user][poolIdHash].tickUpper = 0;
        userInfo[user][poolIdHash].feeToken0 = 0;
        userInfo[user][poolIdHash].feeToken1 = 0;
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
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountMainTokenDesired,
        address userAddress
    ) external onlyVaultManager notEmergency returns (uint256 tokenId) {
        IERC20 mainToken = _mainToken();

        uint256 balanceBefore = mainToken.balanceOf(address(this));
        mainToken.safeTransferFrom(_aggregator(), address(this), amountMainTokenDesired);
        uint256 actualReceived = mainToken.balanceOf(address(this)) - balanceBefore;

        mainToken.safeIncreaseAllowance(address(_liquidityManager()), actualReceived);

        bytes32 poolIdHash = _formatPoolId(poolId);

        if (userInfo[userAddress][poolIdHash].tokenId != 0) {
            if (
                !(
                    userInfo[userAddress][poolIdHash].tickLower == tickLower
                        && userInfo[userAddress][poolIdHash].tickUpper == tickUpper
                )
            ) revert VM_RANGE_MISMATCH();

            tokenId =
                _increaseLiquidityToPosition(userInfo[userAddress][poolIdHash].tokenId, actualReceived, userAddress);
        } else {
            tokenId = _mintPosition(
                poolId, token0Address, token1Address, fee, tickLower, tickUpper, actualReceived, userAddress
            );
        }
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
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountMainTokenDesired,
        address userAddress
    ) internal returns (uint256) {
        bytes32 poolIdHash = _formatPoolId(poolId);

        if (userInfo[userAddress][poolIdHash].tokenId != 0) {
            revert VM_ALREADY_HAS_POSITION();
        }

        (uint256 tokenId,,) = _liquidityManager().mintPosition(
            token0Address, token1Address, fee, tickLower, tickUpper, amountMainTokenDesired, userAddress, true
        );

        UserInfo memory newPosition = UserInfo({
            tokenId: tokenId,
            token0: token0Address,
            token1: token1Address,
            tickLower: int128(tickLower),
            tickUpper: int128(tickUpper),
            feeToken0: 0,
            feeToken1: 0
        });

        userInfo[userAddress][poolIdHash] = newPosition;

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
    function decreaseLiquidityPosition(address user, string calldata poolId, uint128 percentageToRemove)
        external
        onlyVaultManager
        notEmergency
    {
        bytes32 poolIdHash = _formatPoolId(poolId);
        if (userInfo[user][poolIdHash].tokenId == 0) revert VM_NO_POSITION();

        uint256 tokenId = userInfo[user][poolIdHash].tokenId;

        (,, address token0Address, address token1Address,,,,,,,,) = _nfpm().positions(tokenId);

        _nfpm().approve(address(_liquidityManager()), tokenId);

        bool send = false;
        uint256 collected0;
        uint256 collected1;

        if (percentageToRemove == 10000) {
            send = true;
            uint256 storedFee0 = userInfo[user][poolIdHash].feeToken0;
            uint256 storedFee1 = userInfo[user][poolIdHash].feeToken1;

            IERC20 token0 = IERC20(token0Address);
            IERC20 token1 = IERC20(token1Address);

            if (storedFee0 > 0) {
                token0.safeIncreaseAllowance(address(_liquidityManager()), storedFee0);
            }

            if (storedFee1 > 0) {
                token1.safeIncreaseAllowance(address(_liquidityManager()), storedFee1);
            }

            uint256 companyTax;

            (collected0, collected1, companyTax) = ILiquidityManagerUpgradeable(address(_liquidityManager()))
                .collectFeesFromPosition(tokenId, user, storedFee0, storedFee1, _companyFeePct(), send);

            s_companyFees += companyTax;
        } else {
            (collected0, collected1,) = ILiquidityManagerUpgradeable(address(_liquidityManager()))
                .collectFeesFromPosition(tokenId, user, 0, 0, _companyFeePct(), send);

            uint256 actualCollected0 = 0;
            if (collected0 > 0) {
                uint256 balance0Before = IERC20(token0Address).balanceOf(address(this));
                IERC20(token0Address).safeTransferFrom(address(_liquidityManager()), address(this), collected0);
                actualCollected0 = IERC20(token0Address).balanceOf(address(this)) - balance0Before;
            }

            uint256 actualCollected1 = 0;
            if (collected1 > 0) {
                uint256 balance1Before = IERC20(token1Address).balanceOf(address(this));
                IERC20(token1Address).safeTransferFrom(address(_liquidityManager()), address(this), collected1);
                actualCollected1 = IERC20(token1Address).balanceOf(address(this)) - balance1Before;
            }

            userInfo[user][poolIdHash].feeToken0 += actualCollected0;
            userInfo[user][poolIdHash].feeToken1 += actualCollected1;
        }

        _liquidityManager().decreaseLiquidityPosition(tokenId, percentageToRemove, user, false);

        percentageToRemove == 10000 ? _resetUserInfo(user, poolId) : _nfpm().approve(address(0), tokenId);
    }

    /**
     * @notice Collect accumulated fees for a user’s position.
     * @param user Address of the position owner.
     * @param poolId Identifier of the pool.
     * @return collectedToken0 Total token0 fees collected.
     * @return collectedToken1 Total token1 fees collected.
     */
    function collectFees(address user, string calldata poolId)
        external
        onlyVaultManager
        notEmergency
        returns (uint256 collectedToken0, uint256 collectedToken1)
    {
        bytes32 poolIdHash = _formatPoolId(poolId);
        uint256 tokenId = userInfo[user][poolIdHash].tokenId;
        if (tokenId == 0) revert VM_NO_POSITION();

        (,, address token0Address, address token1Address,,,,,,,,) = _nfpm().positions(tokenId);

        bool send = true;

        uint256 storedFee0 = userInfo[user][poolIdHash].feeToken0;
        uint256 storedFee1 = userInfo[user][poolIdHash].feeToken1;

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        token0.safeIncreaseAllowance(address(_liquidityManager()), storedFee0);

        token1.safeIncreaseAllowance(address(_liquidityManager()), storedFee1);

        _nfpm().approve(address(_liquidityManager()), tokenId);

        (uint256 lmCollected0, uint256 lmCollected1, uint256 companyTax) =
            _liquidityManager().collectFeesFromPosition(tokenId, user, storedFee0, storedFee1, _companyFeePct(), send);

        s_companyFees += companyTax;

        _nfpm().approve(address(0), tokenId);

        userInfo[user][poolIdHash].feeToken0 = 0;
        userInfo[user][poolIdHash].feeToken1 = 0;

        collectedToken0 = lmCollected0 + storedFee0;
        collectedToken1 = lmCollected1 + storedFee1;
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
    function migratePosition(address user, address manager, string calldata poolId, int24 tickLower, int24 tickUpper)
        external
        onlyVaultManager
        notEmergency
        returns (uint256 newTokenId)
    {
        bytes32 poolIdHash = _formatPoolId(poolId);
        uint256 tokenId = userInfo[user][poolIdHash].tokenId;

        if (tokenId == 0) revert VM_NO_POSITION();

        if (!(userInfo[user][poolIdHash].tickLower != tickLower || userInfo[user][poolIdHash].tickUpper != tickUpper)) {
            revert VM_SAME_TICK_RANGE();
        }

        (,, address token0Address, address token1Address,,,,,,,,) = _nfpm().positions(tokenId);

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        _nfpm().approve(address(_liquidityManager()), tokenId);

        (uint256 _newTokenId, uint256 cumulatedFee0, uint256 cumulatedFee1) =
            _liquidityManager().moveRangeOfPosition(manager, tokenId, tickLower, tickUpper);

        uint256 actualCumulatedFee0 = 0;
        if (cumulatedFee0 > 0) {
            uint256 balance0Before = token0.balanceOf(address(this));
            token0.safeTransferFrom(address(_liquidityManager()), address(this), cumulatedFee0);
            actualCumulatedFee0 = token0.balanceOf(address(this)) - balance0Before;
        }

        uint256 actualCumulatedFee1 = 0;
        if (cumulatedFee1 > 0) {
            uint256 balance1Before = token1.balanceOf(address(this));
            token1.safeTransferFrom(address(_liquidityManager()), address(this), cumulatedFee1);
            actualCumulatedFee1 = token1.balanceOf(address(this)) - balance1Before;
        }

        userInfo[user][poolIdHash].tokenId = _newTokenId;
        userInfo[user][poolIdHash].tickLower = tickLower;
        userInfo[user][poolIdHash].tickUpper = tickUpper;
        userInfo[user][poolIdHash].feeToken0 += actualCumulatedFee0;
        userInfo[user][poolIdHash].feeToken1 += actualCumulatedFee1;

        _nfpm().approve(address(0), _newTokenId);

        newTokenId = _newTokenId;
    }

    /**
     * @notice Withdraw a percentage of the company’s accumulated fees.
     * @param percentage Percentage of fees to withdraw (basis points).
     * @param code Two-factor authentication code.
     */
    function withdrawCompanyFees(uint256 percentage, string calldata code) external onlyMasterAdmin {
        s_userManager.check2FA(msg.sender, code);
        if (s_companyFees == 0) revert VM_COMPANY_FEES_ZERO();

        uint256 amountToWithdraw;
        if (s_companyFees > 0) {
            amountToWithdraw = (s_companyFees * percentage) / 10000;
            s_companyFees -= amountToWithdraw;

            _mainToken().safeTransfer(msg.sender, amountToWithdraw);
        }

        emit WithDrawCompanyFees(amountToWithdraw);
    }

    /**
     * @notice Emergency batch withdrawal of multiple ERC20 tokens.
     * @param tokens Array of token addresses.
     * @param to Recipient address.
     */
    function emergencyERC20BatchWithdrawal(address[] calldata tokens, address to) external onlyMasterAdmin {
        if (tokens.length > s_maxWithdrawalSize) revert VM_ARRAY_SIZE_LIMIT_EXCEEDED("tokens", tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(tokens[i]).safeTransfer(to, balance);
            }
        }
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
    {
        if (tokenIds.length > s_maxWithdrawalSize) revert VM_ARRAY_SIZE_LIMIT_EXCEEDED("tokenIds", tokenIds.length);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            if (IERC721(nftContract).ownerOf(tokenId) == address(this)) {
                IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
            }
        }
    }
}
