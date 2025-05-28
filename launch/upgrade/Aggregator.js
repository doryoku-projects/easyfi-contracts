const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.AGGREGATOR_ADDRESS;

  const AggregatorUpgradeable = await ethers.getContractFactory(
    "AggregatorUpgradeable"
  );

  console.log("Haciendo upgrade del contrato...");

  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    AggregatorUpgradeable
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
