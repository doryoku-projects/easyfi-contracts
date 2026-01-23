const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployTokenVault() {
    const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
    const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");

    const initializeArgs = [
        protocolConfigAddress,
        userManagerAddress,
        process.env.MASTER_ADMIN_WALLET,
        process.env.CLIENT_ADDRESS,
        100,
        200
    ];

    return await deployUpgradeableContract({
        contractName: "TokenVaultUpgradeable",
        displayName: "TokenVault",
        initializeArgs,
        saltPrefix: CONFIG.SALTS.TOKEN_VAULT,
        storageKey: "TokenVaultUpgradeable"
    });
}

module.exports = deployTokenVault;