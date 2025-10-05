const { deployUpgradeableContract } = require("./DeploymentHelper");
const CONFIG = require("./config");

async function deployUserManager() {
  const { WALLETS, PROTOCOL } = CONFIG;

  const initialAdmins = [WALLETS.GENERAL_ADMIN, WALLETS.MASTER_ADMIN];
  const initialUserManagers = [WALLETS.USER_MANAGER, WALLETS.MASTER_ADMIN];
  const _2FAManagers = [WALLETS.USER_2FA, WALLETS.MASTER_ADMIN];

  const initialContracts = [
    process.env.PROTOCOL_CONFIG_ADDRESS || ethers.ZeroAddress,
    process.env.VAULT_MANAGER_ADDRESS || ethers.ZeroAddress,
    process.env.LIQUIDITY_MANAGER_ADDRESS || ethers.ZeroAddress,
    process.env.LIQUIDITY_HELPER_ADDRESS || ethers.ZeroAddress,
    process.env.ORACLE_SWAP_ADDRESS || ethers.ZeroAddress,
    process.env.AGGREGATOR_ADDRESS || ethers.ZeroAddress
  ];

  const initializeArgs = [
    initialAdmins,
    initialUserManagers,
    _2FAManagers,
    initialContracts,
    PROTOCOL.MAX_ROLES_SIZE
  ];

  return await deployUpgradeableContract({
    contractName: "UserManagerUpgradeable",
    displayName: "UserManager",
    initializeArgs,
    saltPrefix: CONFIG.SALTS.USER_MANAGER,
    storageKey: "UserManagerUpgradeable"
  });
}

module.exports = deployUserManager;