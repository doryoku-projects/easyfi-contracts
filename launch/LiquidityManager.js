const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployLiquidityManager() {
  const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");

  const initializeArgs = [protocolConfigAddress, userManagerAddress];

  return await deployUpgradeableContract({
    contractName: "LiquidityManagerUpgradeable",
    displayName: "LiquidityManager",
    initializeArgs,
    saltPrefix: CONFIG.SALTS.LIQUIDITY_MANAGER,
    storageKey: "LiquidityManagerUpgradeable"
  });
}

module.exports = deployLiquidityManager;