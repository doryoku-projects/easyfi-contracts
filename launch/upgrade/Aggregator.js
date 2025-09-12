const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.AGGREGATOR_ADDRESS;
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const AggregatorUpgradeable = await ethers.getContractFactory("AggregatorUpgradeable");

  console.log("Current implementation address:", implementationAddress);
  console.log("AggregatorUpgradeable");
  console.log("[UPGRADE] Updating the proxy contract...");

  // The proxy contract is updated
  const upgradeAggregator = await upgrades.upgradeProxy(
    proxyAddress,
    AggregatorUpgradeable
  );

  console.log("[UPGRADE] Proxy contract updated at:", await upgradeAggregator.getAddress());
  const NewimplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Current implementation address:", NewimplementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UPGRADE] Error in upgrade:", error);
    process.exit(1);
  });