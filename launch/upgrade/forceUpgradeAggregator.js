const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = "0x2452bf5b70DD773874317454Dd1eCb31DB2f8D3c";

  // ¡IMPORTANTE! Asegúrate de que esta línea usa el contrato real correcto
  const Aggregator = await ethers.getContractFactory("AggregatorUpgradeable");

  // Esto registra el contrato como si fuera nuevo
  const proxy = await upgrades.forceImport(proxyAddress, Aggregator, { kind: "uups" });

  console.log("[UPGRADE] Forcibly imported contract:", proxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UPGRADE] Error in forceImport:", error);
    process.exit(1);
  });
