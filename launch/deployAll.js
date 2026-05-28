const { ethers } = require("hardhat");
const { getDeploymentAddress } = require("./DeploymentStore");
const { updateProtocolConfigAddresses, setDepositNFTAddress } = require("./DeploymentHelper");

const deployUserManager = require("./UserManager");
const deployProtocolConfig = require("./ProtocolConfig");
const deployAggregator = require("./Aggregator");
const deployVault = require("./Vault");
const deployLiquidityManager = require("./LiquidityManager");
const deployLiquidityHelper = require("./LiquidityHelper");
const deployOracleSwap = require("./OracleSwap");
const deployFundsManager = require("./FundsManager");

async function main() {
    console.log("🚀 Starting full deployment...", process.env.WHITELABEL);
  
  await deployUserManager();
  await deployProtocolConfig();
  await deployAggregator();
  await deployVault();
  await deployLiquidityManager();
  await deployLiquidityHelper();
  await deployOracleSwap();
  await deployFundsManager();
  console.log("\n✅ All contracts deployed\n");

  const userManagerAddr = await getDeploymentAddress("UserManagerUpgradeable");
    const ProtocolConfigAddr = await getDeploymentAddress("ProtocolConfigUpgradeable");
    const VaultAddr = await getDeploymentAddress("VaultManagerUpgradeable");
    const LiquidityManagerAddr = await getDeploymentAddress("LiquidityManagerUpgradeable");
    const LiquidityHelperAddr = await getDeploymentAddress("LiquidityHelperUpgradeable");
    const OracleSwapAddr = await getDeploymentAddress("OracleSwapUpgradeable");
    const AggregatorAddr = await getDeploymentAddress("AggregatorUpgradeable");
    const FundsManagerAddr = await getDeploymentAddress("FundsManagerUpgradeable");
    console.log("🔗 Attaching to UserManagerUpgradeable at:", userManagerAddr);
    console.log("🔗 Attaching to ProtocolConfigUpgradeable at:", ProtocolConfigAddr);
    console.log("🔗 Attaching to VaultManagerUpgradeable at:", VaultAddr);
    console.log("🔗 Attaching to LiquidityManagerUpgradeable at:", LiquidityManagerAddr);
    console.log("🔗 Attaching to LiquidityHelperUpgradeable at:", LiquidityHelperAddr);
    console.log("🔗 Attaching to OracleSwapUpgradeable at:", OracleSwapAddr);
    console.log("🔗 Attaching to AggregatorUpgradeable at:", AggregatorAddr);
    console.log("🔗 Attaching to FundsManagerUpgradeable at:", FundsManagerAddr);
    const initialContracts = [
      ProtocolConfigAddr,
      VaultAddr,
      LiquidityManagerAddr,
      LiquidityHelperAddr,
      OracleSwapAddr,
      AggregatorAddr,
      FundsManagerAddr
    ];

    const [new_addr, owner , marcWallet, ] = await ethers.getSigners();
    const userManagerContract = await ethers.getContractAt("UserManagerUpgradeable", userManagerAddr, marcWallet);
    console.log("### ~ deployAll.js:57 ~ main ~ userManagerAddr:", userManagerAddr);

    const userManagertx = await userManagerContract.addContracts(initialContracts);
    await userManagertx.wait();
    console.log("✅ Added Contracts in UserManager");

    console.log("\n🔗 Updating ProtocolConfig addresses...");
  await updateProtocolConfigAddresses({
    protocolConfigAddress: ProtocolConfigAddr,
    userManagerContract: userManagerContract,
    addressMapping: {
      VaultManager: VaultAddr,
      LiquidityManager: LiquidityManagerAddr,
      LiquidityHelper: LiquidityHelperAddr,
      OracleSwap: OracleSwapAddr,
      Aggregator: AggregatorAddr,
      FundsManager: FundsManagerAddr
    }
  });
  console.log("✅ Added Contracts in ProtocolConfig");

  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("   Deployment failed:", error);
    process.exit(1);
  });
