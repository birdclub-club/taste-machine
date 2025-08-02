import { ethers } from "hardhat";
import { getCurrentNetworkConfig } from "../config/networks";

/**
 * 🏦 4-Wallet Revenue System Setup Script
 * 
 * This script helps you configure the complete wallet infrastructure
 * for your GugoVoteManager's revenue distribution system.
 */

async function main() {
  console.log("🏦 Setting up 4-Wallet Revenue System...\n");

  // Get network configuration
  const config = getCurrentNetworkConfig();
  const [deployer] = await ethers.getSigners();
  
  console.log("📝 Current network:", config.name);
  console.log("👤 Deployer address:", deployer.address);
  
  // Get contract address (you'll need to update this after deployment)
  const VOTE_MANAGER_ADDRESS = process.env.VOTE_MANAGER_ADDRESS || "";
  
  if (!VOTE_MANAGER_ADDRESS) {
    console.error("❌ Please set VOTE_MANAGER_ADDRESS environment variable");
    console.log("💡 Example: export VOTE_MANAGER_ADDRESS=0x...");
    process.exit(1);
  }

  // Connect to deployed contract
  const GugoVoteManager = await ethers.getContractFactory("contracts/GugoVoteManager_updated.sol:GugoVoteManager");
  const voteManager = GugoVoteManager.attach(VOTE_MANAGER_ADDRESS);

  console.log("🔗 Connected to GugoVoteManager at:", VOTE_MANAGER_ADDRESS);

  // Check current treasury status
  console.log("\n📊 Current Treasury Status:");
  try {
    const treasuryInfo = await voteManager.getTreasuryInfo();
    console.log("🎁 Prize Break Treasury:", ethers.formatEther(treasuryInfo.prizeBreakBalance), "GUGO");
    console.log("🎰 Weekly Raffle Treasury:", ethers.formatEther(treasuryInfo.weeklyRaffleBalance), "GUGO");
    console.log("📜 Legacy Treasury:", ethers.formatEther(treasuryInfo.legacyBalance), "GUGO");
    console.log("🎯 Unlocked Tiers:", treasuryInfo.unlockedTiers.toString());
    console.log("🛠 Operations Wallet:", treasuryInfo.operationsWalletAddress);
    console.log("🪙 GUGO Token:", treasuryInfo.gugoTokenAddress);
  } catch (error) {
    console.log("⚠️ Could not read treasury info (contract might not be deployed)");
  }

  // Setup checklist
  console.log("\n🚀 Setup Steps:\n");

  // Step 1: Set Operations Wallet
  const OPERATIONS_WALLET = process.env.OPERATIONS_WALLET || "";
  
  if (!OPERATIONS_WALLET) {
    console.log("⏸️ Step 1: Set Operations Wallet");
    console.log("   Please set OPERATIONS_WALLET environment variable");
    console.log("   Example: export OPERATIONS_WALLET=0x...");
    console.log("   This wallet will receive 33.33% of all revenue");
  } else {
    console.log("🔧 Step 1: Setting Operations Wallet...");
    try {
      const tx = await voteManager.setOperationsWallet(OPERATIONS_WALLET);
      await tx.wait();
      console.log("✅ Operations wallet set to:", OPERATIONS_WALLET);
    } catch (error) {
      console.log("❌ Failed to set operations wallet:", error);
    }
  }

  // Step 2: Set GUGO Token
  const GUGO_TOKEN_ADDRESS = config.gugoTokenAddress || process.env.GUGO_TOKEN_ADDRESS || "";
  
  if (!GUGO_TOKEN_ADDRESS) {
    console.log("\n⏸️ Step 2: Set GUGO Token Address");
    console.log("   Please set GUGO_TOKEN_ADDRESS environment variable");
    console.log("   Or update your network config file");
  } else {
    console.log("\n🪙 Step 2: Setting GUGO Token...");
    try {
      const tx = await voteManager.setGugoToken(GUGO_TOKEN_ADDRESS);
      await tx.wait();
      console.log("✅ GUGO token set to:", GUGO_TOKEN_ADDRESS);
    } catch (error) {
      console.log("❌ Failed to set GUGO token:", error);
    }
  }

  // Step 3: Test Revenue Distribution (optional)
  const TEST_AMOUNT = process.env.TEST_AMOUNT || "";
  
  if (TEST_AMOUNT && OPERATIONS_WALLET && GUGO_TOKEN_ADDRESS) {
    console.log("\n🧪 Step 3: Testing Revenue Distribution...");
    try {
      const amount = ethers.parseEther(TEST_AMOUNT);
      console.log(`💰 Testing with ${TEST_AMOUNT} GUGO tokens...`);
      
      // Note: This requires the deployer to have GUGO tokens and approve the contract
      const tx = await voteManager.distributeRevenue(amount);
      await tx.wait();
      
      console.log("✅ Test distribution successful!");
      console.log("🔥 Burn amount:", ethers.formatEther(amount * BigInt(3333) / BigInt(10000)), "GUGO");
      console.log("🎁 Prize Break:", ethers.formatEther(amount * BigInt(2333) / BigInt(10000)), "GUGO");
      console.log("🎰 Weekly Raffle:", ethers.formatEther(amount * BigInt(1000) / BigInt(10000)), "GUGO");
      console.log("🛠 Operations:", ethers.formatEther(amount * BigInt(3334) / BigInt(10000)), "GUGO");
      
    } catch (error) {
      console.log("❌ Test distribution failed:", error);
      console.log("💡 Make sure deployer has GUGO tokens and has approved the contract");
    }
  }

  // Migration from legacy treasury (if needed)
  console.log("\n🔄 Migration Options:");
  try {
    const treasuryInfo = await voteManager.getTreasuryInfo();
    const legacyBalance = treasuryInfo.legacyBalance;
    
    if (legacyBalance > 0) {
      console.log(`📜 Legacy treasury has ${ethers.formatEther(legacyBalance)} GUGO tokens`);
      console.log("💡 Run migration with: MIGRATE_LEGACY=true");
      
      if (process.env.MIGRATE_LEGACY === "true") {
        console.log("🔄 Migrating legacy treasury...");
        const tx = await voteManager.migrateLegacyTreasury();
        await tx.wait();
        console.log("✅ Legacy treasury migrated successfully!");
      }
    } else {
      console.log("✅ No legacy treasury to migrate");
    }
  } catch (error) {
    console.log("⚠️ Could not check legacy treasury");
  }

  // Final status check
  console.log("\n📊 Final Setup Status:");
  try {
    const treasuryInfo = await voteManager.getTreasuryInfo();
    
    console.log("🎁 Prize Break Treasury:", ethers.formatEther(treasuryInfo.prizeBreakBalance), "GUGO");
    console.log("🎰 Weekly Raffle Treasury:", ethers.formatEther(treasuryInfo.weeklyRaffleBalance), "GUGO");
    console.log("🎯 Unlocked GUGO Tiers:", treasuryInfo.unlockedTiers.toString());
    
    const isSetupComplete = 
      treasuryInfo.operationsWalletAddress !== ethers.ZeroAddress &&
      treasuryInfo.gugoTokenAddress !== ethers.ZeroAddress;
      
    if (isSetupComplete) {
      console.log("\n🎉 Setup Complete! Your 4-wallet revenue system is ready!");
      console.log("\n🚀 Next Steps:");
      console.log("1. Start generating revenue through game fees");
      console.log("2. Call distributeRevenue() regularly to process payments");
      console.log("3. Monitor treasury balances and tier unlocks");
      console.log("4. Set up automated revenue distribution if desired");
    } else {
      console.log("\n⚠️ Setup Incomplete!");
      if (treasuryInfo.operationsWalletAddress === ethers.ZeroAddress) {
        console.log("❌ Operations wallet not set");
      }
      if (treasuryInfo.gugoTokenAddress === ethers.ZeroAddress) {
        console.log("❌ GUGO token not set");
      }
    }
    
  } catch (error) {
    console.log("❌ Could not verify final setup status");
  }

  console.log("\n💡 For detailed guidance, see: contracts/WALLET_SETUP_GUIDE.md");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });