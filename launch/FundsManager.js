const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployFundsManager() {
  const userManagerAddress = await getDeploymentAddress(
    "UserManagerUpgradeable"
  );

  const initializeArgs = [userManagerAddress];

  return await deployUpgradeableContract({
    contractName: "FundsManagerUpgradeable",
    displayName: "FundsManager",
    initializeArgs,
    saltPrefix: CONFIG.SALTS.FUNDS_MANAGER,
    storageKey: "FundsManagerUpgradeable",
  });
}

module.exports = deployFundsManager;
