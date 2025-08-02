import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

require('dotenv').config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // Local development network
    },
    abstractTestnet: {
      url: "https://api.testnet.abs.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11124,
    },
    abstractMainnet: {
      url: "https://api.mainnet.abs.xyz", 
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 26026,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    // Abstract Chain explorer API (when available)
    apiKey: {
      abstractTestnet: process.env.ABSTRACT_API_KEY || "",
      abstractMainnet: process.env.ABSTRACT_API_KEY || "",
    },
    customChains: [
      {
        network: "abstractTestnet",
        chainId: 11124,
        urls: {
          apiURL: "https://api-testnet.abs.xyz/api",
          browserURL: "https://explorer.testnet.abs.xyz",
        },
      },
      {
        network: "abstractMainnet", 
        chainId: 26026,
        urls: {
          apiURL: "https://api.abs.xyz/api",
          browserURL: "https://explorer.abs.xyz",
        },
      },
    ],
  },
};

export default config; 