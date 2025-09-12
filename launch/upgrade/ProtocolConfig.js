const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.PROTOCOL_CONFIG_ADDRESS; // Reemplaza esto con la dirección del proxy ya desplegado
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const protocolConfigContract = await ethers.getContractFactory("ProtocolConfigUpgradeable");

  console.log("Current implementation address:", implementationAddress);
  console.log("ProtocolConfigUpgradeable")
  console.log("[UPGRADE] Updating the proxy contract...");

  // The proxy contract is updated
  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    protocolConfigContract
  );

  console.log("[UPGRADE] Proxy contract updated at:", await upgraded.getAddress());
  const NewimplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Current implementation address:", NewimplementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UPGRADE] Error in upgrade:", error);
    process.exit(1);
  });