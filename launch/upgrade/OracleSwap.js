const { upgradeContract } = require("./upgradeContract");

async function main() {
  await upgradeContract({
    contractName: "OracleSwapUpgradeable",
    proxyStorageKey: "OracleSwapUpgradeable"
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });