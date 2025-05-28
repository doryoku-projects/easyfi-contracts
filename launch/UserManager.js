// scripts/deployUserManager.js
const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying UserManagerUpgradeable...");
  let ownerWallet, userWallet, pepOwnerWallet, marcWallet;

  ownerWallet = process.env.OWNER_WALLET;
  marcWallet = process.env.MARC_WALLET;
  pepOwnerWallet = process.env.PEP_WALLET;
  userWallet = process.env.USER_WALLET;

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
  const initialAdmins = [marcWallet];
  const initialUserManagers = [pepOwnerWallet];
  const _2FAManagers = [pepOwnerWallet];
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
  console.log("UserManagerUpgradeable desplegado en:", userManager.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
