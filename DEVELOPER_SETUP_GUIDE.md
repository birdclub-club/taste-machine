# 🔧 Taste Machine - Developer Setup Guide

Complete setup instructions for new developers joining the Taste Machine project.

## 🚀 **LIVE STATUS**: https://taste-machine.vercel.app

**Production Branch**: `development-backup-enhanced-systems`  
This branch contains all production-ready code with TypeScript fixes, welcome popup, and auto-deployment to Vercel.

---

## 📋 Prerequisites

### **Required Software**
- **Node.js**: Version 18+ (recommend using nvm)
- **Git**: Latest version
- **Code Editor**: VS Code recommended
- **Browser**: Chrome/Firefox with MetaMask extension

### **Required Accounts**
- **Supabase Account**: Free tier sufficient
- **Abstract Chain Testnet**: ETH for testing
- **GitHub**: For repository access

---

## 🚀 Initial Setup

### **1. Repository Setup**
```bash
# Clone the repository
git clone https://github.com/birdclub-club/taste-machine.git
cd taste-machine

# Switch to the production-ready branch
cd gugo-game-app
git checkout development-backup-enhanced-systems

# Install Node.js dependencies
npm install

cd ../contracts
npm install
```

### **2. Supabase Database Setup**

#### **Create Supabase Project**
1. Go to https://supabase.com/
2. Create new project
3. Wait for database initialization
4. Note your project URL and anon key

#### **Run Database Schema**
1. Open Supabase SQL Editor
2. Run `gugo-game-app/supabase-setup.sql`
3. Run `gugo-game-app/supabase-nft-schema.sql`
4. Verify tables are created

### **3. Environment Configuration**

#### **Frontend Environment (`gugo-game-app/.env.local`)**
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Chain Configuration
NEXT_PUBLIC_CHAIN=testnet
NEXT_PUBLIC_VOTE_MANAGER_CONTRACT=0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13

# Wallet Connect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
```

#### **Contracts Environment (`contracts/.env`)**
```env
# Deployment Configuration
PRIVATE_KEY=0x00ea84e39c22de62d5520adf40b568ee2f24606f1150d663f1ad5556cc6bd6d3
VOTE_MANAGER_ADDRESS=0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13
GUGO_TOKEN_ADDRESS=0x3eAd960365697E1809683617af9390ABC9C24E56
OPERATIONS_WALLET=0x544f075E54aa90fDB21c19C02e45bD8Faded6A87

# Network Configuration
ABSTRACT_API_KEY=optional-for-verification
```

### **4. MetaMask Network Setup**

Add Abstract Testnet to MetaMask:
```
Network Name: Abstract Sepolia Testnet
RPC URL: https://api.testnet.abs.xyz
Chain ID: 11124
Currency Symbol: ETH
Block Explorer: https://explorer.testnet.abs.xyz
```

---

## 🎮 Development Workflow

### **Starting Development Server**
```bash
# Terminal 1: Frontend
cd gugo-game-app
npm run dev
# Runs on http://localhost:3000

# Terminal 2: Contract compilation (if needed)
cd contracts
npm run compile
```

### **Database Population**

#### **Import NFT Collections**
```bash
cd gugo-game-app

# Import specific collections
node scripts/import-nfts.js 0xa6c46c07f7f1966d772e29049175ebba26262513  # BEARISH
node scripts/import-nfts.js 0x5fedb9a131f798e986109dd89942c17c25c81de3  # Final Bosu
node scripts/import-nfts.js 0x99b9007f3c8732b9bff2ed68ab7f73f27c4a0c53  # Fugz

# Check import status
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function check() {
  const { count } = await supabase.from('nfts').select('*', { count: 'exact', head: true });
  console.log('📊 Total NFTs:', count);
  // Current working database has: 46,615 NFTs
}
check();
"
```

#### **Background Import (Multiple Collections)**
```bash
# Import all collections in background
nohup node scripts/import-nfts.js 0xa6c46c07f7f1966d772e29049175ebba26262513 > bearish.log 2>&1 &
nohup node scripts/import-nfts.js 0x5fedb9a131f798e986109dd89942c17c25c81de3 > bosu.log 2>&1 &
nohup node scripts/import-nfts.js 0x99b9007f3c8732b9bff2ed68ab7f73f27c4a0c53 > fugz.log 2>&1 &

