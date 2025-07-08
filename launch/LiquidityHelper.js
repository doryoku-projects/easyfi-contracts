// scripts/deployAggregator.js
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("[DEPLOY] Deploying LiquidityHelperUpgradeable...");

  deployer = process.env.OWNER_PRIVATE_KEY;
  // Obtén la fábrica del contrato Agregador Upgradeable
  const LiquidityHelperUpgradeable = await ethers.getContractFactory(
    "LiquidityHelperUpgradeable"
  );

  const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  const userManagerUpgradeableAddress = process.env.USER_MANAGER_ADDRESS;

  // Despliega el proxy upgradeable, inicializando el contrato con las direcciones
  const liquidityHelper = await upgrades.deployProxy(
    LiquidityHelperUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress],
    { initializer: "initialize" }
  );
  await liquidityHelper.waitForDeployment();

  console.log(
    "[DEPLOY] LiquidityHelperUpgradeable deployed at:",
    liquidityHelper.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[DEPLOY] Error in LiquidityHelperUpgradeable:", error);
    process.exit(1);
  });
