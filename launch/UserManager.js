// scripts/deployUserManager.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployUserManager() {
  console.log("[DEPLOY] Deploying UserManagerUpgradeable...");
  let pepOwnerWallet, marcWallet, twoFAWallet, masterWallet;

  marcWallet = process.env.GENERAL_ADMIN_WALLET; // GENERAL_ADMIN
  pepOwnerWallet = process.env.USER_MANAGER_WALLET; // USER_MANAGER
  twoFAWallet = process.env.USER_2FA_WALLET; // 2FA_MANAGER
  masterWallet = process.env.MASTER_ADMIN_WALLET; // MASTER_ADMIN
 
  //CONTRACTS
  const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
  const liquidityManagerAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
  const liquidityHelperAddress = process.env.LIQUIDITY_HELPER_ADDRESS;
  const oracleSwapAddress = process.env.ORACLE_SWAP_ADDRESS;
  const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const maxRolesSize = 10;

  const UserManagerUpgradeable = await ethers.getContractFactory(
    "UserManagerUpgradeable"
  );
  // Define los administradores iniciales y los gestores de usuario iniciales.
  // Reemplaza estos valores con direcciones reales según tu caso.
  const initialAdmins = [marcWallet, masterWallet];
  const initialUserManagers = [pepOwnerWallet, masterWallet];
  const _2FAManagers = [twoFAWallet, masterWallet];
  const initialContracts = [
    protocolConfigAddress,
    vaultManagerAddress,
    liquidityManagerAddress,
    liquidityHelperAddress,
    oracleSwapAddress,
    aggregatorAddress,
  ];

  const oracle2FA = "0x6F054415fdF8FF8F923D81bc2F2DA53d290D169D";

  // Despliega el contrato como proxy upgradeable, invocando la función initialize

  const userManager = await upgrades.deployProxy(
    UserManagerUpgradeable,
    [
      initialAdmins,
      initialUserManagers,
      _2FAManagers,
      initialContracts,
      maxRolesSize,
    ],
    { initializer: "initialize" }
  );
  await userManager.waitForDeployment();
  const deployedAddress = await userManager.getAddress();
  console.log("[DEPLOY] UserManagerUpgradeable deployed at:", deployedAddress);

  const filePath = path.join(__dirname, "../deployments.json");

  let deployments = {};
  if (fs.existsSync(filePath)) {
    deployments = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  deployments["UserManagerUpgradeable"] = deployedAddress;

  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));

  console.log(`[DEPLOY] Address saved to deployments.json`);
}
deployUserManager().then(() => process.exit(0)).catch((error) => {
  console.error("[DEPLOY] Error in UserManagerUpgradeable:", error);
  process.exit(1);
});

module.exports = deployUserManager;

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error("[DEPLOY] Error in UserManagerUpgradeable:", error);
//     process.exit(1);
//   });
