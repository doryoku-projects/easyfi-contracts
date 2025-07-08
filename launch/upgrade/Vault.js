// scripts/upgradeAggregator.js
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = "PROXY_ADDRESS_0x00"; // Replace with the actual address

  const VaultManagerUpgradeable =
    await ethers.getContractFactory("VaultManagerUpgradeable");

  console.log("[UPGRADE] Updating the proxy contract...");

  // The proxy contract is updated
  const upgradedVault = await upgrades.upgradeProxy(
    proxyAddress,
    VaultManagerUpgradeable
  );
  console.log(`[UPGRADE] Proxy contract updated at: ${upgradedVault.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UPGRADE] Error in upgrade:", error);
    process.exit(1);
  });
