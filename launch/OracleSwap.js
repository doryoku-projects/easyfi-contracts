const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("[DEPLOY] Deploying OracleSwapUpgradeable...");

  deployer = process.env.OWNER_PRIVATE_KEY;
  // Obtén la fábrica del contrato Agregador Upgradeable
  const OracleSwapUpgradeable = await ethers.getContractFactory(
    "OracleSwapUpgradeable"
  );

  const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  const userManagerUpgradeableAddress = process.env.USER_MANAGER_ADDRESS;

  // Despliega el proxy upgradeable, inicializando el contrato con las direcciones
  const oracleSwap = await upgrades.deployProxy(
    OracleSwapUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress],
    { initializer: "initialize" }
  );

  await oracleSwap.waitForDeployment();

  console.log("[DEPLOY] OracleSwapUpgradeable deployed at:", oracleSwap.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[DEPLOY] Error in OracleSwapUpgradeable:", error);
    process.exit(1);
  });
