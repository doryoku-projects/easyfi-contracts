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

async function deployAggregator() {
  console.log("[DEPLOY] Deploying AggregatorUpgradeable...");

  // Obtén la fábrica del contrato Agregador Upgradeable
  const AggregatorUpgradeable = await ethers.getContractFactory(
    "AggregatorUpgradeable"
  );

  const userManagerUpgradeableAddress = getDeploymentAddress("UserManagerUpgradeable");
  const protocolConfigAddress = getDeploymentAddress("ProtocolConfigUpgradeable");

  const migrationSize = 150;

  // Despliega el proxy upgradeable, inicializando el contrato con las direcciones
  const aggregator = await upgrades.deployProxy(
    AggregatorUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress, migrationSize],
    { initializer: "initialize" }
  );
  await aggregator.waitForDeployment();
  const deployedAddress = await aggregator.getAddress();

  console.log("[DEPLOY] AggregatorUpgradeable deployed at:", deployedAddress);

  const filePath = path.join(__dirname, "../deployments.json");

  let deployments = {};
  if (fs.existsSync(filePath)) {
    deployments = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  deployments["AggregatorUpgradeable"] = deployedAddress;
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
  console.log("[DEPLOY] Address saved to deployments.json");
}

module.exports = deployAggregator;


// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error("[DEPLOY] Error in AggregatorUpgradeable:", error);
//     process.exit(1);
//   });
