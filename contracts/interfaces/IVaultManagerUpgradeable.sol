// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Interface for the VaultManager contract, which manages liquidity positions in a DeFi protocol.
interface IVaultManagerUpgradeable {
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
    ) external returns (uint256 tokenId);

    function decreaseLiquidityPosition(address user, string calldata poolId, uint256 packageId, uint128 percentageToRemove, bool isAdmin) external;

    function collectFees(address user, string calldata poolId, uint256 packageId)
        external
        returns (uint256 collectedToken0, uint256 collectedToken1);

    function migratePosition(address user, address manager, string calldata poolId, uint256 packageId, int24 tickLower, int24 tickUpper)
        external
        returns (uint256 newTokenId);

    function getUserInfo(address user, string calldata poolId, uint256 packageId)
        external
        view
        returns (UserInfo memory _userInfo);
    

    function getUserPackageInfo(address user, uint256 packageId)
        external
        view
        returns (PackageInfo memory _packageInfo);
    
    function decreasePositionAndWithdrawFees(string calldata poolId) external;

    function updateFees(address user, bytes32 poolId, uint256 amount) external;

    function getUserPackage(address user) external view returns (UserInfo memory);

    function withdrawFunds(address user) external;

}
