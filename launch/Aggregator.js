const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("[DEPLOY] Deploying AggregatorUpgradeable...");

  // Obtén la fábrica del contrato Agregador Upgradeable
  const AggregatorUpgradeable = await ethers.getContractFactory(
    "AggregatorUpgradeable"
  );
  // Define las direcciones de los módulos (estas pueden ser de contratos ya desplegados)
  const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  const userManagerUpgradeableAddress = process.env.USER_MANAGER_ADDRESS;

  const migrationSize = 150;

  // Despliega el proxy upgradeable, inicializando el contrato con las direcciones
  const aggregator = await upgrades.deployProxy(
    AggregatorUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress, migrationSize],
    { initializer: "initialize" }
  );
  await aggregator.waitForDeployment();

  console.log("[DEPLOY] AggregatorUpgradeable deployed at:", aggregator.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[DEPLOY] Error in AggregatorUpgradeable:", error);
    process.exit(1);
  });
