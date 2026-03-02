const { deployUpgradeableContract } = require("../DeploymentHelper");
const { getDeploymentAddress } = require("../DeploymentStore");
const CONFIG = require("../config");

async function deployTokenVault() {
    const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
    const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");

    const initializeArgs = [
        protocolConfigAddress,
        userManagerAddress,
        process.env.MASTER_ADMIN_WALLET,
        process.env.CLIENT_ADDRESS,
        CONFIG.VAULT.VAULT_ENTRY_FEE,
        CONFIG.VAULT.VAULT_EXIT_FEE,
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