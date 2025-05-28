const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.USER_MANAGER_ADDRESS;

  const UserManagerUpgradeable = await ethers.getContractFactory(
    "UserManagerUpgradeable"
  );

  console.log("Haciendo upgrade del contrato...");

  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    UserManagerUpgradeable
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
