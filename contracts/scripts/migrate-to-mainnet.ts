import { ethers } from "hardhat";

/**
 * Mainnet Migration Script
 * 
 * This script demonstrates how to deploy to mainnet with real GUGO token
 * Only configuration changes - same smart contract code!
 */

async function main() {
  console.log("🚀 Deploying to MAINNET with real GUGO token...");

  const [deployer] = await ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  
  // Verify we're on mainnet
  if (network.chainId !== 26026n) {
    throw new Error(`Expected Abstract Mainnet (26026), got ${network.chainId}`);
  }

  console.log("📝 Deploying with account:", deployer.address);
  console.log("🌐 Network: Abstract Mainnet");

  // MAINNET CONFIGURATION
  const MAINNET_CONFIG = {
    // Real GUGO token on mainnet (to be provided when available)
    gugoTokenAddress: process.env.MAINNET_GUGO_TOKEN_ADDRESS || 
      "0x_REAL_GUGO_MAINNET_ADDRESS_HERE",
    
    // Mainnet pricing 
    ethPrice: ethers.parseUnits("3200", 8),    // $3200 * 1e8
    gugoPrice: ethers.parseUnits("0.50", 8),   // $0.50 * 1e8 (estimated)
    
    // Same game mechanics
    votePriceCents: 4,      // $0.04 per vote
    minimumVotes: 10,       // 10 vote minimum
    dailyFreeVotes: 3,      // 3 free votes per day
  };

  console.log("💰 Mainnet Configuration:");
  console.log("  - GUGO Token:", MAINNET_CONFIG.gugoTokenAddress);
  console.log("  - ETH Price: $", ethers.formatUnits(MAINNET_CONFIG.ethPrice, 8));
  console.log("  - GUGO Price: $", ethers.formatUnits(MAINNET_CONFIG.gugoPrice, 8));

  // Calculate mainnet costs
  const voteCostUSD = MAINNET_CONFIG.votePriceCents * MAINNET_CONFIG.minimumVotes; // 40 cents
  const voteCostETH = (BigInt(voteCostUSD) * ethers.parseEther("1")) / (MAINNET_CONFIG.ethPrice / BigInt(1e6));
  const voteCostGUGO = (BigInt(voteCostUSD) * ethers.parseEther("1")) / (MAINNET_CONFIG.gugoPrice / BigInt(1e6));

  console.log("💵 Mainnet Economics (10 votes = $0.40):");
  console.log("  - ETH Cost:", ethers.formatEther(voteCostETH), "ETH");
  console.log("  - GUGO Cost:", ethers.formatEther(voteCostGUGO), "GUGO");

  // Deploy identical smart contract with mainnet config
  console.log("\n📦 Deploying GugoVoteManager to mainnet...");
  const GugoVoteManager = await ethers.getContractFactory("GugoVoteManager");
  
  const voteManager = await GugoVoteManager.deploy(
    MAINNET_CONFIG.gugoTokenAddress,    // Real GUGO token
    deployer.address,                   // Price oracle
    MAINNET_CONFIG.ethPrice,           // ETH price
    MAINNET_CONFIG.gugoPrice           // GUGO price
  );

  await voteManager.waitForDeployment();
  const contractAddress = await voteManager.getAddress();

  console.log("✅ GugoVoteManager deployed to:", contractAddress);

  // Save mainnet deployment info
  const deploymentInfo = {
    network: "abstractMainnet",
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      GugoVoteManager: contractAddress,
      GugoToken: MAINNET_CONFIG.gugoTokenAddress,
    },
    economics: {
      votePriceCents: MAINNET_CONFIG.votePriceCents,
      minimumVotes: MAINNET_CONFIG.minimumVotes,
      ethCost: ethers.formatEther(voteCostETH),
      gugoCost: ethers.formatEther(voteCostGUGO),
    },
    frontendConfig: {
      NEXT_PUBLIC_CHAIN: "mainnet",
      NEXT_PUBLIC_GUGO_CONTRACT: MAINNET_CONFIG.gugoTokenAddress,
      NEXT_PUBLIC_VOTE_MANAGER_CONTRACT: contractAddress,
    }
  };

  // Save deployment
  const fs = require("fs");
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }
  
  const deploymentPath = `./deployments/mainnet-${Date.now()}.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 MAINNET DEPLOYMENT COMPLETE!");
  console.log("💾 Deployment info saved to:", deploymentPath);

  console.log("\n📋 MIGRATION CHECKLIST:");
  console.log("□ Update frontend .env.local:");
  console.log(`  NEXT_PUBLIC_CHAIN=mainnet`);
  console.log(`  NEXT_PUBLIC_GUGO_CONTRACT=${MAINNET_CONFIG.gugoTokenAddress}`);
  console.log(`  NEXT_PUBLIC_VOTE_MANAGER_CONTRACT=${contractAddress}`);
  
  console.log("□ Update price oracle with real market data");
  console.log("□ Register initial NFT collections for voting");
  console.log("□ Test with small amount of real GUGO/ETH");
  console.log("□ Launch!");

  console.log("\n💡 Migration Benefits:");
  console.log("✅ Identical smart contract code (battle-tested on testnet)");
  console.log("✅ Same frontend UI (seamless user experience)");  
  console.log("✅ Same game mechanics (familiar gameplay)");
  console.log("✅ Real economic incentives (valuable GUGO tokens)");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Mainnet deployment failed:");
    console.error(error);
    process.exit(1);
  }); 