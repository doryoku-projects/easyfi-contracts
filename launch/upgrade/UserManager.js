const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.USER_MANAGER_ADDRESS;

  const UserManagerUpgradeable = await ethers.getContractFactory(
    "UserManagerUpgradeable"
  );

  console.log("[UPGRADE] Making upgrade to contract...");

  // await upgrades.forceImport(proxyAddress, UserManagerUpgradeable);


  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    UserManagerUpgradeable
  );

  console.log(
    "[UPGRADE] Contract updated successfully, new version deployed at:",
    await upgraded.getAddress()
  );
}

main().catch((error) => {
  console.error("[UPGRADE] Error in upgrade:", error);
  process.exitCode = 1;
});
