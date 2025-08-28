// scripts/upgradeAggregator.js
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.VAULT_MANAGER_ADDRESS;  // Replace with the actual address

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Current implementation address:", implementationAddress);
  const VaultManagerUpgradeable =
    await ethers.getContractFactory("VaultManagerUpgradeable");
console.log("vault manager upgrable")
  console.log("[UPGRADE] Updating the proxy contract...");

  // The proxy contract is updated
  const upgradedVault = await upgrades.upgradeProxy(
    proxyAddress,
    VaultManagerUpgradeable
  );
  console.log("[UPGRADE] Proxy contract updated at:",
    await upgradedVault.getAddress()
  );
    const NewimplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Current implementation address:", NewimplementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UPGRADE] Error in upgrade:", error);
    process.exit(1);
  });
