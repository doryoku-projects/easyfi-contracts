const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployAggregator() {
  const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");

  const initializeArgs = [
    protocolConfigAddress,
    userManagerAddress,
    CONFIG.PROTOCOL.MIGRATION_SIZE
  ];

  return await deployUpgradeableContract({
    contractName: "AggregatorUpgradeable",
    displayName: "Aggregator",
    initializeArgs,
    saltPrefix: CONFIG.SALTS.AGGREGATOR,
    storageKey: "AggregatorUpgradeable"
  });
}

module.exports = deployAggregator;