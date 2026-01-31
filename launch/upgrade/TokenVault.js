const { upgradeContract } = require("./upgradeContract.js");

async function main() {
  await upgradeContract({
    contractName: "TokenVaultUpgradeable",
    proxyStorageKey: "TokenVaultUpgradeable"
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });