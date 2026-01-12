const { deployUpgradeableContract, createConfigKey } = require("./DeploymentHelper");
const { getDeploymentAddress } = require("./DeploymentStore");
const CONFIG = require("./config");

async function deployProtocolConfig() {
  const { WALLETS, EXTERNAL, PROTOCOL, ADDRESSES_PER_CHAIN } = CONFIG;

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
    "ClientAddress",
  ].map(createConfigKey);

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const addressValues = [
    WALLETS.MASTER_ADMIN,     // VAULT_MANAGER 
    WALLETS.MASTER_ADMIN,     // LIQ_MANAGER 
    WALLETS.MASTER_ADMIN,     // LIQ_HELPER
    WALLETS.MASTER_ADMIN,     // ORACLE_SWAP
    WALLETS.MASTER_ADMIN,     // AGGREGATOR
    ADDRESSES_PER_CHAIN[chainId].UNISWAP_NFT_ADDRESS,
    ADDRESSES_PER_CHAIN[chainId].SWAP_ROUTER_ADDRESS,
    ADDRESSES_PER_CHAIN[chainId].FACTORY_ADDRESS,
    ADDRESSES_PER_CHAIN[chainId].MAIN_TOKEN_ADDRESS,
    EXTERNAL.CLIENT
  ];

  const uintKeys = ["BP", "CompanyFeePct", "ClientFeePct", "2FARequired"].map(createConfigKey);
  const uintValues = [
    PROTOCOL.BASE_POINT,
    PROTOCOL.COMPANY_FEE_PCT,
    PROTOCOL.CLIENT_FEE_PCT,
    PROTOCOL.TWO_FA_REQUIRED,
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