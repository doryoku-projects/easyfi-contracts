// scripts/deployAggregator.js
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  deployer = process.env.OWNER_PRIVATE_KEY;
  // Obtén la fábrica del contrato Agregador Upgradeable
  const LiquidityManagerUpgradeable = await ethers.getContractFactory(
    "LiquidityManagerUpgradeable"
  );

  const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  const userManagerUpgradeableAddress = process.env.USER_MANAGER_ADDRESS;

  // Despliega el proxy upgradeable, inicializando el contrato con las direcciones
  const liquidityManager = await upgrades.deployProxy(
    LiquidityManagerUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress],
    { initializer: "initialize" }
  );
  await liquidityManager.waitForDeployment();

  console.log(
    "Contrato LiquidityManagerUpgradeable desplegado en:",
    liquidityManager.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
