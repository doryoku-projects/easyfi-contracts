const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
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

  console.log(
    "Contrato OracleSwapUpgradeable desplegado en:",
    oracleSwap.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
