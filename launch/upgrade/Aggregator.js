const { upgradeContract } = require("./upgradeContract.js");

async function main() {
  await upgradeContract({
    contractName: "AggregatorUpgradeable",
    proxyStorageKey: "AggregatorUpgradeable"
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });