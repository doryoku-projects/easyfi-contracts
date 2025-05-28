// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract LiquidityManagerErrors {
    /**
     * @notice address input was zero
     */
    error LM_ZERO_ADDRESS();
    /**
     * @notice new address equals current
     */
    error LM_ADDRESS_UNCHANGED();
    /**
     * @notice _tokenId == 0 in getPositionData
     */
    error LM_NO_ACTIVE_POSITION();
    /**
     * @notice ownerOf(tokenId) != this
     */
    error LM_NOT_NFT_OWNER();
    /**
     * @notice percentageToRemove > s_BP
     */
    error LM_PERCENTAGE_TOO_HIGH();
    /**
     * @notice liquidity == 0
     */
    error LM_NO_LIQUIDITY();
    /**
     * @notice this.balanceOf(token0) < collected0
     */
    error LM_INSUFFICIENT_TOKEN0_BALANCE();
    /**
     * @notice this.balanceOf(token1) < collected1
     */
    error LM_INSUFFICIENT_TOKEN1_BALANCE();
}
