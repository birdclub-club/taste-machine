import { ethers } from "hardhat";
import { config } from "../config/networks";

async function main() {
  console.log("💰 Seeding Taste Machine Treasury...\n");

  const [deployer] = await ethers.getSigners();
  console.log("🔑 Using account:", deployer.address);

  // Contract address
  const contractAddress = process.env.VOTE_MANAGER_ADDRESS || config.voteManagerAddress;
  if (!contractAddress) {
    throw new Error("Please set VOTE_MANAGER_ADDRESS environment variable");
  }

  console.log("📍 Contract address:", contractAddress);

  // Get contract instance
  const voteManager = await ethers.getContractAt("GugoVoteManager_updated", contractAddress);

  // Check current treasury status
  console.log("\n📊 Current Treasury Status:");
  try {
    const treasuryInfo = await voteManager.getTreasuryInfo();
    console.log("🎁 Prize Break Treasury:", ethers.formatEther(treasuryInfo.prizeBreakBalance), "GUGO");
    console.log("🎰 Weekly Raffle Treasury:", ethers.formatEther(treasuryInfo.weeklyRaffleBalance), "GUGO");
    console.log("📜 Legacy Treasury:", ethers.formatEther(treasuryInfo.legacyBalance), "GUGO");
    console.log("🎯 Unlocked Tiers:", treasuryInfo.unlockedTiers.toString());
    console.log("🪙 GUGO Token:", treasuryInfo.gugoTokenAddress);
  } catch (error) {
    console.log("⚠️ Could not read treasury info:", error);
    return;
  }

  // Seeding options
  const SEED_AMOUNT = process.env.SEED_AMOUNT || "10000"; // Default 10,000 GUGO
  const SEED_METHOD = process.env.SEED_METHOD || "direct"; // "direct" or "revenue"

  console.log(`\n💰 Seeding Method: ${SEED_METHOD}`);
  console.log(`💰 Seed Amount: ${SEED_AMOUNT} GUGO\n`);

  // Get GUGO token contract for approval
  const gugoTokenAddress = await voteManager.gugoToken();
  if (gugoTokenAddress === ethers.ZeroAddress) {
    console.log("❌ GUGO token not set in contract");
    return;
  }

  const gugoToken = await ethers.getContractAt("IERC20", gugoTokenAddress);
  
  // Check deployer's GUGO balance
  const deployerBalance = await gugoToken.balanceOf(deployer.address);
  const seedAmountWei = ethers.parseEther(SEED_AMOUNT);
  
  console.log("💳 Your GUGO Balance:", ethers.formatEther(deployerBalance), "GUGO");
  
  if (deployerBalance < seedAmountWei) {
    console.log("❌ Insufficient GUGO tokens to seed treasury");
    console.log(`💡 You need ${SEED_AMOUNT} GUGO but have ${ethers.formatEther(deployerBalance)} GUGO`);
    return;
  }

  // Check and handle approval
  const currentAllowance = await gugoToken.allowance(deployer.address, contractAddress);
  
  if (currentAllowance < seedAmountWei) {
    console.log("🔓 Approving GUGO tokens for treasury seeding...");
    const approveTx = await gugoToken.approve(contractAddress, seedAmountWei);
    await approveTx.wait();
    console.log("✅ GUGO tokens approved");
  } else {
    console.log("✅ GUGO tokens already approved");
  }

  // Seed the treasury
  try {
    if (SEED_METHOD === "direct") {
      console.log("🎁 Seeding Prize Break Treasury directly...");
      const tx = await voteManager.depositToPrizeBreakTreasury(seedAmountWei);
      console.log("⏳ Transaction sent:", tx.hash);
      await tx.wait();
      console.log("✅ Prize Break Treasury seeded successfully!");
      
    } else if (SEED_METHOD === "revenue") {
      console.log("💰 Using revenue distribution method...");
      const tx = await voteManager.distributeRevenue(seedAmountWei);
      console.log("⏳ Transaction sent:", tx.hash);
      await tx.wait();
      console.log("✅ Revenue distributed successfully!");
      console.log("📊 Distribution breakdown:");
      console.log("  🔥 Burned:", ethers.formatEther(seedAmountWei * BigInt(3333) / BigInt(10000)), "GUGO");
      console.log("  🎁 Prize Break:", ethers.formatEther(seedAmountWei * BigInt(2333) / BigInt(10000)), "GUGO");
      console.log("  🎰 Weekly Raffle:", ethers.formatEther(seedAmountWei * BigInt(1000) / BigInt(10000)), "GUGO");
      console.log("  🛠 Operations:", ethers.formatEther(seedAmountWei * BigInt(3334) / BigInt(10000)), "GUGO");
      
    } else if (SEED_METHOD === "raffle") {
      console.log("🎰 Seeding Weekly Raffle Treasury...");
      const tx = await voteManager.depositToWeeklyRaffleTreasury(seedAmountWei);
      console.log("⏳ Transaction sent:", tx.hash);
      await tx.wait();
      console.log("✅ Weekly Raffle Treasury seeded successfully!");
      
    } else {
      console.log("❌ Invalid seed method. Use 'direct', 'revenue', or 'raffle'");
      return;
    }

  } catch (error) {
    console.log("❌ Treasury seeding failed:", error);
    return;
  }

  // Final status check
  console.log("\n📊 Updated Treasury Status:");
  try {
    const treasuryInfo = await voteManager.getTreasuryInfo();
    console.log("🎁 Prize Break Treasury:", ethers.formatEther(treasuryInfo.prizeBreakBalance), "GUGO");
    console.log("🎰 Weekly Raffle Treasury:", ethers.formatEther(treasuryInfo.weeklyRaffleBalance), "GUGO");
    console.log("🎯 Unlocked GUGO Tiers:", treasuryInfo.unlockedTiers.toString());
    
    // Show tier unlock status
    const prizeBreakBalance = treasuryInfo.prizeBreakBalance;
    console.log("\n🎯 Tier Unlock Status:");
    
    if (prizeBreakBalance >= ethers.parseEther("100000")) {
      console.log("💎 Ultra Rewards (Tier 9) - UNLOCKED!");
    } else if (prizeBreakBalance >= ethers.parseEther("50000")) {
      console.log("🌟 Mega Rewards (Tier 8) - UNLOCKED!");
    } else if (prizeBreakBalance >= ethers.parseEther("25000")) {
      console.log("⭐ Super Rewards (Tier 7) - UNLOCKED!");
    } else if (prizeBreakBalance >= ethers.parseEther("10000")) {
      console.log("🚀 High Rewards (Tier 6) - UNLOCKED!");
    } else if (prizeBreakBalance >= ethers.parseEther("5000")) {
      console.log("🎯 Mid Rewards (Tier 5) - UNLOCKED!");
    } else if (prizeBreakBalance >= ethers.parseEther("2500")) {
      console.log("💰 Enhanced Rewards (Tier 4) - UNLOCKED!");
    } else if (prizeBreakBalance >= ethers.parseEther("1000")) {
      console.log("🎁 Good Rewards (Tier 3) - UNLOCKED!");
    } else {
      console.log("🎁 Basic Rewards (Tier 1-2) - Available");
    }
    
  } catch (error) {
    console.log("⚠️ Could not read final treasury status");
  }

  console.log("\n🎮 Treasury seeding complete! Your prize break rewards are ready!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });