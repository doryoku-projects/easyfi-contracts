const { deployUpgradeableContract } = require("./DeploymentHelper");
const CONFIG = require("./config");

async function deployUserManager() {
  const { WALLETS, PROTOCOL } = CONFIG;

  const initialAdmins = [WALLETS.GENERAL_ADMIN, WALLETS.MASTER_ADMIN];
  const initialUserManagers = [WALLETS.USER_MANAGER, WALLETS.MASTER_ADMIN];
  const _2FAManagers = [WALLETS.USER_2FA, WALLETS.MASTER_ADMIN];
  const whitelabel = process.env.WHITELABEL;

  const initialContracts = [
    process.env.PROTOCOL_CONFIG_ADDRESS,
    process.env.VAULT_MANAGER_ADDRESS,
    process.env.LIQUIDITY_MANAGER_ADDRESS,
    process.env.LIQUIDITY_HELPER_ADDRESS,
    process.env.ORACLE_SWAP_ADDRESS,
    process.env.AGGREGATOR_ADDRESS
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
    saltPrefix: CONFIG.SALTS[whitelabel].USER_MANAGER,
    storageKey: "UserManagerUpgradeable"
  });
}

module.exports = deployUserManager;