# Monitor progress
tail -f bearish.log
```

---

## 🧪 Testing

### **Frontend Testing**
```bash
cd gugo-game-app

# Start development server
npm run dev

# Test checklist:
# 1. Load http://localhost:3000
# 2. Connect wallet (MetaMask)
# 3. Verify NFT matchups load
# 4. Test voting functionality
# 5. Check responsive design
```

### **Smart Contract Testing**
```bash
cd contracts

# Compile contracts
npm run compile

# Run test suite
npm test

# Deploy to local network
npm run node  # Terminal 1
npm run deploy:local  # Terminal 2

# Deploy to testnet
npm run deploy:testnet
```

### **Database Testing**
```bash
# Check database connection
cd gugo-game-app
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('nfts').select('count').then(({data, error}) => console.log('DB Test:', error ? 'FAIL' : 'SUCCESS'));
"

# Generate test matchups
node scripts/setup-database.js
```

---

## 🐛 Troubleshooting

### **Common Frontend Issues**

#### **"Module not found" Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next
npm run dev
```

#### **Wallet Connection Issues**
```bash
# Verify MetaMask network settings
# Chain ID must be 11124
# Check environment variables in .env.local
```

#### **Supabase Connection Errors (UPDATED - August 2025)**
```bash
# ✅ COMMON ISSUE RESOLVED: Expired API keys
# If you see "Invalid API key" errors, get fresh keys:

# 1. Go to your Supabase dashboard
# 2. Navigate to Settings → API
# 3. Copy the fresh 'anon public' key
# 4. Update .env.local:
echo 'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_fresh_key_here' >> .env.local

# 5. Restart the server:
pkill -f "next.*dev"
npm run dev

# 6. Test connection:
curl -s "http://localhost:3000/api/check-nft-count"
# Should return: {"success":true,"nftCount":46615}
```

### **Common Contract Issues**

#### **"Artifact not found" Errors**
```bash
# Use fully qualified names in scripts
ethers.getContractFactory("contracts/GugoVoteManager_updated.sol:GugoVoteManager")

# Recompile contracts
npm run clean
npm run compile
```

#### **Deployment Failures**
```bash
# Check testnet ETH balance
# Verify PRIVATE_KEY in .env
# Check network configuration

# Get testnet ETH
# Visit: https://portal.abstract.xyz/faucet
```

#### **Gas Estimation Failures**
```bash
# Check contract parameters
# Verify wallet has sufficient ETH
# Check network connectivity
```

### **Database Issues**

#### **Import Failures**
```bash
# Check logs
tail -f collection_import.log

# Retry import
node scripts/import-nfts.js CONTRACT_ADDRESS

# Clear failed imports
# Delete from Supabase dashboard if needed
```

#### **Slow Queries**
```bash
# Check database indexes
# Optimize query patterns
# Consider pagination for large datasets
```

---

## 📊 Monitoring & Debugging

### **Frontend Debugging**
```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check browser console
# Inspect network requests
# Monitor React DevTools
```

### **Contract Debugging**
```bash
# Hardhat console
npx hardhat console --network abstractTestnet

# Contract verification
npm run verify -- DEPLOYED_ADDRESS

# Event monitoring
# Check Abstract explorer: https://explorer.testnet.abs.xyz
```

### **Database Monitoring**
```bash
# Check table sizes
node -e "
// Database stats query
"

# Monitor active connections
# Use Supabase dashboard analytics
```

---

## 🔄 CI/CD & Deployment

### **Development Workflow**

#### **Option A: Direct Development (Recommended for quick iterations)**
```bash
# Work directly on production branch
git checkout development-backup-enhanced-systems

# Make changes and test locally
npm run dev

# Commit and auto-deploy
git add .
git commit -m "feat: add new feature"
git push origin development-backup-enhanced-systems
# → Automatically deploys to https://taste-machine.vercel.app
```

