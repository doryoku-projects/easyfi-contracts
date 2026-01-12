const { upgradeContract } = require("./upgradeContract");

async function main() {
  console.log("[UPGRADE] Starting Vault upgrade...");
  
  await upgradeContract({
    contractName: "VaultManagerUpgradeable",
    proxyStorageKey: "VaultManagerUpgradeable"
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UPGRADE] Error in upgrade:", error);
    process.exit(1);
  });