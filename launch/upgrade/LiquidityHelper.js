const { upgradeContract } = require("./upgradeContract");

async function main() {
  await upgradeContract({
    contractName: "LiquidityHelperUpgradeable",
    proxyStorageKey: "LiquidityHelperUpgradeable"
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });