// scripts/deployAggregator.js
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

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

async function deployLiquidityManager() {
  console.log("[DEPLOY] Deploying LiquidityManagerUpgradeable...");
  
  // Obtén la fábrica del contrato Agregador Upgradeable
  const LiquidityManagerUpgradeable = await ethers.getContractFactory(
    "LiquidityManagerUpgradeable"
  );

  // const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  // const userManagerUpgradeableAddress = process.env.USER_MANAGER_ADDRESS;

  const userManagerUpgradeableAddress = getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = getDeploymentAddress("ProtocolConfigUpgradeable");

  // Despliega el proxy upgradeable, inicializando el contrato con las direcciones
  const liquidityManager = await upgrades.deployProxy(
    LiquidityManagerUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress],
    { initializer: "initialize" }
  );
  await liquidityManager.waitForDeployment();
  const deployedAddress = await liquidityManager.getAddress();

  console.log(
    "[DEPLOY] LiquidityManagerUpgradeable deployed at:",
    deployedAddress
  );


  const filePath = path.join(__dirname, "../deployments.json");

  let deployments = {};
  if (fs.existsSync(filePath)) {
    deployments = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  deployments["LiquidityManagerUpgradeable"] = deployedAddress;
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
  console.log("[DEPLOY] Address saved to deployments.json");
}

module.exports = deployLiquidityManager;

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error("[DEPLOY] Error in LiquidityManagerUpgradeable:", error);
//     process.exit(1);
//   });
