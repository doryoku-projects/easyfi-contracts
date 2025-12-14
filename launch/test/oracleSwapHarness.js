const { storeDeployment, getFactoryDeploymentAddress } = require("../DeploymentStore");
const CONFIG = require("../config");

async function deployOracleSwapHarness() {

  const [deployer, MasterAdmin] = await ethers.getSigners();
  const currentNonce = await ethers.provider.getTransactionCount(deployer.address, 'latest');
    console.log(`Current deployer nonce: ${currentNonce}`);

    const ContractFactory = await ethers.getContractFactory("OracleSwapHarness", deployer);
    const implementation = await ContractFactory.deploy({ nonce: currentNonce });
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();

    console.log(`Implementation deployed: ${implementationAddress}`);
    await storeDeployment("OracleSwapHarness", implementationAddress);

}

// module.exports = deployOracleSwapHarness;

deployOracleSwapHarness();
