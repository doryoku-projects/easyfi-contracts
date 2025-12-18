const { upgradeContract } = require("./upgradeContract");
const { getDeploymentAddress } = require("../DeploymentStore");

async function main() {
  const libraryAddress = await getDeploymentAddress("UniswapV3TWAPOracle");
  await upgradeContract({
    contractName: "OracleSwapUpgradeable",
    proxyStorageKey: "OracleSwapUpgradeable",
    libraries: {
      UniswapV3TWAPOracle: libraryAddress,
    },
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });