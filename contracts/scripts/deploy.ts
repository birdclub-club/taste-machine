import { ethers } from "hardhat";
import { getCurrentNetworkConfig, logNetworkInfo, validateConfig, getVoteCosts } from "../config/networks";

async function main() {
  console.log("🚀 Deploying Gugo Game contracts...");

  // Get network configuration (auto-detects testnet vs mainnet)
  const config = getCurrentNetworkConfig();
  
  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.isValid) {
    console.error("❌ Configuration errors:");
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  // Log network info
  logNetworkInfo(config);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("\n📝 Deploying with account:", deployer.address);

  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Verify we're on the correct network
  const network = await deployer.provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) {
    throw new Error(`Network mismatch: Expected ${config.chainId}, got ${network.chainId}`);
  }

  // Deploy GugoVoteManager with 4-wallet revenue system  
  console.log("\n📦 Deploying GugoVoteManager with 4-wallet revenue system...");
  const GugoVoteManager = await ethers.getContractFactory("contracts/GugoVoteManager_updated.sol:GugoVoteManager");
  
  // New contract has no constructor parameters - uses Ownable(msg.sender)
  const voteManager = await GugoVoteManager.deploy();

  await voteManager.waitForDeployment();
  const voteManagerAddress = await voteManager.getAddress();

  console.log("✅ GugoVoteManager deployed to:", voteManagerAddress);

  // Verify deployment and show 4-wallet revenue system
  console.log("\n🔍 Verifying deployment...");
  const treasuryInfo = await voteManager.getTreasuryInfo();
  const globalStats = await voteManager.getGlobalStats();
  
  console.log("🏦 4-Wallet Revenue System Initialized:");
  console.log(`  - Prize Break Treasury: ${ethers.formatEther(treasuryInfo[0])} GUGO`);
  console.log(`  - Weekly Raffle Treasury: ${ethers.formatEther(treasuryInfo[1])} GUGO`);
  console.log(`  - Legacy Treasury: ${ethers.formatEther(treasuryInfo[2])} GUGO`);
  console.log(`  - Unlocked GUGO Tiers: ${treasuryInfo[3]}`);
  console.log(`  - Operations Wallet: ${treasuryInfo[6] === ethers.ZeroAddress ? "⚠️  NOT SET" : "✅ " + treasuryInfo[6]}`);
  console.log(`  - GUGO Token: ${treasuryInfo[5] === ethers.ZeroAddress ? "⚠️  NOT SET" : "✅ " + treasuryInfo[5]}`);
  
  console.log("\n📊 Global Game Stats:");
  console.log(`  - Total Votes Cast: ${globalStats[0]}`);
  console.log(`  - Prize Break Balance: ${ethers.formatEther(globalStats[1])} GUGO`);
  console.log(`  - Weekly Raffle Balance: ${ethers.formatEther(globalStats[2])} GUGO`);
  console.log(`  - Unlocked Tiers: ${globalStats[3]}`);
  
  console.log("\n🎮 Game Constants:");
  console.log(`  - Prize Break Threshold: Every 10 votes`);
  console.log(`  - Base XP per Vote: 10 XP`);
  console.log(`  - Super Vote XP: 100 XP`);

  // Save deployment info
  const deploymentInfo = {
    network: await deployer.provider.getNetwork(),
    deployer: deployer.address,
    contracts: {
      GugoVoteManager_updated: voteManagerAddress,
      GugoToken: config.gugoTokenAddress,
      BurnWallet: "0x000000000000000000000000000000000000dEaD",
      OperationsWallet: treasuryInfo[6] === ethers.ZeroAddress ? "NOT_SET" : treasuryInfo[6],
    },
    treasuries: {
      prizeBreakTreasury: ethers.formatEther(treasuryInfo[0]),
      weeklyRaffleTreasury: ethers.formatEther(treasuryInfo[1]),
      legacyTreasury: ethers.formatEther(treasuryInfo[2]),
      unlockedTiers: treasuryInfo[3].toString(),
    },
    revenueDistribution: {
      burnPercentage: "33.33%",
      prizeBreakPercentage: "23.33%", 
      weeklyRafflePercentage: "10.00%",
      operationsPercentage: "33.33%",
    },
    timestamp: new Date().toISOString(),
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require("fs");
  const deploymentPath = `./deployments/${deploymentInfo.network.name}-${Date.now()}.json`;
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentPath);

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Next Steps:");
  console.log("1. Update frontend environment variables:");
  console.log(`   NEXT_PUBLIC_VOTE_MANAGER_CONTRACT=${voteManagerAddress}`);
  console.log("2. Register some NFTs for voting");
  console.log("3. Create initial voting matches");
  console.log("4. Test the voting flow");

  return {
    voteManager: voteManagerAddress,
    gugoToken: config.gugoTokenAddress,
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  }); 