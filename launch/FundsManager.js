const { ethers, upgrades } = require("hardhat");
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

async function deployFundsManager() {
  console.log("[DEPLOY] Deploying FundsManagerUpgradeable...");

  // Obtén la fábrica del contrato fundsManager Upgradeable
  const FundsManagerUpgradeable = await ethers.getContractFactory(
    "FundsManagerUpgradeable"
  );
  // Define las direcciones de los módulos (estas pueden ser de contratos ya desplegados)
  // const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  // const userManagerUpgradeableAddress = process.env.USER_MANAGER_ADDRESS;

  const userManagerUpgradeableAddress = getDeploymentAddress("UserManagerUpgradeable");


  // Despliega el proxy upgradeable, inicializando el contrato con las direcciones
  const fundsManager = await upgrades.deployProxy(
    FundsManagerUpgradeable,
    [userManagerUpgradeableAddress],
    { initializer: "initialize" }
  );
  await fundsManager.waitForDeployment();
  const deployedAddress = await fundsManager.getAddress();

  console.log("[DEPLOY] FundsManagerUpgradeable deployed at:", deployedAddress);

  const filePath = path.join(__dirname, "../deployments.json");

  let deployments = {};
  if (fs.existsSync(filePath)) {
    deployments = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  deployments["FundsManagerUpgradeable"] = deployedAddress;
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
  console.log("[DEPLOY] Address saved to deployments.json");
}

module.exports = deployFundsManager;

