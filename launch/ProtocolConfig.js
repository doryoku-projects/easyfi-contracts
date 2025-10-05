const { deployUpgradeableContract, createConfigKey } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployProtocolConfig() {
  const { WALLETS, EXTERNAL, PROTOCOL } = CONFIG;

  const USER_MANAGER = await getDeploymentAddress("UserManagerUpgradeable");

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
  ].map(createConfigKey);

  const addressValues = [
    WALLETS.MASTER_ADMIN,
    WALLETS.MASTER_ADMIN,
    WALLETS.MASTER_ADMIN,
    WALLETS.MASTER_ADMIN,
    WALLETS.MASTER_ADMIN,
    EXTERNAL.UNISWAP_NFT,
    EXTERNAL.SWAP_ROUTER,
    EXTERNAL.FACTORY,
    EXTERNAL.MAIN_TOKEN,
    EXTERNAL.CLIENT
  ];

  const uintKeys = ["BP", "CompanyFeePct", "ClientFeePct"].map(createConfigKey);
  const uintValues = [
    PROTOCOL.BASE_POINT,
    PROTOCOL.COMPANY_FEE_PCT,
    PROTOCOL.CLIENT_FEE_PCT
  ];

  const initializeArgs = [USER_MANAGER, addressKeys, addressValues, uintKeys, uintValues];

  return await deployUpgradeableContract({
    contractName: "ProtocolConfigUpgradeable",
    displayName: "ProtocolConfig",
    initializeArgs,
    saltPrefix: CONFIG.SALTS.PROTOCOL_CONFIG,
    storageKey: "ProtocolConfigUpgradeable"
  });
}

module.exports = deployProtocolConfig;