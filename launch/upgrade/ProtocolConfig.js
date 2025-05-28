const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.PROTOCOL_CONFIG_ADDRESS; // Reemplaza esto con la dirección del proxy ya desplegado

  const protocolConfigContract = await ethers.getContractFactory(
    "ProtocolConfigUpgradeable"
  );

  console.log("Haciendo upgrade del contrato...");

  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    protocolConfigContract
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
