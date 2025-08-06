/**
 * Network Configuration for Testnet → Mainnet Migration
 * 
 * This centralized config makes it easy to switch between environments
 * Just change NODE_ENV or NETWORK environment variable
 */

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  
  // Token configuration
  gugoTokenAddress: string;
  gugoTokenName: string;
  gugoTokenSymbol: string;
  
  // Economic configuration  
  ethPriceUSD: bigint;      // Price * 1e8
  gugoPriceUSD: bigint;     // Price * 1e8
  
  // Game configuration (same across networks)
  votePriceCents: number;
  minimumVotes: number;
  dailyFreeVotes: number;
}

// TESTNET CONFIGURATION (FGUGO using real GUGO pricing)
export const TESTNET_CONFIG: NetworkConfig = {
  name: "abstractTestnet",
  chainId: 11124,
  rpcUrl: "https://api.testnet.abs.xyz",
  explorerUrl: "https://explorer.testnet.abs.xyz",
  
  // FGUGO (Fake GUGO for testing, but uses real GUGO market price)
  gugoTokenAddress: "0x3eAd960365697E1809683617af9390ABC9C24E56",
  gugoTokenName: "Fake GUGO (using real price)",
  gugoTokenSymbol: "FGUGO",
  
  // IMPORTANT: Use real GUGO market price for consistency
  // These prices should be updated regularly based on live market data
  ethPriceUSD: BigInt("320000000000"),  // $3200 * 1e8 (live market price)
  gugoPriceUSD: BigInt("500000"),       // $0.005 * 1e8 (real market rate - 500 Licks = 2,000 GUGO)
  
  // Game mechanics (identical to mainnet)
  votePriceCents: 2,        // $0.02 per vote (updated from $0.04)
  minimumVotes: 10,         // 10 vote minimum
  dailyFreeVotes: 3,        // 3 free votes per day
};

// MAINNET CONFIGURATION (Real GUGO)
export const MAINNET_CONFIG: NetworkConfig = {
  name: "abstractMainnet", 
  chainId: 26026,
  rpcUrl: "https://api.mainnet.abs.xyz",
  explorerUrl: "https://explorer.abs.xyz",
  
  // Real GUGO token (to be updated when deployed)
  gugoTokenAddress: process.env.MAINNET_GUGO_TOKEN_ADDRESS || "0x_REAL_GUGO_MAINNET_ADDRESS",
  gugoTokenName: "GUGO",
  gugoTokenSymbol: "GUGO",
  
  // Mainnet pricing (live market values)
  ethPriceUSD: BigInt("320000000000"),  // $3200 * 1e8 (live market price)
  gugoPriceUSD: BigInt("500000"),       // $0.005 * 1e8 (real market rate - 500 Licks = 2,000 GUGO)
  
  // Game mechanics (identical to testnet)
  votePriceCents: 2,        // $0.02 per vote (updated from $0.04)
  minimumVotes: 10,         // 10 vote minimum  
  dailyFreeVotes: 3,        // 3 free votes per day
};

// AUTO-DETECT CURRENT NETWORK
export function getCurrentNetworkConfig(): NetworkConfig {
  const network = process.env.NETWORK || process.env.NEXT_PUBLIC_CHAIN || "testnet";
  
  switch (network.toLowerCase()) {
    case "mainnet":
    case "abstractmainnet":
    case "production":
      return MAINNET_CONFIG;
      
    case "testnet":  
    case "abstracttestnet":
    case "development":
    case "dev":
    default:
      return TESTNET_CONFIG;
  }
}

// MIGRATION UTILITIES
export function getVoteCosts(config: NetworkConfig) {
  const costUSD = config.votePriceCents * config.minimumVotes; // cents
  
  // Prevent division by zero
  const ethDenominator = config.ethPriceUSD / BigInt(1e6);
  const gugoDenominator = config.gugoPriceUSD / BigInt(1e6);
  
  const costETH = ethDenominator > 0 ? (BigInt(costUSD) * BigInt(1e18)) / ethDenominator : BigInt(0);
  const costGUGO = gugoDenominator > 0 ? (BigInt(costUSD) * BigInt(1e18)) / gugoDenominator : BigInt(0);
  
  return {
    usd: costUSD / 100, // dollars
    eth: costETH,
    gugo: costGUGO,
  };
}

export function getFrontendConfig(config: NetworkConfig) {
  return {
    NEXT_PUBLIC_CHAIN: config.name === "abstractMainnet" ? "mainnet" : "testnet",
    NEXT_PUBLIC_GUGO_CONTRACT: config.gugoTokenAddress,
    // NEXT_PUBLIC_VOTE_MANAGER_CONTRACT will be set after deployment
  };
}

// DEPLOYMENT HELPERS
export function validateConfig(config: NetworkConfig) {
  const errors: string[] = [];
  
  if (!config.gugoTokenAddress || config.gugoTokenAddress.includes("_REAL_")) {
    errors.push("GUGO token address not set");
  }
  
  if (config.ethPriceUSD <= 0) {
    errors.push("ETH price must be positive");
  }
  
  if (config.gugoPriceUSD <= 0) {
    errors.push("GUGO price must be positive"); 
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// DEVELOPMENT UTILITIES
export function logNetworkInfo(config: NetworkConfig) {
  console.log(`\n🌐 Network Configuration: ${config.name}`);
  console.log(`📋 Chain ID: ${config.chainId}`);
  console.log(`🔗 RPC URL: ${config.rpcUrl}`);
  console.log(`🪙 Token: ${config.gugoTokenName} (${config.gugoTokenSymbol})`);
  console.log(`📍 Address: ${config.gugoTokenAddress}`);
  
  const costs = getVoteCosts(config);
  console.log(`\n💰 Economics (${config.minimumVotes} votes = $${costs.usd}):`);
  console.log(`  - ETH: ${(Number(costs.eth) / 1e18).toFixed(6)} ETH`);
  console.log(`  - ${config.gugoTokenSymbol}: ${(Number(costs.gugo) / 1e18).toFixed(2)} ${config.gugoTokenSymbol}`);