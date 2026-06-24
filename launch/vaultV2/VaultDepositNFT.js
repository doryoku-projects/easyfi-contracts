const { deployUpgradeableContract } = require("../DeploymentHelper");
const { getDeploymentAddress } = require("../DeploymentStore");
const CONFIG = require("../config");

async function deployVaultDepositNFT() {

    const TokenVaultAddress = await getDeploymentAddress("TokenVaultUpgradeable");

    const initializeArgs = [
        "Wadz Liquidity Position",
        "WADZ-LP",
        "placeholder base uri",     // TODO add URI
        TokenVaultAddress
    ];

    return await deployUpgradeableContract({
        contractName: "VaultDepositNFTUpgradeable",
        displayName: "VaultDepositNFT",
        initializeArgs,
        saltPrefix: CONFIG.SALTS.VAULT_DEPOSIT_NFT,
        storageKey: "VaultDepositNFTUpgradeable"
    });
}

module.exports = deployVaultDepositNFT;