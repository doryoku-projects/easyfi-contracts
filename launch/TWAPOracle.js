const { ethers } = require("hardhat");
const { storeDeployment } = require("./DeploymentStore");

async function deployTWAPOracle() {
    const [deployer] = await ethers.getSigners();
    console.log("[DEPLOY] UniswapV3TWAPOracle library...");

    const currentNonce = await ethers.provider.getTransactionCount(deployer.address, 'latest');
    console.log(`Current deployer nonce: ${currentNonce}`);

    const Library = await ethers.getContractFactory("UniswapV3TWAPOracle", deployer);
    const library = await Library.deploy({ nonce: currentNonce });
    await library.waitForDeployment();
    const libraryAddress = await library.getAddress();

    console.log(`Library deployed: ${libraryAddress}`);

    await storeDeployment("UniswapV3TWAPOracle", libraryAddress);

    return libraryAddress;
}

module.exports = deployTWAPOracle;
