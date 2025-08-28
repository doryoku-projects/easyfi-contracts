// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

/// @notice Interface for the LiquidityManager contract, which manages liquidity positions in a DeFi protocol.
interface ILiquidityManagerUpgradeable {
    function mintPosition(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountDesired,
        address user,
        bool isVault
    ) external returns (uint256 tokenId, uint256 usedAmount0, uint256 usedAmount1);

    function increaseLiquidityPosition(uint256 tokenId, uint256 amountMainTokenDesired, address user)
        external
        returns (uint256 increasedAmount0, uint256 increasedAmount1);

    function decreaseLiquidityPosition(uint256 tokenId, uint128 percentageToRemove, address user, bool migrate)
        external returns (uint256 collectedMainToken);

    function collectFeesFromPosition(
        uint256 tokenId,
        address user,
        uint256 previousCollected0,
        uint256 previousCollected1,
        uint256 companyTaxPercentage,
        bool send
    ) external returns (uint256 collected0, uint256 collected1, uint256 companyFees, uint256 collectedMainToken);

    function moveRangeOfPosition(address user, uint256 tokenId, int24 tickLower, int24 tickUpper)
        external
        returns (uint256 newTokenId, uint256 cumulatedFee0, uint256 cumulatedFee1);
}
