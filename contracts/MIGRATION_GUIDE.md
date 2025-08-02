# 🚀 Testnet → Mainnet Migration Guide

This guide shows how to seamlessly migrate from **FGUGO testnet** to **GUGO mainnet** with minimal changes.

## 📋 Migration Overview

**What Changes**: Only configuration and contract addresses  
**What Stays Same**: All smart contract code, frontend code, and game mechanics  
**Time Required**: ~30 minutes  
**Downtime**: Minimal (just contract deployment)

---

## 🎯 Step-by-Step Migration

### **1. Pre-Migration Checklist**

✅ **Testnet fully tested** with FGUGO and testnet ETH  
✅ **Smart contracts audited** (recommended for mainnet)  
✅ **Real GUGO token deployed** on Abstract Mainnet  
✅ **Mainnet wallet funded** with Abstract ETH for deployment  
✅ **Frontend tested** end-to-end on testnet  

### **2. Update Configuration**

```bash
# contracts/.env
NETWORK=mainnet
MAINNET_GUGO_TOKEN_ADDRESS=0xREAL_GUGO_MAINNET_ADDRESS
PRIVATE_KEY=your_mainnet_deployer_key
```

### **3. Deploy to Mainnet**

```bash
cd contracts
npm run deploy:mainnet
```

This automatically:
- ✅ Uses real GUGO token address
- ✅ Sets mainnet pricing ($0.50 GUGO vs $0.01 FGUGO)
- ✅ Configures proper chain ID (26026)
- ✅ Saves deployment info for frontend

### **4. Update Frontend**

```bash
# gugo-game-app/.env.local
NEXT_PUBLIC_CHAIN=mainnet
NEXT_PUBLIC_GUGO_CONTRACT=0xREAL_GUGO_MAINNET_ADDRESS
NEXT_PUBLIC_VOTE_MANAGER_CONTRACT=0xNEW_MAINNET_VOTE_CONTRACT
```

### **5. Test & Launch**

```bash
# Test with small amounts first
# Then full launch!
```

---

## 💰 Economic Comparison

| Aspect | Testnet (FGUGO) | Mainnet (GUGO) |
|--------|-----------------|----------------|
| **Token Price** | $0.01 FGUGO | $0.50 GUGO |
| **10 Votes Cost** | 40 FGUGO | 0.8 GUGO |
| **USD Value** | $0.40 | $0.40 |
| **Economics** | Same USD cost, different token amounts |

---

## 🔧 Technical Details

### **Smart Contract Differences**

```solidity
// IDENTICAL contract code, different constructor params:

// Testnet Deploy
GugoVoteManager(
  "0x3eAd...C24E56",  // FGUGO address
  deployer,           // Price oracle
  320000000000,       // $3200 ETH * 1e8
  1000000            // $0.01 FGUGO * 1e8
)

// Mainnet Deploy  
GugoVoteManager(
  "0xREAL...ADDRESS", // Real GUGO address
  deployer,           // Price oracle
  320000000000,       // $3200 ETH * 1e8  
  50000000           // $0.50 GUGO * 1e8
)
```

### **Frontend Differences**

```typescript
// IDENTICAL code, different environment variables:

// Testnet
const tokenAddress = "0x3eAd...C24E56"; // FGUGO
const chainName = "testnet";

// Mainnet
const tokenAddress = "0xREAL...ADDRESS"; // Real GUGO  
const chainName = "mainnet";
```

---

## 🛡️ Risk Mitigation

### **Pre-Migration Testing**

1. **Full E2E Test on Testnet**:
   - ✅ User registration
   - ✅ FGUGO token purchases  
   - ✅ Testnet ETH purchases
   - ✅ Voting mechanics
   - ✅ XP and Elo updates
   - ✅ Daily free votes

2. **Smart Contract Audit** (Recommended):
   - Security review of GugoVoteManager.sol
   - Gas optimization analysis
   - Economic model validation

3. **Staged Mainnet Deployment**:
   - Deploy with limited initial NFT collection
   - Test with small GUGO amounts
   - Monitor for 24-48 hours
   - Full launch with all collections

### **Migration Safety**

- **No user data migration** (wallet-based authentication)
- **No token migration** (users buy GUGO directly)
- **Independent deployments** (testnet keeps running)
- **Rollback possible** (can redeploy if needed)

---

## 📊 Migration Timeline

| Day | Activity | Duration |
|-----|----------|----------|
| **Day -7** | Final testnet testing | 2-3 days |
| **Day -3** | Smart contract audit | 2-3 days |
| **Day -1** | Preparation & staging | 4 hours |
| **Day 0** | Mainnet deployment | 1 hour |
| **Day 0** | Frontend update | 30 minutes |
| **Day 0** | Initial testing | 2 hours |
| **Day 1** | Monitoring & fixes | Ongoing |

---

## 🎮 User Experience

### **For Users (Seamless)**

✅ **Same Interface**: Identical UI/UX  
✅ **Same Gameplay**: Voting mechanics unchanged  
✅ **Same Wallets**: RainbowKit + Abstract Global Wallet  
✅ **Same Features**: XP, Elo ratings, daily votes  

### **What Users Notice**

- **Token Name**: "FGUGO" → "GUGO"  
- **Token Value**: Higher value per token
- **Real Economics**: Actual valuable tokens
- **Network**: "Abstract Testnet" → "Abstract Mainnet"

---

## 🔄 Automated Migration Tools

### **Configuration Switching**

```bash
# Switch to mainnet config
export NETWORK=mainnet
npm run config:show  # Verify settings

# Deploy with one command
npm run deploy:mainnet
```

### **Environment Generation**

```bash
# Auto-generate frontend config
npm run deploy:mainnet | grep "NEXT_PUBLIC" > ../gugo-game-app/.env.mainnet
```

---

## 🆘 Troubleshooting

### **Common Issues**

**"GUGO token address not set"**
```bash
# Fix: Set real GUGO address in .env
MAINNET_GUGO_TOKEN_ADDRESS=0xREAL_GUGO_ADDRESS
```

**"Network mismatch"**
```bash
# Fix: Verify Hardhat network matches
npx hardhat run scripts/deploy.ts --network abstractMainnet
```

**"Insufficient ETH for deployment"**
```bash
# Fix: Fund deployer wallet with Abstract ETH
# Use Abstract bridge or faucet
```

### **Emergency Rollback**

If issues occur:
1. Keep testnet running (users can continue playing)
2. Fix mainnet issues
3. Redeploy when ready
4. No user data lost (wallet-based)

---

## ✅ Migration Success Checklist

- [ ] Contracts deployed successfully
- [ ] Frontend updated and deployed  
- [ ] Test transactions work
- [ ] Real GUGO purchases work
- [ ] Voting mechanics function
- [ ] XP and Elo updates work
- [ ] Price oracle updates work
- [ ] Admin functions accessible
- [ ] Monitoring dashboard active
- [ ] Documentation updated

---

## 🎉 Post-Migration

### **Launch Activities**

1. **Announce Migration** to community
2. **Register Popular NFT Collections** for voting
3. **Create Initial Matches** to bootstrap activity  
4. **Monitor Economics** and adjust if needed
5. **Scale Up** based on usage patterns

### **Ongoing Maintenance**

- **Price Oracle Updates**: Keep ETH/GUGO prices current
- **New Collections**: Add popular NFTs regularly  
- **Game Balance**: Monitor XP and Elo systems
- **Security**: Regular contract monitoring

---

**The migration is designed to be simple, safe, and seamless! 🚀** 