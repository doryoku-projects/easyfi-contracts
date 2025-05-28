const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.ORACLE_SWAP_ADDRESS; // Reemplaza esto con la dirección del proxy ya desplegado

  const oracleSwapContract = await ethers.getContractFactory(
    "OracleSwapUpgradeable"
  );

  console.log("Haciendo upgrade del contrato...");

  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    oracleSwapContract
  );

  console.log(
    "Contrato actualizado correctamente, nueva versión desplegada en:",
    await upgraded.getAddress()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
