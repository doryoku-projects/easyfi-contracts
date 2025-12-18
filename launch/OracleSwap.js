const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployOracleSwap() {
  const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");
  const twapOracleAddress = await getDeploymentAddress("UniswapV3TWAPOracle");
  
  const initializeArgs = [protocolConfigAddress, userManagerAddress];

  return await deployUpgradeableContract({
    contractName: "OracleSwapUpgradeable",
    displayName: "OracleSwap",
    initializeArgs,
    saltPrefix: CONFIG.SALTS.ORACLE_SWAP,
    storageKey: "OracleSwapUpgradeable",
    libraries: {
      "contracts/UniswapV3TWAPOracle.sol:UniswapV3TWAPOracle": twapOracleAddress
    }
  });
}

module.exports = deployOracleSwap;