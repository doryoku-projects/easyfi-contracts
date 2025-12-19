const { ethers, run, network } = require("hardhat");
const { getDeploymentAddress, storeDeployment } = require("../DeploymentStore");

async function upgradeContract({
  contractName,
  proxyStorageKey,
  verifyContract = true,
  reinitializeFunctionName = null,
  reinitializeArgs = []
}) {
  const [, admin] = await ethers.getSigners();
  
  console.log(`\n🔄 Upgrading ${contractName}...`);
  
  const proxyAddress = await getDeploymentAddress(proxyStorageKey);
  console.log(`Proxy: ${proxyAddress}`);

  const NewImplementation = await ethers.getContractFactory(contractName, admin);
  
  const newImplementation = await NewImplementation.deploy();
  await newImplementation.waitForDeployment();
  const newImplementationAddress = await newImplementation.getAddress();
  
  console.log(`Implementation: ${newImplementationAddress}`);

  const proxy = await ethers.getContractAt(contractName, proxyAddress, admin);

  let upgradeData = "0x";
  if (reinitializeFunctionName && reinitializeArgs.length > 0) {
    upgradeData = newImplementation.interface.encodeFunctionData(
      reinitializeFunctionName,
      reinitializeArgs
    );
  }

  const tx = await proxy.upgradeToAndCall(newImplementationAddress, upgradeData);
  await tx.wait();
  console.log(`✅ Upgraded\n`);

  await storeDeployment(
    `${proxyStorageKey}_impl_${Date.now()}`,
    newImplementationAddress
  );
  
  return { proxyAddress, newImplementationAddress };
}

async function getCurrentImplementation(proxyAddress) {
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implHex = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  const implementationAddress = ethers.getAddress("0x" + implHex.slice(-40));
  console.log(`Implementation: ${implementationAddress}`);
  return implementationAddress;
}

module.exports = {
  upgradeContract,
  getCurrentImplementation
};