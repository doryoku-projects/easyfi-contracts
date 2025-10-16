const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");
const CONFIG = require("./config");

const DEPLOYMENTS_FILE = path.join(__dirname, `../deployments.json`);

async function storeDeployment(contractName, address) {
    if (!fs.existsSync(DEPLOYMENTS_FILE)) {
        fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify({}, null, 2));
    }

    let masterDeployments = {};
    if (fs.existsSync(DEPLOYMENTS_FILE)) {
        try {
            const content = fs.readFileSync(DEPLOYMENTS_FILE, "utf-8");
            masterDeployments = JSON.parse(content);
        } catch (e) {
            console.warn("⚠️ Warning: Could not parse deployments.json. Starting fresh for this run.");
        }
    }

    masterDeployments[contractName] = address;

    // Write the entire master object back to the file
    fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(masterDeployments, null, 2));
}


async function deployFactory() {
    const { WALLETS } = CONFIG;

    const initialAdmins = [WALLETS.MASTER_ADMIN];

    // Deploy the ProxyFactory
    const proxyFactory = await ethers.getContractFactory("ProxyFactory");
    const proxyFactoryContract = await proxyFactory.deploy(initialAdmins);
    await proxyFactoryContract.waitForDeployment();
    const proxyFactoryAddress = await proxyFactoryContract.getAddress();
    console.log(`Proxy Factory deployed to: ${proxyFactoryAddress}`);

    await storeDeployment("proxyFactoryAddress", proxyFactoryAddress);

    // Wait for block confirmations before verification
    // if (network.name !== "hardhat" && network.name !== "localhost") {
    //     console.log("\nWaiting for block confirmations...");
    //     await proxyFactoryContract.deploymentTransaction().wait(6);

    //     console.log("\nVerifying contract on Etherscan...");
    //     try {
    //         await run("verify:verify", {
    //             address: proxyFactoryAddress,
    //             constructorArguments: initialAdmins,
    //         });
    //         console.log("✅ Contract verified!");
    //     } catch (error) {
    //         console.log("❌ Verification failed:", error.message);
    //     }
    // }
}

// module.exports = deployFactory;

deployFactory()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("   Deployment failed:", error);
        process.exit(1);
    });
