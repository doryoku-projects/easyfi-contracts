const { ethers } = require("hardhat");
const { storeDeployment, getFactoryDeploymentAddress } = require("./DeploymentStore");

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
  const [deployer, MasterAdmin] = await ethers.getSigners();

  const whitelabel = process.env.WHITELABEL;
  console.log(`[DEPLOY] ${displayName || contractName}...`);

  // Get current nonce from network to avoid cache issues
  const currentNonce = await ethers.provider.getTransactionCount(deployer.address, 'latest');
  console.log(`Current deployer nonce: ${currentNonce}`);

  const ContractFactory = await ethers.getContractFactory(contractName, deployer);
  const implementation = await ContractFactory.deploy({ nonce: currentNonce });
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  console.log(`Implementation deployed: ${implementationAddress}`);

  const initData = implementation.interface.encodeFunctionData(
    "initialize",
    initializeArgs
  );

  const salt = saltPrefix + "_" + whitelabel.toUpperCase();
  console.log(`Using salt: ${salt}`);

  const PROXY_SALT = ethers.keccak256(
    ethers.solidityPacked(
      ["string", "address"],
      [salt, deployer.address]
    )
  );

  const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
  const factoryAddress = await getFactoryDeploymentAddress();
  const proxyFactoryContract = ProxyFactory.attach(factoryAddress).connect(deployer);

  const predictedProxyAddress = await proxyFactoryContract.getDeployed(PROXY_SALT);
  console.log(`Predicted proxy: ${predictedProxyAddress}`);

  // Get fresh nonce for proxy deployment (implementation used currentNonce)
  const proxyNonce = await ethers.provider.getTransactionCount(deployer.address, 'latest');
  console.log(`Proxy deployment nonce: ${proxyNonce}`);

  const tx = await proxyFactoryContract.deploy(
    implementationAddress,
    initData,
    PROXY_SALT,
    { nonce: proxyNonce }
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

  const [deployer, owner, marcWallet, pepOwnerWallet] = await ethers.getSigners();

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

async function setDepositNFTAddress(tokenVaultAddress, nftAddress) {
  const [deployer, owner, marcWallet, pepOwnerWallet] = await ethers.getSigners();

  const TokenVaultContract = await ethers.getContractAt(
    "TokenVaultUpgradeable",
    tokenVaultAddress,
    owner
  );

  try {
    const tx = await TokenVaultContract.setDepositNFT(nftAddress);
    await tx.wait();
    console.log(`✅ Set Deposit NFT address to ${nftAddress}`);
  } catch (error) {
    console.log(`❌ Failed to set Deposit NFT address: ${error.message}`);
  }
}


module.exports = {
  deployUpgradeableContract,
  createConfigKey,
  updateProtocolConfigAddresses,
  setDepositNFTAddress
};