#### **Option B: Feature Branch Development (For major features)**
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and test
npm run dev

# 3. Merge to production when ready
git checkout development-backup-enhanced-systems
git merge feature/new-feature
git push origin development-backup-enhanced-systems
# → Automatically deploys to https://taste-machine.vercel.app
```

### **Deployment Checklist**

#### **Frontend Deployment**
- [ ] Environment variables configured
- [ ] Supabase project ready
- [ ] Build succeeds locally
- [ ] All tests pass
- [ ] Responsive design tested

#### **Contract Deployment**
- [ ] Tests pass
- [ ] Gas costs optimized
- [ ] Security review completed
- [ ] Testnet deployment successful
- [ ] Contract verified

---

## 📚 Code Structure

### **Frontend Architecture**
```
gugo-game-app/
├── src/
│   ├── app/                 # Next.js 14 app router
│   │   ├── page.tsx         # Main voting interface
│   │   ├── layout.tsx       # Root layout
│   │   └── providers.tsx    # Context providers
│   ├── components/          # React components
│   │   ├── WalletConnect.tsx
│   │   ├── VotingInterface.tsx
│   │   └── NFTCard.tsx
│   └── hooks/               # Custom React hooks
├── lib/                     # Configuration & utilities
│   ├── wagmi.ts            # Web3 configuration
│   ├── supabase.ts         # Database client
│   └── utils.ts            # Helper functions
└── scripts/                # Node.js utilities
    ├── import-nfts.js      # NFT import pipeline
    └── setup-database.js   # Database initialization
```

### **Contract Architecture**
```
contracts/
├── contracts/
│   ├── GugoVoteManager_updated.sol  # Main game contract
│   └── MockERC20.sol               # Test token
├── scripts/
│   ├── deploy.ts                   # Deployment script
│   └── setup-wallets.ts           # Configuration
├── test/
│   └── GugoVoteManager.test.ts     # Contract tests
└── typechain-types/               # Generated TypeScript types
```

---

## 🎯 Development Best Practices

### **Code Quality**
- Use TypeScript for type safety
- Follow consistent naming conventions
- Write comprehensive tests
- Document complex functions
- Use ESLint and Prettier

### **Security**
- Never commit private keys
- Use environment variables
- Validate all inputs
- Test contract edge cases
- Review before mainnet

### **Performance**
- Optimize database queries
- Cache frequently accessed data
- Use React.memo for expensive components
- Monitor gas costs
- Profile frontend performance

---

## 🚨 Troubleshooting

### **Development Server Issues**
If you encounter problems with `npm run dev` (site unreachable, server won't start, compilation issues), check our comprehensive **[Development Troubleshooting Guide](./DEVELOPMENT_TROUBLESHOOTING.md)**.

**Common Quick Fixes:**
```bash
# Ensure you're in the right directory
cd gugo-game-app

# Kill stuck processes
pkill -f "next.*dev"

# Restart server (simple approach)
npm run dev
```

**Key Lessons:**
- Always check your working directory with `pwd`
- Use simple commands rather than complex chaining
- Let the server fully compile (20-30 seconds)
- Avoid interrupting the server during compilation

---

## 📞 Getting Help

### **Documentation**
- Main overview: `PROJECT_OVERVIEW.md`
- Game mechanics: `game-logic-summary.md`
- UI components: `voting_ui_scaffold.md`

### **External Resources**
- **Abstract Chain**: https://docs.abstract.xyz/
- **Supabase**: https://supabase.com/docs
- **Next.js**: https://nextjs.org/docs
- **Hardhat**: https://hardhat.org/docs

### **Community**
- GitHub Issues for bug reports
- Team Slack for development discussion
- Code reviews for best practices

---

**Setup Complete! Ready to build on Taste Machine! 🚀**

*Need help? Check the troubleshooting section or reach out to the team.*