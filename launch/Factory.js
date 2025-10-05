const { ethers, run } = require("hardhat");
const {storeDeployment} = require("./DeploymentStore")
const CONFIG = require("./config");

async function deployFactory() {
    const { WALLETS } = CONFIG;

  const initialAdmins = [WALLETS.GENERAL_ADMIN, WALLETS.MASTER_ADMIN, WALLETS.NEW_DEPLOYER_ADDRESS];

    // Deploy the ProxyFactory
    const proxyFactory = await ethers.getContractFactory("ProxyFactory");
    const proxyFactoryContract = await proxyFactory.deploy(initialAdmins);
    await proxyFactoryContract.waitForDeployment();
    const proxyFactoryAddress = await proxyFactoryContract.getAddress();
    console.log(`   Proxy Factory deployed to: ${proxyFactoryAddress}`);

    await storeDeployment("proxyFactoryAddress", proxyFactoryAddress);
    
    // Wait for block confirmations before verification
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\nWaiting for block confirmations...");
        await proxyFactoryContract.deploymentTransaction().wait(6);
        
        console.log("\nVerifying contract on Etherscan...");
        try {
            await run("verify:verify", {
                address: proxyFactoryAddress,
                constructorArguments: initialAdmins,
            });
            console.log("✅ Contract verified!");
        } catch (error) {
            console.log("❌ Verification failed:", error.message);
        }
    }
}

module.exports = deployFactory;

// deployFactory()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error("   Deployment failed:", error);
//     process.exit(1);
//   });
