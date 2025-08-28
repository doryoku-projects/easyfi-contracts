const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const deployUserManager = require("./UserManager");
const deployProtocolConfig = require("./ProtocolConfig");
const deployVault = require("./Vault");
const deployLiquidityManager = require("./LiquidityManager");
const deployLiquidityHelper = require("./LiquidityHelper");
const deployOracleSwap = require("./OracleSwap");
const deployAggregator = require("./Aggregator");
const deployVaultProxy = require("./VaultProxy");

const DEPLOYMENTS_FILE = path.join(__dirname, "../deployments.json");

function getDeploymentAddress(contractName) {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    throw new Error("deployments.json not found.");
  }

  const deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf-8"));
  if (!deployments[contractName]) {
    throw new Error(`Address for ${contractName} not found in deployments.json`);
  }

  return deployments[contractName];
}

async function main() {
  console.log("🚀 Starting full deployment...");

  await deployUserManager();
  await deployProtocolConfig();
  await deployVault();
  await deployLiquidityManager();
  await deployOracleSwap();
  await deployLiquidityHelper();
  await deployAggregator();
  await deployVaultProxy();

  console.log("✅ All contracts deployed successfully!");

  const userManagerAddr = getDeploymentAddress("UserManagerUpgradeable");
  const ProtocolConfigAddr = getDeploymentAddress("ProtocolConfigUpgradeable");
  const VaultAddr = getDeploymentAddress("VaultUpgradeable");
  const LiquidityManagerAddr = getDeploymentAddress("LiquidityManagerUpgradeable");
  const LiquidityHelperAddr = getDeploymentAddress("LiquidityHelperUpgradeable");
  const OracleSwapAddr = getDeploymentAddress("OracleSwapUpgradeable");
  const AggregatorAddr = getDeploymentAddress("AggregatorUpgradeable");
  const VaultProxyAddr = getDeploymentAddress("VaultProxyUpgradeable");

  console.log("🔗 Attaching to UserManagerUpgradeable at:", userManagerAddr);
  console.log("🔗 Attaching to ProtocolConfigUpgradeable at:", ProtocolConfigAddr);
  console.log("🔗 Attaching to VaultUpgradeable at:", VaultAddr);
  console.log("🔗 Attaching to LiquidityManagerUpgradeable at:", LiquidityManagerAddr);
  console.log("🔗 Attaching to LiquidityHelperUpgradeable at:", LiquidityHelperAddr);
  console.log("🔗 Attaching to OracleSwapUpgradeable at:", OracleSwapAddr);
  console.log("🔗 Attaching to AggregatorUpgradeable at:", AggregatorAddr);
  console.log("🔗 Attaching to VaultProxyUpgradeable at:", VaultProxyAddr);

  const initialContracts = [
    ProtocolConfigAddr,
    VaultAddr,
    LiquidityManagerAddr,
    LiquidityHelperAddr,
    OracleSwapAddr,
    AggregatorAddr,
  ];

  const [owner, marcWallet, pepOwnerWallet] = await ethers.getSigners();
  const userManagerContract = await ethers.getContractAt("UserManagerUpgradeable", userManagerAddr, marcWallet);
  const userManagertx = await userManagerContract.addContracts(initialContracts);
  await userManagertx.wait();

  console.log("✅ Added Contracts in UserManager");

  const key = (s) =>
    ethers.keccak256(ethers.toUtf8Bytes(s));

  const addressKeys = [
    "VaultManager",
    "LiquidityManager",
    "LiquidityHelper",
    "OracleSwap",
    "Aggregator",
    "VaultProxy",
  ].map(key);

  const addressValues = [
    VaultAddr,
    LiquidityManagerAddr,
    LiquidityHelperAddr,
    OracleSwapAddr,
    AggregatorAddr
  ];

  const ProtocolConfigContract = await ethers.getContractAt("ProtocolConfigUpgradeable", ProtocolConfigAddr);

  for (let i = 0; i < addressValues.length; i++) {
    const key = addressKeys[i];
    const newVal = addressValues[i];

    if (!newVal || newVal === ethers.ZeroAddress) {
      console.log(`Skipping zero address for ${key}`);
      continue;
    }

    let current = ethers.ZeroAddress;
    try {
      current = await ProtocolConfigContract.getAddress(key);
      console.log(`Current for ${key}: ${current}`);
    } catch (err) {
      console.log(`⚠️ getAddress failed for ${key}, possibly uninitialized`);
    }

    if (current && current.toLowerCase() === newVal.toLowerCase()) {
      console.log(`⏭️ Skipping unchanged address: ${key}`);
      continue;
    }

    const isAdmin = await userManagerContract.connect(pepOwnerWallet).isMasterAdmin(owner.address);
    console.log(`Signer is master admin: ${isAdmin}`);

    if (!isAdmin) {
      console.log(`❌ Cannot set ${key}, signer not MasterAdmin`);
      continue;
    }

    console.log(`🔄 Updating ${key} -> ${newVal}`);
    try {
      const tx = await ProtocolConfigContract.setAddress(addressKeys[i], addressValues[i]);
      await tx.wait();
      console.log(`✅ Updated ${key}`);
    } catch (error) {
      console.log(`❌ Failed to update ${key}: ${error.message}`);
    }
  }
  await ProtocolConfigContract.setPackageCap(1, 1000000000, 2000000000, 50)
  await ProtocolConfigContract.setPackageCap(2, 10000000000, 20000000000, 70)

  console.log("✅ Added Contracts in ProtocolConfig");

  //   const VaultContract = await ethers.getContractAt("VaultManagerUpgradeable", VaultAddr);

  //   const Vaulttx = await VaultContract.setProtocolConfigAddress(ProtocolConfigAddr);
  //   await Vaulttx.wait();

  //   const Vaulttx1 = await VaultContract.setUserManagerAddress(userManagerAddr);
  //   await Vaulttx1.wait();

  //   console.log("✅ Added Contracts in Vault");

  //   const LiquidityManagerContract = await ethers.getContractAt("LiquidityManagerUpgradeable", LiquidityManagerAddr);

  //   const LiquidityManagertx = await LiquidityManagerContract.setProtocolConfigAddress(ProtocolConfigAddr);
  //   await LiquidityManagertx.wait();

  //   const LiquidityManagert1 = await LiquidityManagerContract.setUserManagerAddress(userManagerAddr);
  //   await LiquidityManagert1.wait();

  //   console.log("✅ Added Contracts in LiquidityManager");

  //   const LiquidityHelperContract = await ethers.getContractAt("LiquidityHelperUpgradeable", LiquidityHelperAddr);

  //   const LiquidityHelpertx = await LiquidityHelperContract.setProtocolConfigAddress(ProtocolConfigAddr);
  //   await LiquidityHelpertx.wait();

  //   const LiquidityHelpertx1 = await LiquidityHelperContract.setUserManagerAddress(userManagerAddr);
  //   await LiquidityHelpertx1.wait();

  //   console.log("✅ Added Contracts in LiquidityHelper");

  //   const OracleSwapContract = await ethers.getContractAt("OracleSwapUpgradeable", OracleSwapAddr);

  //   const OracleSwaptx = await OracleSwapContract.setProtocolConfigAddress(ProtocolConfigAddr);
  //   await OracleSwaptx.wait();

  //   const OracleSwaptx1 = await OracleSwapContract.setUserManagerAddress(userManagerAddr);
  //   await OracleSwaptx1.wait();

  //   console.log("✅ Added Contracts in OracleSwap");


  //   const AggregatorContract = await ethers.getContractAt("AggregatorUpgradeable", AggregatorAddr);

  //   const Aggregatortx = await AggregatorContract.setProtocolConfigAddress(ProtocolConfigAddr);
  //   await Aggregatortx.wait();

  //   const Aggregatortx1 = await AggregatorContract.setUserManagerAddress(userManagerAddr);
  //   await Aggregatortx1.wait();

  //   console.log("✅ Added Contracts in Aggregator");

}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
