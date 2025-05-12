// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

/// @notice LiquidityHelper interface.
interface ILiquidityHelperUpgradeable {
    function migratePosition(address user, uint256 tokenId, int24 tickLower, int24 tickUpper)
        external
        returns (uint256 newTokenId, uint256 cumulatedFee0, uint256 cumulatedFee1);

    function handleLeftovers(
        uint256 tokenId,
        uint256 leftoverAmount0,
        uint256 amountToken0Desired,
        uint256 amount0Added,
        uint256 leftoverAmount1,
        uint256 amountToken1Desired,
        uint256 amount1Added
    ) external returns (uint256 addedUsed0, uint256 addedUsed1, uint256 returnToken0, uint256 returnToken1);
}
