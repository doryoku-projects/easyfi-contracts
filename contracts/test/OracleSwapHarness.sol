// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// import "../OracleSwapUpgradeable.sol";
import "../UniswapV3TWAPOracle.sol";
import "../errors/OracleSwapErrors.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

contract OracleSwapHarness is OracleSwapErrors {
    function exposeGetTWAPPrice(
        address token,
        address baseToken,
        uint24 fee,
        address uniswapFactoryAddress
    ) external view returns (uint256 price) {
        uint32 s_twapWindow = 600;

        IUniswapV3Factory factory = IUniswapV3Factory(uniswapFactoryAddress);
        address pool = factory.getPool(token, baseToken, fee);
        if (pool == address(0)) revert OS_POOL_NOT_SET();

        try IUniswapV3Pool(pool).token0() returns (address token0) {
            try IUniswapV3Pool(pool).token1() returns (address token1) {
                // Verify pool contains the expected tokens
                bool validPool = (token0 == token && token1 == baseToken) ||
                    (token0 == baseToken && token1 == token);
                if (!validPool) revert OS_INVALID_POOL();

                // Get TWAP price
                uint256 twapPrice = UniswapV3TWAPOracle.getTWAPPrice(
                    pool,
                    s_twapWindow
                );

                // Adjust price based on token order in pool
                if (token0 == token) {
                    price = twapPrice > 0 ? (1e18 * 1e18) / twapPrice : 0;
                } else {
                    price = twapPrice * 1e18;
                }
            } catch {
                revert OS_INVALID_POOL();
            }
        } catch {
            revert OS_TWAP_OBSERVATION_FAILED();
        }
    }
}
