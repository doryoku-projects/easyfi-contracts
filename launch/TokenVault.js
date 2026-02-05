const { deployUpgradeableContract } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployTokenVault() {
    const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
    const protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");

    const initializeArgs = [
        protocolConfigAddress, // address _protocolConfig,
        userManagerAddress, // address _userManager,
        process.env.MASTER_ADMIN_WALLET, // address _managerWallet,
        process.env.MASTER_ADMIN_WALLET, // address _feeCollector,
        69, // uint256 _entryFeeBps,
        69 // uint256 _exitFeeBps
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