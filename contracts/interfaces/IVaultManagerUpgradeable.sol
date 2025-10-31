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
        bool thresholdPassed;
    }

    function mintOrIncreaseLiquidityPosition(
        string calldata poolId,
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountMainTokenDesired,
        address userAddress
    ) external returns (uint256 tokenId);

    function decreaseLiquidityPosition(address user, string calldata poolId, uint128 percentageToRemove) external;

    function collectFees(address user, string calldata poolId)
        external
        returns (uint256 collectedToken0, uint256 collectedToken1);

    function migratePosition(address user, address manager, string calldata poolId, int24 tickLower, int24 tickUpper)
        external
        returns (uint256 newTokenId);

    function getUserInfo(address user, string calldata poolId)
        external
        view
        returns (UserInfo memory userInformation);
}
