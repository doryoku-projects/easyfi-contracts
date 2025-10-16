const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployOracleSwap() {
  const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");
  const whitelabel = process.env.WHITELABEL;

  const initializeArgs = [protocolConfigAddress, userManagerAddress];

  return await deployUpgradeableContract({
    contractName: "OracleSwapUpgradeable",
    displayName: "OracleSwap",
    initializeArgs,
    saltPrefix: CONFIG.SALTS[whitelabel].ORACLE_SWAP,
    storageKey: "OracleSwapUpgradeable"
  });
}

module.exports = deployOracleSwap;