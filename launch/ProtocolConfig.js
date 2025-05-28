const { ethers, upgrades } = require("hardhat");

async function main() {
  const USER_MANAGER = process.env.USER_MANAGER_ADDRESS;
  const VAULT_MANAGER = process.env.VAULT_MANAGER_ADDRESS;
  const LIQ_MANAGER = process.env.LIQUIDITY_MANAGER_ADDRESS;
  const LIQ_HELPER = process.env.LIQUIDITY_HELPER_ADDRESS;
  const ORACLE_SWAP = process.env.ORACLE_SWAP_ADDRESS;
  const AGGREGATOR = process.env.AGGREGATOR_ADDRESS;
  const NFPM = process.env.UNISWAP_NFT_ADDRESS;
  const SWAP_ROUTER = process.env.SWAP_ROUTER_ADDRESS;
  const FACTORY = process.env.FACTORY_ADDRESS;
  const MAIN_TOKEN = process.env.MAIN_TOKEN_ADDRESS;

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
  ];

  const uintKeys = [
    "BP", 
    "CompanyFeePct"
  ].map(key);
  
  const uintValues = [
    10000, 
    3000
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

  console.log(
    `[DEPLOY] VaultProxy deployed to: ${protocolConfigContract.address}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
