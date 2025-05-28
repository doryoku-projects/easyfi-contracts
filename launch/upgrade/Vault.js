// scripts/upgradeAggregator.js
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.VAULT_MANAGER_ADDRESS; // Reemplaza esto con la dirección del proxy ya desplegado
  
  const VaultManagerUpgradeable = await ethers.getContractFactory("VaultManagerUpgradeable");
  
  console.log("Haciendo upgrade del contrato...");
  
  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    VaultManagerUpgradeable
  );
  
  console.log("Contrato actualizado correctamente, nueva versión desplegada en:", await upgraded.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
