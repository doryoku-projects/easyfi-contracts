const { ethers } = require("hardhat");
const { storeDeployment, getDeploymentAddress } = require("./DeploymentStore");

/**
 * Generic UUPS proxy deployment using CREATE3
 */
async function deployUpgradeableContract({
  contractName,
  displayName,
  initializeArgs,
  saltPrefix,
  storageKey
}) {
  const [deployer] = await ethers.getSigners();

  console.log(`[DEPLOY] ${displayName || contractName}...`);

  const ContractFactory = await ethers.getContractFactory(contractName);
  const implementation = await ContractFactory.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  console.log(`Implementation deployed: ${implementationAddress}`);

  const initData = implementation.interface.encodeFunctionData(
    "initialize",
    initializeArgs
  );

  const PROXY_SALT = ethers.keccak256(
    ethers.solidityPacked(
      ["string", "address"],
      [saltPrefix, deployer.address]
    )
  );

  const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
  const factoryAddress = await getDeploymentAddress("proxyFactoryAddress");
  const proxyFactoryContract = ProxyFactory.attach(factoryAddress);

  const predictedProxyAddress = await proxyFactoryContract.getDeployed(PROXY_SALT);
  console.log(`Predicted proxy: ${predictedProxyAddress}`);

  const tx = await proxyFactoryContract.deploy(
    implementationAddress,
    initData,
    PROXY_SALT
  );
  const receipt = await tx.wait();
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  await storeDeployment(storageKey || contractName, predictedProxyAddress);
  
  return predictedProxyAddress;
}

/**
 * Generate keccak256 hash keys for protocol config
 */
function createConfigKey(str) {
  return ethers.keccak256(ethers.toUtf8Bytes(str));
}

/**
 * Batch update protocol config addresses
 */
async function updateProtocolConfigAddresses({
  protocolConfigAddress,
  userManagerContract,
  addressMapping
}) {

  const [, owner, marcWallet, pepOwnerWallet] = await ethers.getSigners();

  const ProtocolConfigContract = await ethers.getContractAt(
    "ProtocolConfigUpgradeable",
    protocolConfigAddress,
    owner
  );

  const keys = Object.keys(addressMapping).map(createConfigKey);
  const values = Object.values(addressMapping);

  for (let i = 0; i < values.length; i++) {
    const key = keys[i];
    const newVal = values[i];

    if (!newVal || newVal === ethers.ZeroAddress) {
      console.log(`Skipping zero address for ${key}`);
      continue;
    }

    let current = ethers.ZeroAddress;
    try {
      current = await ProtocolConfigContract.getAddress(key);
      console.log(`Current for ${key}: ${current}`);
    } catch (err) {
      console.log(`New address for ${key}`);
    }

    if (current && current.toLowerCase() === newVal.toLowerCase()) {
      console.log(`Unchanged: ${key}`);
      continue;
    }

    const isAdmin = await userManagerContract.connect(pepOwnerWallet).isMasterAdmin(owner.address);
    console.log(`Signer is master admin: ${isAdmin}`);
    
    if (!isAdmin) {
      console.log(`❌ Cannot set ${key}, signer not MasterAdmin`);
      continue;
    }

    console.log(`Updating ${key} -> ${newVal}`);
    try {
      const tx = await ProtocolConfigContract.setAddress(key, newVal);
      await tx.wait();
      console.log(`✅ Updated ${key}`);
    } catch (error) {
      console.log(`❌ Failed to update ${key}: ${error.message}`);
    }
  }
}


module.exports = {
  deployUpgradeableContract,
  createConfigKey,
  updateProtocolConfigAddresses
};