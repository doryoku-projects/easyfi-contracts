from web3 import Web3
import math

Q96 = 2**96

def calcular_cantidades(precio_actual,lower_tick,upper_tick):


    # Convertir precios a sqrtRatios
    sqrt_ratio_actual = int(math.sqrt(precio_actual) * Q96)
    sqrt_ratio_a = int(math.sqrt(lower_tick) * Q96)
    sqrt_ratio_b = int(math.sqrt(upper_tick) * Q96)

    # Calcular L (liquidez) para $100
    denominador = (sqrt_ratio_actual * (sqrt_ratio_b - sqrt_ratio_actual) // sqrt_ratio_b) + (sqrt_ratio_b * (sqrt_ratio_actual - sqrt_ratio_a) // Q96)
    L = (100 * Q96 * sqrt_ratio_b) // denominador

    # Obtener amount0 y amount1 usando getAmountsForLiquidity
    if sqrt_ratio_actual <= sqrt_ratio_a:
        amount0 = (L * (sqrt_ratio_b - sqrt_ratio_a) * Q96) // (sqrt_ratio_a * sqrt_ratio_b)
        amount1 = 0
    elif sqrt_ratio_actual < sqrt_ratio_b:
        amount0 = (L * (sqrt_ratio_b - sqrt_ratio_actual) * Q96) // (sqrt_ratio_actual * sqrt_ratio_b)
        amount1 = (L * (sqrt_ratio_actual - sqrt_ratio_a)) // Q96
    else:
        amount0 = 0
        amount1 = (L * (sqrt_ratio_b - sqrt_ratio_a)) // Q96

    # Ajustar a decimales (ej. ETH tiene 18 decimales, USDC 6)
    amount0_ajustado = amount0 / 1e18
    amount1_ajustado = amount1 / 1e6

    return amount0_ajustado, amount1_ajustado

# Supongamos:
precio_actual = 2415.4  # 1 ETH = 2000 USDC
lower_tick = -198600     # Precio mínimo
upper_tick = -198200     # Precio máximo
amount0, amount1 = calcular_cantidades(precio_actual,lower_tick,upper_tick)
print(f"Deposita: {amount0:.6f} ETH y {amount1:.2f} USDC")