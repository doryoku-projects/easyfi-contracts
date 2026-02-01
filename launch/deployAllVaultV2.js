const { ethers } = require("hardhat");
const { getDeploymentAddress } = require("./DeploymentStore");
const { updateProtocolConfigAddresses, setDepositNFTAddress } = require("./DeploymentHelper");

const deployTokenVault = require("./vaultV2/TokenVault");
const deployVaultDepositNFT = require("./vaultV2/VaultDepositNFT");
const { YIELD_CONFIG_PER_CHAIN } = require("./config");

async function main() {
    console.log("🚀 Starting VaultV2 deployment...", process.env.WHITELABEL);

    await deployTokenVault();
    await deployVaultDepositNFT();
    console.log("\n✅ All VaultV2 contracts deployed\n");

    const userManagerAddr = await getDeploymentAddress("UserManagerUpgradeable");
    const ProtocolConfigAddr = await getDeploymentAddress("ProtocolConfigUpgradeable");
    const TokenVaultAddr = await getDeploymentAddress("TokenVaultUpgradeable");
    const VaultDepositNFTAddr = await getDeploymentAddress("VaultDepositNFTUpgradeable");

    console.log("🔗 Attaching to UserManagerUpgradeable at:", userManagerAddr);
    console.log("🔗 Attaching to ProtocolConfigUpgradeable at:", ProtocolConfigAddr);
    console.log("🔗 Attaching to TokenVaultUpgradeable at:", TokenVaultAddr);
    console.log("🔗 Attaching to VaultDepositNFTUpgradeable at:", VaultDepositNFTAddr);

    const vaultContracts = [
        TokenVaultAddr,
        VaultDepositNFTAddr
    ];

    const [new_addr, owner, marcWallet, ] = await ethers.getSigners();
    const userManagerContract = await ethers.getContractAt("UserManagerUpgradeable", userManagerAddr, marcWallet);
    console.log("### ~ deployAllVaultV2.js ~ userManagerAddr:", userManagerAddr);

    const userManagertx = await userManagerContract.addContracts(vaultContracts);
    await userManagertx.wait();
    console.log("✅ Added VaultV2 Contracts in UserManager");

    console.log("\n🔗 Updating ProtocolConfig addresses...");
    await updateProtocolConfigAddresses({
        protocolConfigAddress: ProtocolConfigAddr,
        userManagerContract: userManagerContract,
        addressMapping: {
            TokenVault: TokenVaultAddr,
            VaultDepositNFT: VaultDepositNFTAddr
        }
    });
    console.log("✅ Added VaultV2 Contracts in ProtocolConfig");

    console.log("\n🎉 VaultV2 Deployment complete!");

    await initialVaultSetup(TokenVaultAddr, VaultDepositNFTAddr);
}

async function initialVaultSetup(TokenVaultAddr, VaultDepositNFTAddr) {
    console.log("\n🔗 Setting VaultDepositNFT address in TokenVault Contract...");
    await setDepositNFTAddress(TokenVaultAddr, VaultDepositNFTAddr);
    console.log("✅ Set VaultDepositNFT address in TokenVault Contract");

    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    const yieldConfig = YIELD_CONFIG_PER_CHAIN[chainId];

    const tokens = [];
    const ids = [];
    const durations = [];
    const aprs = [];
    const actives = [];

    const targetTokens = [yieldConfig.WETH, yieldConfig.WBTC];
    const SECONDS_IN_MONTH = 30 * 24 * 60 * 60;

    for (const tokenAddr of targetTokens) {
        // Enable token first
        await (await tokenVaultContract.setTokenStatus(tokenAddr, true)).wait();
        
        for (const plan of yieldConfig.plans) {
            tokens.push(tokenAddr);
            ids.push(plan.id);
            durations.push(plan.months * SECONDS_IN_MONTH);
            aprs.push(plan.apr);
            actives.push(true);
        }
    }

    const batchTx = await tokenVaultContract.setYieldPlansBatch(
        tokens, 
        ids, 
        durations, 
        aprs, 
        actives
    );
    await batchTx.wait();
    console.log(`✅ Configured ${tokens.length} yield plans for BTC and ETH`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("   VaultV2 Deployment failed:", error);
        process.exit(1);
    });
