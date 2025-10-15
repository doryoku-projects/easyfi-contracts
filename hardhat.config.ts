import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@tenderly/hardhat-tenderly";
// require("@nomicfoundation/hardhat-verify");

import "dotenv/config";

const normalizeKey = (key?: string) =>
  key ? (key.startsWith("0x") ? key : `0x${key}`) : undefined;

// Collect keys from env
const privateKeys = [
  process.env.NEW_DEPLOYER_PRIVATE_KEY,
  process.env.MASTER_ADMIN_PRIVATE_KEY,
  process.env.GENERAL_ADMIN_PRIVATE_KEY,
  process.env.USER_MANAGER_PRIVATE_KEY,
  process.env.USER_2FA_PRIVATE_KEY,
  process.env.USER_PRIVATE_KEY,
]
  .map(normalizeKey)
  .filter(Boolean) as string[];

const localAccounts = privateKeys.map((key) => ({
  privateKey: key,
  balance: "1000000000000000000000000", // 1M ETH
}));

const config: HardhatUserConfig = {
  defaultNetwork: "virtual",
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  sourcify: {
    enabled: false
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.ARBITRUM_MAINNET_RPC_URL || "",
      },
      accounts: localAccounts,
      chainId: 42161,
    },
    // hardhat: {
    //   forking: {
    //     url: process.env.MAINNET_RPC_URL || "",
    //   },
    //   accounts: localAccounts,
    //   chainId: 1,
    // },
    arbitrumOne: {
      url: process.env.ARBITRUM_MAINNET_RPC_URL,
      chainId: 42161,
      accounts: privateKeys,
    },
    base: {
      url: process.env.BASE_MAINNET_RPC_URL,
      accounts: [`0x${process.env.MASTER_ADMIN_PRIVATE_KEY}`],
      chainId: 8453,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      chainId: 1,
      accounts: privateKeys,
    },
    polygon: {
      url: process.env.POLYGON_MAINNET_RPC_URL,
      chainId: 137,
      accounts: privateKeys,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 120000,
      accounts: privateKeys,
      chainId: 42161,
      forking: {
        url: process.env.ARBITRUM_MAINNET_RPC_URL || "",
      },
    },
    virtual: {
      url: process.env.TENDERLY_RPC_URL,
      chainId: 12345,
      accounts: process.env.MASTER_ADMIN_PRIVATE_KEY
        ? [`0x${process.env.MASTER_ADMIN_PRIVATE_KEY}`]
        : [],
    },
    
  },
  // tenderly: {
  //   project: process.env.TENDERLY_PROJECT ?? "",
  //   username: process.env.TENDERLY_USERNAME ?? "",
  //   // privateVerification: true,
  // },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    // customChains: [
    //   {
    //     network: "virtual",
    //     chainId: 12345,
    //     urls: {
    //       apiURL: `${process.env.TENDERLY_RPC_URL}/verify/etherscan`,
    //       browserURL: `${process.env.TENDERLY_RPC_URL}`,
    //     },
    //   },
    // ],
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
