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

async function deployProtocolConfig() {
  console.log("[DEPLOY] Deploying ProtocolConfigUpgradeable...");
  
  // Carga las variables de entorno desde el archivo .env
  // const USER_MANAGER = process.env.USER_MANAGER_ADDRESS;
  const USER_MANAGER = getDeploymentAddress("UserManagerUpgradeable");

  const VAULT_MANAGER = process.env.MASTER_ADMIN_WALLET;
  const LIQ_MANAGER = process.env.MASTER_ADMIN_WALLET;
  const LIQ_HELPER = process.env.MASTER_ADMIN_WALLET;
  const ORACLE_SWAP = process.env.MASTER_ADMIN_WALLET;
  const AGGREGATOR = process.env.MASTER_ADMIN_WALLET;
  const NFPM = process.env.UNISWAP_NFT_ADDRESS;
  const SWAP_ROUTER = process.env.SWAP_ROUTER_ADDRESS;
  const FACTORY = process.env.FACTORY_ADDRESS;
  const MAIN_TOKEN = process.env.MAIN_TOKEN_ADDRESS;
  const CLIENT_ADDRESS = process.env.CLIENT_ADDRESS;

  // const key = (s) => ethers.encodeBytes32String(s);
  const key = (s) =>
    ethers.keccak256(ethers.toUtf8Bytes(s));

  const addressKeys = [
    "VaultManager",
    "LiquidityManager",
    "LiquidityHelper",
    "OracleSwap",
    "Aggregator",
    "NFTPositionMgr",
    "SwapRouter",
    "Factory",
    "MainToken",
    "ClientAddress"
  ].map(key);

  const addressValues = [
    VAULT_MANAGER,
    LIQ_MANAGER,
    LIQ_HELPER,
    ORACLE_SWAP,
    AGGREGATOR,
    NFPM,
    SWAP_ROUTER,
    FACTORY,
    MAIN_TOKEN,
    CLIENT_ADDRESS
  ];

  const uintKeys = [
    "BP",
    "CompanyFeePct",
    "ClientFeePct"
  ].map(key);
  
  const uintValues = [
    10000, // Base Point (100%)
    3000, // company fee percentage (30%)
    5000 // client fee percentage (50%)
  ];

  const ProtocolConfigUpgradeable = await ethers.getContractFactory(
    "ProtocolConfigUpgradeable"
  );

  const protocolConfig = await upgrades.deployProxy(
    ProtocolConfigUpgradeable,
    [USER_MANAGER, addressKeys, addressValues, uintKeys, uintValues],
    {
      initializer: "initialize",
    }
  );
  const protocolConfigContract = await protocolConfig.waitForDeployment();
  const deployedAddress = await protocolConfigContract.getAddress();

  console.log(
    `[DEPLOY] ProtocolConfigUpgradeable deployed to: ${deployedAddress}`
  );

  const filePath = path.join(__dirname, "../deployments.json");

  let deployments = {};
  if (fs.existsSync(filePath)) {
    deployments = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  deployments["ProtocolConfigUpgradeable"] = deployedAddress;
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
  console.log("[DEPLOY] Address saved to deployments.json");
}

module.exports = deployProtocolConfig;

// deployProtocolConfig()
//   .then(() => process.exit(0))
//   .catch((err) => {
//     console.error("[DEPLOY] Error in ProtocolConfigUpgradeable:", err);
//     process.exit(1);
//   });
