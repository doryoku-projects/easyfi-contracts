const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployLiquidityHelper() {
  const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");
  const whitelabel = process.env.WHITELABEL;

  const initializeArgs = [protocolConfigAddress, userManagerAddress];

  return await deployUpgradeableContract({
    contractName: "LiquidityHelperUpgradeable",
    displayName: "LiquidityHelper",
    initializeArgs,
    saltPrefix: CONFIG.SALTS[whitelabel].LIQUIDITY_HELPER,
    storageKey: "LiquidityHelperUpgradeable"
  });
}

module.exports = deployLiquidityHelper;