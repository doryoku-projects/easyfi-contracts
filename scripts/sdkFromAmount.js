import { Pool, Position, nearestUsableTick } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount } from '@uniswap/sdk-core'
import { ethers } from 'ethers'

// 1. Definir los tokens
const USDC = new Token(1, '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6, 'USDC', 'USD Coin')
const WETH = new Token(1, '0xC02aaa39b223FE8D0A0e5C4F27ead9083C756Cc2', 18, 'WETH', 'Wrapped Ether')

// 2. Datos del pool (estos valores deben obtenerse del contrato del pool)
const fee = 3000 // por ejemplo, 0.3%
const sqrtPriceX96 = 79228162514264337593543950336 // precio actual en formato sqrtPriceX96 (valor de ejemplo)
const liquidity = 1000000 // liquidez actual del pool (valor de ejemplo)
const currentTick = 0 // tick actual (valor de ejemplo)

// Crear el objeto Pool
const pool = new Pool(
  USDC,
  WETH,
  fee,
  sqrtPriceX96,
  liquidity,
  currentTick
)

// 3. Definir el rango de ticks en el que se aportará liquidez
const tickSpacing = 60 // depende del pool
const lowerTick = nearestUsableTick(currentTick - 1000, tickSpacing)
const upperTick = nearestUsableTick(currentTick + 1000, tickSpacing)

// 4. Convertir 100 USDC a la cantidad necesaria en la SDK
const amountUSDC = CurrencyAmount.fromRawAmount(USDC, ethers.utils.parseUnits("100", USDC.decimals).toString())

// 5. Crear la posición usando 100 USDC (token0)
// Esto calcula la liquidez y la cantidad requerida de WETH (token1) para el rango seleccionado
const position = Position.fromAmount0({
  pool,
  amount0: amountUSDC.quotient.toString(),
  lowerTick,
  upperTick
})

// Mostrar los resultados
console.log('Cantidad de USDC a depositar:', position.amount0.toSignificant(6))
console.log('Cantidad de WETH requerida:', position.amount1.toSignificant(6))
