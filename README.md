# 🎮 Taste Machine

**An NFT Aesthetic Voting Game on Abstract Chain**

*Vote on the aesthetic appeal of NFTs, earn rewards, and participate in a gamified blockchain experience.*

---

## 🚀 Project Status: PRODUCTION READY

**Taste Machine is fully deployed and operational!**

- ✅ **Smart Contract**: Deployed on Abstract Testnet
- ✅ **NFT Database**: 39,608 NFTs across 7 collections  
- ✅ **Revenue System**: 4-wallet automated distribution
- ✅ **Frontend**: Professional voting interface
- ✅ **Documentation**: Complete developer handoff ready

---

## 🎯 What is Taste Machine?

Taste Machine is an innovative NFT aesthetic voting game where users:

- **Vote** on random NFT matchups based on aesthetic appeal
- **Earn XP** and participate in prize break rewards every 10 votes
- **Win GUGO tokens** through a weighted lottery system
- **Influence Elo ratings** that determine NFT aesthetic rankings
- **Participate** in a sustainable tokenomics system

### **Game Mechanics**
- **Random Matchups**: Two NFTs, one aesthetic choice
- **Vote Cost**: ETH or GUGO tokens (dynamic pricing)
- **Prize Breaks**: Rewards every 10 votes (XP, bonus votes, GUGO)
- **Elo System**: NFTs gain/lose rating based on votes
- **Treasury Management**: Automated revenue distribution

---

## 📊 Current System Status

### **Deployed Infrastructure**
```
🔗 Contract Address: 0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13
🌐 Network: Abstract Sepolia Testnet (Chain ID: 11124)
💰 Operations Wallet: 0x544f075E54aa90fDB21c19C02e45bD8Faded6A87
🎮 Total NFTs: 39,608 across 7 collections
```

### **Revenue Distribution (Automated)**
- **33.33%** → Operations wallet (business revenue)
- **33.33%** → Burn address (token deflation)
- **23.33%** → Prize break treasury (daily rewards)
- **10.00%** → Weekly raffle treasury (big prizes)

---

## 🏗️ Architecture

### **Tech Stack**
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Blockchain**: Solidity + Hardhat + OpenZeppelin
- **Database**: Supabase (PostgreSQL)
- **Web3**: RainbowKit + Wagmi v2
- **Chain**: Abstract Testnet/Mainnet

### **Repository Structure**
```
taste-machine/
├── gugo-game-app/           # Next.js frontend application
├── contracts/               # Smart contracts (Hardhat)
├── PROJECT_OVERVIEW.md      # Complete project documentation
├── DEVELOPER_SETUP_GUIDE.md # Setup instructions for new devs
├── DEPLOYMENT_SUMMARY.md    # Production deployment details
└── README.md               # This file
```

---

## 🚀 Quick Start

### **For Users**
1. Visit the deployed application
2. Connect your Abstract-compatible wallet
3. Get some testnet ETH from the Abstract faucet
4. Start voting on NFT aesthetic matchups!

### **For Developers**
```bash
# Clone repository
git clone [your-repo-url]
cd taste-machine

# Read comprehensive setup guide
open DEVELOPER_SETUP_GUIDE.md

# Quick setup
cd gugo-game-app
npm install
cp .env.local.example .env.local
# Configure Supabase credentials
npm run dev
```

---

## 📚 Documentation

