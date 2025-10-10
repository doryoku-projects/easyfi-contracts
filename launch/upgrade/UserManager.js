const { upgradeContract } = require("./upgradeContract");

async function main() {
  await upgradeContract({
    contractName: "UserManagerUpgradeable",
    proxyStorageKey: "UserManagerUpgradeable"
  });
}

main().catch((error) => {
  console.error("[UPGRADE] Error in upgrade:", error);
  process.exitCode = 1;
});
