const { upgradeContract } = require("./upgradeContract");

async function main() {
  console.log("[UPGRADE] Starting Vault upgrade...");
  
  await upgradeContract({
    contractName: "TokenVaultUpgradeable",
    proxyStorageKey: "TokenVaultUpgradeable"
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[UPGRADE] Error in upgrade:", error);
    process.exit(1);
  });