### **📖 Complete Documentation**
- **[📋 PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)** - Complete project documentation
- **[🔧 DEVELOPER_SETUP_GUIDE.md](./DEVELOPER_SETUP_GUIDE.md)** - Developer onboarding
- **[🚀 DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Production deployment details
- **[🎮 game-logic-summary.md](./game-logic-summary.md)** - Game mechanics breakdown
- **[🎨 voting_ui_scaffold.md](./voting_ui_scaffold.md)** - UI component guide

### **📁 Module Documentation**
- **[Frontend README](./gugo-game-app/README.md)** - Frontend application details
- **[Contracts README](./contracts/README.md)** - Smart contract documentation

---

## 🎮 NFT Collections (39,608 Total)

| Collection | Count | Status |
|------------|-------|---------|
| 🐻 BEARISH | 2,500 | ✅ Active |
| 🐧 Pengztracted | 7,777 | ✅ Active |  
| 🎭 Fugz | 5,555 | ✅ Active |
| 🥊 Final Bosu | 8,888 | ✅ Active |
| 🎌 Kabu | 4,444 | ✅ Active |
| 🐝 BEEISH | 4,444 | ✅ Active |
| 🌿 Canna Sapiens | 6,000 | ✅ Active |

*All collections imported from Abstract Chain via Reservoir API*

---

## 💎 Key Features

### **🗳️ Aesthetic Voting**
- Random NFT matchups from curated collections
- Elo rating system for NFT aesthetic rankings
- Real-time vote processing and leaderboards

### **🎁 Reward System**
- XP accumulation and prize break mechanics
- Weighted lottery with multiple reward tiers
- GUGO token rewards with dynamic scaling

### **💰 Economics**
- Sustainable tokenomics with burn mechanism
- Multi-treasury revenue distribution
- Treasury safety features and tier unlocking

### **🔗 Blockchain Integration**
- On-chain vote tracking and verification
- Smart contract-based reward distribution
- Abstract Chain native integration

---

## 🛠️ Development

### **Getting Started**
1. **Read the documentation** in `DEVELOPER_SETUP_GUIDE.md`
2. **Set up your environment** (Node.js, Supabase, MetaMask)
3. **Clone and configure** the repository
4. **Import NFT data** using provided scripts
5. **Start developing** with `npm run dev`

### **Key Commands**
```bash
# Frontend Development
cd gugo-game-app
npm run dev              # Start development server
npm run build            # Build for production
node scripts/import-nfts.js CONTRACT_ADDRESS  # Import NFTs

# Smart Contract Development  
cd contracts
npm run compile          # Compile contracts
npm run test            # Run tests
npm run deploy:testnet  # Deploy to testnet
```

### **Contributing**
- Follow the coding standards in the setup guide
- Write tests for new features
- Update documentation for any changes
- Submit PRs with clear descriptions

---

## 🔒 Security

### **Smart Contract Security**
- OpenZeppelin security standards
- Comprehensive access controls
- Reentrancy protection
- Extensive testing coverage

### **Application Security**
- Environment-based configuration
- Secure wallet integration
- Input validation and sanitization
- Database security (RLS policies)

---

## 🚀 Deployment

### **Current Status**
- ✅ **Testnet**: Fully deployed and operational
- 🔄 **Mainnet**: Ready for deployment when needed

### **Deployment Guide**
See `DEPLOYMENT_SUMMARY.md` for complete deployment instructions, including:
- Contract addresses and configurations
- Environment setup
- Database population
- Monitoring and maintenance

---

## 📈 Roadmap

### **Phase 1: Launch (COMPLETE ✅)**
- ✅ Core voting mechanics
- ✅ NFT database population
- ✅ Smart contract deployment
- ✅ Professional UI/UX
- ✅ Revenue system implementation

### **Phase 2: Growth**
- 📱 Mobile optimization
- 📊 Advanced analytics and leaderboards
- 🎯 Achievement system
- 🌍 Community features
- 🔄 Additional NFT collections

### **Phase 3: Scaling**
- 🌉 Multi-chain support
- 🏛️ DAO governance
- 🎨 Creator tools
- 📱 Native mobile app
- 🤖 AI-powered recommendations

---

## 🏆 Achievement

**Built during GUGO Hackathon - A complete, production-ready NFT voting game!**

### **What We Achieved**
- 🎯 **Complete Game**: Fully functional aesthetic voting mechanics
- 🔗 **Blockchain Native**: Real on-chain economics and rewards
- 📊 **Massive Database**: 39,608 authentic NFTs from Abstract Chain
- 💰 **Revenue System**: Automated 4-wallet distribution
- 🎨 **Professional UI**: Polished user experience
- 📚 **Documentation**: Comprehensive handoff materials

---

## 📞 Support

### **For Users**
- Game tutorials and help guides (coming soon)
- Community Discord (link TBD)
- Support documentation in the app

### **For Developers**
- Complete setup guide: `DEVELOPER_SETUP_GUIDE.md`
- Technical documentation: `PROJECT_OVERVIEW.md`
- Smart contract docs: `contracts/README.md`

### **For Business**
- Deployment guide: `DEPLOYMENT_SUMMARY.md`
- Revenue model documentation
- Operational procedures

---

## 📄 License

This project is part of the GUGO Hackathon submission.

---

## 🎉 Ready to Launch!

**Taste Machine is production-ready and waiting for you to experience the future of NFT aesthetic voting!**

*Join the revolution in NFT valuation through community-driven aesthetic judgment.*

---

**🔗 Contract**: `0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13`  
**🌐 Network**: Abstract Sepolia Testnet  
**🎮 NFTs**: 39,608 ready for voting  
**💰 Revenue**: Automated distribution active  
**📱 Status**: PRODUCTION READY  

*Built with ❤️ for the Abstract Chain ecosystem*