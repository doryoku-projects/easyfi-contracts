import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@tenderly/hardhat-tenderly";

import "dotenv/config";

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
  networks: {
    base: {
      url: process.env.BASE_MAINNET_RPC_URL,
      accounts: [`0x${process.env.OWNER_PRIVATE_KEY}`],
      chainId: 8453
    },
    virtual: {
      url: process.env.TENDERLY_RPC_URL,
      chainId: 12345,
      accounts: process.env.OWNER_PRIVATE_KEY
        ? [`0x${process.env.OWNER_PRIVATE_KEY}`]
        : [],
    },
    mainnet: {
      url: process.env.ARBITRUM_MAINNET_RPC_URL,
      chainId: 42161,
      accounts: [`0x${process.env.OWNER_PRIVATE_KEY}`],
    },
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT ?? "",
    username: process.env.TENDERLY_USERNAME ?? "",
    // privateVerification: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "virtual",
        chainId: 12345,
        urls: {
          apiURL: `${process.env.TENDERLY_RPC_URL}/verify/etherscan`,
          browserURL: `${process.env.TENDERLY_RPC_URL}`,
        },
      },
    ],
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
