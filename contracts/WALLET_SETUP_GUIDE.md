# 🏦 4-Wallet Revenue System Setup Guide

This guide shows you how to set up the complete wallet infrastructure for your GugoVoteManager's revenue distribution system.

## 🎯 Overview: The 4-Wallet System

Your contract automatically distributes revenue across 4 destinations:

| **Wallet** | **% Share** | **Purpose** | **Setup Required** |
|------------|-------------|-------------|-------------------|
| 🔥 **Burn Wallet** | 33.33% | Token destruction | ✅ **Built-in** (0x000...dEaD) |
| 🎁 **Prize Break Treasury** | 23.33% | Daily dopamine rewards | ✅ **Built-in** (contract storage) |
| 🎰 **Weekly Raffle Treasury** | 10.00% | Big weekly prizes | ✅ **Built-in** (contract storage) |
| 🛠 **Operations Wallet** | 33.33% | Your business expenses | ⚠️ **YOU MUST SET** |

## 📋 Step-by-Step Setup

### Step 1: Create Your Operations Wallet

You need a dedicated wallet for business operations. You have 2 options:

#### Option A: Create New Dedicated Wallet (Recommended)
```bash
# Generate a new wallet address for operations
# Use MetaMask, hardware wallet, or CLI tools
```

#### Option B: Use Existing Business Wallet
```bash
# Use your existing business/team multisig wallet
```

**Important**: This wallet will receive 33.33% of ALL revenue, so make sure it's:
- ✅ **Secure** (hardware wallet or multisig preferred)
- ✅ **Accessible** (team can access for business expenses)
- ✅ **Documented** (save private keys/recovery phrases safely)

### Step 2: Deploy the Contract

```bash
cd contracts/
npm run deploy:testnet  # For testing
# OR
npm run deploy:mainnet  # For production
```

### Step 3: Configure Operations Wallet

After deployment, set your operations wallet:

```typescript
// Using ethers.js
const voteManager = new ethers.Contract(contractAddress, abi, signer);

// Set your operations wallet (CRITICAL STEP)
await voteManager.setOperationsWallet("0xYourOperationsWalletAddress");
```

### Step 4: Set GUGO Token Address

```typescript
// Connect the GUGO token contract
await voteManager.setGugoToken("0xGugoTokenContractAddress");
```

### Step 5: Test Revenue Distribution

```typescript
// Test with a small amount first (e.g., 1000 GUGO tokens)
const testAmount = ethers.parseEther("1000"); // 1000 GUGO
await voteManager.distributeRevenue(testAmount);
```

## 🔄 Revenue Flow Example

When you call `distributeRevenue(10000)` (10,000 GUGO tokens):

```
📊 INCOMING: 10,000 GUGO tokens
├─ 🔥 BURN: 3,333 GUGO → Sent to 0x000...dEaD (burned forever)
├─ 🎁 PRIZE BREAK: 2,333 GUGO → Stored in contract for daily rewards
├─ 🎰 WEEKLY RAFFLE: 1,000 GUGO → Stored in contract for big prizes  
└─ 🛠 OPERATIONS: 3,334 GUGO → Sent to YOUR operations wallet
```

Your operations wallet receives the GUGO tokens that you can then allocate to:
- Dev team salaries (30%)
- Marketing campaigns (25%) 
- Seasonal events (30%)
- Emergency reserves (15%)

## 🛠 Operations Wallet Management

### Recommended Sub-Allocation:
Your operations wallet (33.33% of revenue) can be further divided:

```typescript
// Example internal allocation from your operations wallet:
const operationsRevenue = 3334; // GUGO tokens received

const devBudget = operationsRevenue * 0.30;      // 1000 GUGO - Dev team
const marketingBudget = operationsRevenue * 0.25; // 833 GUGO - Marketing
const seasonalBudget = operationsRevenue * 0.30;  // 1000 GUGO - Events
const emergencyBudget = operationsRevenue * 0.15; // 500 GUGO - Emergency
```

### Multi-Wallet Strategy (Advanced):
For larger operations, you can create sub-wallets:

```
🛠 Operations Wallet (receives from contract)
├─ 👨‍💻 Dev Wallet (for team payments)
├─ 📢 Marketing Wallet (for campaigns)
├─ 🎉 Events Wallet (for seasonal content)
└─ 🚨 Emergency Wallet (for crises)
```

## 📊 Monitoring & Analytics

### View Treasury Status:
```typescript
const treasuryInfo = await voteManager.getTreasuryInfo();
console.log("Prize Break Balance:", treasuryInfo.prizeBreakBalance);
console.log("Weekly Raffle Balance:", treasuryInfo.weeklyRaffleBalance);
console.log("Operations Wallet:", treasuryInfo.operationsWalletAddress);
```

### Monitor Revenue Distribution:
```typescript
// Listen for revenue distribution events
voteManager.on("RevenueDistributed", (total, burn, prizeBreak, raffle, operations) => {
  console.log(`💰 Distributed ${total} GUGO tokens:`);
  console.log(`🔥 Burned: ${burn}`);
  console.log(`🎁 Prize Break: ${prizeBreak}`);
  console.log(`🎰 Weekly Raffle: ${raffle}`);
  console.log(`🛠 Operations: ${operations}`);
});
```

## 🚨 Security Checklist

Before going live, verify:

- [ ] **Operations wallet is set** (`getTreasuryInfo()` shows correct address)
- [ ] **GUGO token is connected** (address is not 0x000...000)
- [ ] **Test distribution works** (small amount flows correctly)
- [ ] **Operations wallet can receive GUGO** (test transfer)
- [ ] **Backup all wallet keys** (operations wallet access)
- [ ] **Document all addresses** (for team reference)

## 🎮 Game Launch Checklist

1. **Deploy contract** ✅
2. **Set operations wallet** ✅  
3. **Connect GUGO token** ✅
4. **Test revenue flow** ✅
5. **Fund initial prize treasuries** (optional bootstrap)
6. **Launch game** and start generating revenue! 🚀

## 💡 Pro Tips

### Bootstrap Strategy:
Consider funding initial treasuries to start the game economy:

```typescript
// Optional: Bootstrap prize treasuries before launch
await voteManager.depositToPrizeBreakTreasury(ethers.parseEther("5000"));
await voteManager.depositToWeeklyRaffleTreasury(ethers.parseEther("2000"));
```

### Revenue Timing:
- **Daily**: Call `distributeRevenue()` with accumulated game fees
- **Weekly**: Big raffle payouts from weekly raffle treasury  
- **Monthly**: Review operations wallet allocation and team payments

### Emergency Procedures:
- **Transfer between treasuries** if one runs low: `transferBetweenTreasuries()`
- **Direct deposits** for urgent funding: `depositToPrizeBreakTreasury()`
- **Operations wallet change** if needed: `setOperationsWallet()`

---

🎉 **You're ready to launch a sustainable, revenue-generating NFT game!**