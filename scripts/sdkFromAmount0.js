const { Token, CurrencyAmount, Price } = require("@uniswap/sdk-core");
const { Pool, Position, nearestUsableTick } = require("@uniswap/v3-sdk");
const { ethers } = require("ethers");
const JSBI = require("jsbi");

const provider = new ethers.JsonRpcProvider("https://arbitrum-mainnet.infura.io/v3/1c91e8dcc6cc42729373fc89efeaf437 ");


// 1. Direcciones y ABIs necesarias
const POOL_ADDRESS = "0xc6962004f452be9203591991d15f6b388e09e8d0"; // Pool USDC/WETH 0.3% en Arbitrum
const POOL_ABI = [
  "function fee() external view returns (uint24)",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

// 2. Definir tokens (USDC y WETH)
const USDC = new Token(42161, "0xaf88d065e77c8cc2239327c5edb3a432268e5831", 6, "USDC", "USD Coin");
const WETH = new Token(42161, "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 18, "WETH", "Wrapped Ether");

async function main() {
  // 3. Crear instancia del contrato de la pool
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

  // 4. Obtener datos en bruto de la pool
  const [fee, slot0, liquidity, token0Address] = await Promise.all([
    poolContract.fee(),
    poolContract.slot0(),
    poolContract.liquidity(),
    poolContract.token0()
  ]);

  // 5. Determinar token0 y token1
  const token0 = token0Address.toLowerCase() === USDC.address.toLowerCase() ? USDC : WETH;
  const token1 = token0 === USDC ? WETH : USDC;
  
  // 6. Crear objeto Pool con datos reales
//   const pool = new Pool(
//     token0,
//     token1,
//     500,
//     JSBI.BigInt(slot0.sqrtPriceX96.toString()),
//     JSBI.BigInt(liquidity.toString()),
//     JSBI.BigInt(slot0.tick.toString())
//   );

  const pool = new Pool(
    USDC,
    WETH,
    500,
    slot0.sqrtPriceX96.toString(),
    liquidity.toString(),
    parseInt(slot0.tick.toString())
  );

  // 7. Resto del código (posición, cálculo de cantidades)
  const lowerPrice = 2350; // Precio mínimo en USDC por ETH
  const upperPrice = 2500; // Precio máximo
  const usdcToInvest = 100000000; // USDC a invertir
//   const amountUSDC = CurrencyAmount.fromRawAmount(USDC, ethers.parseUnits(usdcToInvest, USDC.decimals).toString())

// const tickLower = nearestUsableTick(
//     Math.log(lowerPrice / parseFloat(pool.token0Price.toSignificant(6))) / Math.log(1.0001),
//     pool.tickSpacing
//   );

//   console.log("NO LLEGO ")
// .toSignificant(6)  const tickUpper = nearestUsableTick(
//     Math.log(upperPrice / parseFloat(pool.token0Price.toSignificant(6))) / Math.log(1.0001),
//     pool.tickSpacing
//   );

  const tickLower = -198600
  const tickUpper = -198200
  const position = Position.fromAmount0({
    pool,
    tickLower,
    tickUpper,
    amount0: usdcToInvest,
  });


  console.log("Cantidades requeridas:");
  console.log(position)
//   console.log("Token0 (USDC):", position.amount0);
//   console.log("Token1 (WETH):", position.amount1);
}

main();