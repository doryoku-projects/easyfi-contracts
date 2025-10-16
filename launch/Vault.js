const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployVault() {
  const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");

  const initializeArgs = [
    protocolConfigAddress,
    userManagerAddress,
    CONFIG.PROTOCOL.MAX_WITHDRAWAL_SIZE
  ];

  return await deployUpgradeableContract({
    contractName: "VaultManagerUpgradeable",
    displayName: "Vault",
    initializeArgs,
    saltPrefix: CONFIG.SALTS.VAULT,
    storageKey: "VaultUpgradeable"
  });
}

module.exports = deployVault;