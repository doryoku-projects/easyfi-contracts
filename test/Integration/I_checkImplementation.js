const { ethers } = require("hardhat");

async function getImplementationAddress(proxyAddress) {
  const EIP1967_IMPLEMENTATION_STORAGE_SLOT = '0x' + (
    BigInt(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("eip1967.proxy.implementation"))) - BigInt(1)
  ).toString(16);

  const implStorage = await ethers.provider.getStorageAt(
    proxyAddress,
    EIP1967_IMPLEMENTATION_STORAGE_SLOT
  );

  const implementationAddress = ethers.utils.getAddress('0x' + implStorage.slice(-40));

  return implementationAddress;
}

async function main() {
  const proxyAddress = "<DIRECCION_DEL_PROXY>"; // Cambia esto por la dirección de tu proxy
  
  console.log(`📌 Proxy address: ${proxyAddress}`);

  const implementationAddress = await getImplementationAddress(proxyAddress);
  
  console.log(`🚀 Implementation (Logic) address: ${implementationAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
