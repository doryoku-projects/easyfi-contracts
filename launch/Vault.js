const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
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

async function deployVault() {
  console.log("[DEPLOY] Deploying VaultUpgradeable on Tenderly.");

  const userManagerUpgradeableAddress = getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = getDeploymentAddress("ProtocolConfigUpgradeable");

  const maxWithdrawalSize = 150;

  const VaultManagerUpgradeable = await ethers.getContractFactory(
    "VaultManagerUpgradeable"
  );

  const vault = await upgrades.deployProxy(
    VaultManagerUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress, maxWithdrawalSize],
    {
      initializer: "initialize",
    }
  );

  const vaultContract = await vault.waitForDeployment();
  const deployedAddress = await vaultContract.getAddress();

  console.log(`[DEPLOY] VaultUpgradeable deployed to: ${deployedAddress}`);

  const filePath = path.join(__dirname, "../deployments.json");

  // Load existing data or start fresh
  let deployments = {};
  if (fs.existsSync(filePath)) {
    deployments = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  // Add this contract
  deployments["VaultUpgradeable"] = deployedAddress;

  // Write file
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));

  console.log("[DEPLOY] Address saved to deployments.json");
}

module.exports = deployVault;

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
