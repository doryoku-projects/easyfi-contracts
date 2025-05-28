// scripts/upgradeAggregator.js
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.LIQUIDITY_MANAGER_ADDRESS; // Reemplaza esto con la dirección del proxy ya desplegado
  
  const LiquidityManagerUpgradeable = await ethers.getContractFactory("LiquidityManagerUpgradeable");
  
  console.log("Haciendo upgrade del contrato...");
  
  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    LiquidityManagerUpgradeable
  );
  
  console.log("Contrato actualizado correctamente, nueva versión desplegada en:", await upgraded.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
