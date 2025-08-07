import { ethers } from "hardhat";

// 🎯 SUPER SIMPLE TREASURY SEEDING
// Just run: npx hardhat run scripts/simple-seed.ts --network abstractTestnet

async function main() {
  console.log("💰 Simple Treasury Seeding...\n");

  // Contract addresses (Abstract Testnet)
  const TASTE_MACHINE_CONTRACT = "0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13";
  const FGUGO_TOKEN = "0x3eAd960365697E1809683617af9390ABC9C24E56";
  
  // How much FGUGO to seed (change this amount)
  const SEED_AMOUNT = "100000"; // 100,000 FGUGO
  
  console.log("🎯 Seeding", SEED_AMOUNT, "FGUGO to Taste Machine treasury");
  console.log("📍 Contract:", TASTE_MACHINE_CONTRACT);
  console.log("🪙 FGUGO Token:", FGUGO_TOKEN);

  const [signer] = await ethers.getSigners();
  console.log("🔑 Using wallet:", signer.address);

  // Connect to contracts
  const fgugoToken = await ethers.getContractAt("IERC20", FGUGO_TOKEN);
  const tasteMachine = await ethers.getContractAt("contracts/GugoVoteManager_updated.sol:GugoVoteManager", TASTE_MACHINE_CONTRACT);
  
  const amount = ethers.parseEther(SEED_AMOUNT);
  
  // Check your FGUGO balance
  const balance = await fgugoToken.balanceOf(signer.address);
  console.log("💳 Your FGUGO balance:", ethers.formatEther(balance));
  
  if (balance < amount) {
    console.log("❌ Not enough FGUGO! You need", SEED_AMOUNT, "but have", ethers.formatEther(balance));
    return;
  }

  // Step 1: Approve
  console.log("\n🔓 Step 1: Approving Taste Machine to spend your FGUGO...");
  const approveTx = await fgugoToken.approve(TASTE_MACHINE_CONTRACT, amount);
  console.log("⏳ Approval transaction:", approveTx.hash);
  await approveTx.wait();
  console.log("✅ Approved!");

  // Step 2: Deposit
  console.log("\n🎁 Step 2: Depositing to Prize Break Treasury...");
  const depositTx = await tasteMachine.depositToPrizeBreakTreasury(amount);
  console.log("⏳ Deposit transaction:", depositTx.hash);
  await depositTx.wait();
  console.log("✅ Deposited!");

  // Check treasury status
  console.log("\n📊 Treasury Status:");
  const treasuryInfo = await tasteMachine.getTreasuryInfo();
  console.log("🎁 Prize Break Treasury:", ethers.formatEther(treasuryInfo.prizeBreakBalance), "FGUGO");
  console.log("🎯 Unlocked Tiers:", treasuryInfo.unlockedTiers.toString());

  console.log("\n🎮 Done! Your treasury is seeded and ready for prize breaks!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });