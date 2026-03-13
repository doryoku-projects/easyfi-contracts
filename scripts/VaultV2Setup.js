const { ethers } = require("hardhat");
const { getDeploymentAddress } = require("../launch/DeploymentStore");
const { YIELD_CONFIG_PER_CHAIN } = require("../launch/config");

async function setDepositNFTAddress(TokenVaultContract, nftAddress) {
    try {
        const tx = await TokenVaultContract.setDepositNFT(nftAddress);
        await tx.wait();
        console.log(`✅ Set Deposit NFT address to ${nftAddress}`);
    } catch (error) {
        console.log(`❌ Failed to set Deposit NFT address: ${error.message}`);
    }
}

async function setYieldPlans(TokenVaultContract) {
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    const yieldConfig = YIELD_CONFIG_PER_CHAIN[chainId];

    const tokens = [];
    const ids = [];
    const durations = [];
    const aprs = [];
    const actives = [];

    const targetTokens = Object.values(VAULT_V2_SUPPORTED_TOKENS[chainId]);

    const SECONDS_IN_MONTH = 30 * 24 * 60 * 60;

    // const SECONDS_TEST = 5 * 60; //5 min

    try {
        for (const tokenAddr of targetTokens) {
            // Enable token first
            await (await TokenVaultContract.setTokenStatus(tokenAddr, true)).wait();

            for (const plan of yieldConfig.plans) {
                tokens.push(tokenAddr);
                ids.push(plan.id);
                durations.push(plan.months * SECONDS_IN_MONTH);
                aprs.push(plan.apr);
                actives.push(true);
            }
        }

        const batchTx = await TokenVaultContract.setYieldPlansBatch(
            tokens,
            ids,
            durations,
            aprs,
            actives
        );
        await batchTx.wait();
    } catch (error) {
        console.log(`❌ Failed to set yield plans: ${error.message}`);
        return;
    }

    console.log(`✅ Configured ${tokens.length} yield plans for BTC and ETH`);
}

async function UpdateFees(TokenVaultContract) {

    const tx = await TokenVaultContract.setFees(VAULT.VAULT_ENTRY_FEE, VAULT.VAULT_EXIT_FEE);
    tx.wait();
}

async function VaultRoleSetting(sdWallet, TokenVaultAddr, VaultDepositNFTAddr) {
    const userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");

    userManagerGeneralAdmin = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      marcWallet
    );

    await (await userManagerGeneralAdmin.addLiquidityManagers([
       TokenVaultAddr,
       VaultDepositNFTAddr
    ])).wait();
    
}

async function main() {
    console.log("\n🔗 VaultV2 RoleSetting and Initial setup...");

    const [,,marcWallet,] = await ethers.getSigners();

    const TokenVaultAddr = await getDeploymentAddress("TokenVaultUpgradeable");
    const VaultDepositNFTAddr = await getDeploymentAddress("VaultDepositNFTUpgradeable");

    const TokenVaultContract = await ethers.getContractAt(
        "TokenVaultUpgradeable",
        TokenVaultAddr,
        marcWallet
    );

    // Step 1: Set Vault Roles
    console.log("\n🔗 Setting Vault Roles ");
    await VaultRoleSetting(marcWallet, TokenVaultAddr, VaultDepositNFTAddr);
    console.log("✅ Vault added as Liquidity Manager");


    // Step 2: Set Deposit NFT address in TokenVault
    console.log("\n🔗 Setting VaultDepositNFT address in TokenVault Contract...");
    await setDepositNFTAddress(TokenVaultContract, VaultDepositNFTAddr);
    console.log("✅ Set VaultDepositNFT address in TokenVault Contract");

    
    // Step 3: Set Yield Plans
    console.log("\n🔗 Setting Yield Plans in TokenVault Contract...");
    await setYieldPlans(TokenVaultContract);
    console.log("✅ Set Yield Plans in TokenVault Contract");

    // await UpdateFees(TokenVaultContract);

}

main().then(() => process.exit(0)).catch((error) => {
    console.error(" VaultV2 initial setup failed:", error);
    process.exit(1);
})