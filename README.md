# 🎮 Taste Machine

**An NFT Aesthetic Voting Game on Abstract Chain**

*Vote on the aesthetic appeal of NFTs, earn rewards, and participate in a gamified blockchain experience.*

---

## 🚀 Project Status: LIVE & DEPLOYED ✨

**Taste Machine is live and fully operational!**

- ✅ **Live Application**: https://taste-machine.vercel.app 
- ✅ **Smart Contract**: Deployed on Abstract Testnet
- ✅ **NFT Database**: 46,615 NFTs across 8+ collections  
- ✅ **Revenue System**: 4-wallet automated distribution
- ✅ **Frontend**: Professional voting interface with welcome popup
- ✅ **TypeScript**: All compilation errors resolved
- ✅ **Environment Variables**: Configured across all Vercel environments
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
🎮 Total NFTs: 46,615 across 8+ collections
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
1. **Visit**: https://taste-machine.vercel.app
2. **Connect** your Abstract-compatible wallet (MetaMask recommended)
3. **Get testnet ETH** from the Abstract faucet: https://portal.abstract.xyz/faucet
4. **Experience** the welcome popup and choose your NFT focus
5. **Start voting** on NFT aesthetic matchups and earn rewards!

### **For Developers**
```bash
# Clone repository
git clone https://github.com/birdclub-club/taste-machine.git
cd taste-machine

# Switch to deployed branch (matches production exactly)
cd gugo-game-app
git checkout development-backup-enhanced-systems

# Quick setup
npm install
cp .env.local.example .env.local
# Configure Supabase credentials (see DEVELOPER_SETUP_GUIDE.md)
npm run dev

# Auto-deploy: Any push to development-backup-enhanced-systems 
# automatically deploys to https://taste-machine.vercel.app
```

---

## 📚 Documentation

### **📖 Complete Documentation**
- **[📋 PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)** - Complete project documentation
- **[🔧 DEVELOPER_SETUP_GUIDE.md](./DEVELOPER_SETUP_GUIDE.md)** - Developer onboarding
- **[🚀 DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Production deployment details
- **[🛠️ DEVELOPMENT_TROUBLESHOOTING.md](./DEVELOPMENT_TROUBLESHOOTING.md)** - Development server issues & solutions
- **[🎮 game-logic-summary.md](./game-logic-summary.md)** - Game mechanics breakdown
- **[🎨 voting_ui_scaffold.md](./voting_ui_scaffold.md)** - UI component guide

### **📁 Module Documentation**
- **[Frontend README](./gugo-game-app/README.md)** - Frontend application details
- **[Contracts README](./contracts/README.md)** - Smart contract documentation

---

## 🎮 NFT Collections (46,615 Total)

| Collection | Count | Status |
|------------|-------|---------|
| 🐻 BEARISH | 2,500 | ✅ Active |
| 🐧 Pengztracted | 7,777 | ✅ Active |  
| 🎭 Fugz | 5,555 | ✅ Active |
| 🥊 Final Bosu | 8,888 | ✅ Active |
| 🎌 Kabu | 4,444 | ✅ Active |
| 🐝 BEEISH | 4,444 | ✅ Active |
| 🌿 Canna Sapiens | 6,000 | ✅ Active |
| 🔍 **Additional Collections** | ~10,007 | ✅ Active |

*All collections imported from Abstract Chain via Reservoir API*

---

## 💎 Key Features

### **🎨 Swiss Minimalist UI Design**
- Clean, modern interface inspired by 60s/70s Swiss graphic design
- Dark theme with sophisticated radial gradients
- Professional status bar with real-time balances and wallet connection
- Mobile-first responsive design with smooth animations

### **🗳️ Aesthetic Voting Experience**
- Side-by-side NFT matchups for desktop, stacked for mobile
- Interactive swipe-to-vote slider with Abstract logo
- Clickable token IDs (#1234) for instant address copying
- Elo rating system for NFT aesthetic rankings
- Real-time vote processing and confirmation feedback

### **📱 Mobile-Optimized Interface**
- Touch-friendly swipe gestures for voting
- Responsive layout that adapts to all screen sizes
- Optimized dot grid background pattern
- Smooth animations and transitions

### **🎁 Reward System**
- XP accumulation and prize break mechanics every 10 votes
- Weighted lottery with multiple reward tiers
- FGUGO token rewards with dynamic scaling
- Visual confirmation for all reward claims

### **💰 Economics & Treasury**
- Sustainable tokenomics with automated burn mechanism
- 4-wallet revenue distribution system
- Treasury safety features and tier unlocking
- Real-time balance display in status bar

### **🔗 Blockchain Integration**
- On-chain vote tracking and verification
- Smart contract-based reward distribution
- Abstract Chain native integration with AGW support
- Seamless wallet connection and transaction flow

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

### **🚨 Development Server Issues?**
If you encounter problems with the development server (site unreachable, compilation issues, etc.), check our **[Development Troubleshooting Guide](./DEVELOPMENT_TROUBLESHOOTING.md)** for common solutions.

**Quick Fix:**
```bash
# Navigate to correct directory
cd gugo-game-app

# Kill any stuck processes  
pkill -f "next.*dev"

# Start fresh (simple command works best)
npm run dev
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
- ✅ NFT database population (39,608 NFTs)
- ✅ Smart contract deployment
- ✅ Professional UI/UX
- ✅ Revenue system implementation

### **Phase 2: Enhanced UX (COMPLETE ✅)**
- ✅ Swiss minimalist design system
- ✅ Mobile optimization with swipe gestures
- ✅ Interactive status bar with real-time balances
- ✅ Clickable token IDs with address copying
- ✅ Dark theme with sophisticated gradients
- ✅ Responsive animations and smooth transitions

### **Phase 3: Growth Features**
- 📊 Advanced analytics and leaderboards
- 🎯 Achievement system
- 🌍 Community features and social profiles
- 🔄 Additional NFT collections
- 🎰 Enhanced prize break animations

### **Phase 4: Scaling**
- 🌉 Multi-chain support
- 🏛️ DAO governance
- 🎨 Creator tools
- 📱 Native mobile app
- 🤖 AI-powered recommendations

---

## 🏆 Achievement

**Built during GUGO Hackathon - A complete, production-ready NFT voting game!**

### **What We Achieved**
- 🚀 **Live Deployment**: Production-ready app at https://taste-machine.vercel.app
- 🎯 **Complete Game**: Fully functional aesthetic voting mechanics
- 🔗 **Blockchain Native**: Real on-chain economics and rewards
- 📊 **Massive Database**: 46,615 authentic NFTs from Abstract Chain
- 💰 **Revenue System**: Automated 4-wallet distribution
- 🎨 **Swiss Design UI**: Sophisticated minimalist interface with welcome popup
- 📱 **Mobile-First UX**: Responsive design with swipe gestures
- ⚡ **Interactive Features**: Clickable token IDs, copy functionality
- 🌙 **Dark Theme**: Professional gradients and dot grid patterns
- 🔧 **Production Ready**: All TypeScript errors resolved, environment variables configured
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

**🚀 Live App**: https://taste-machine.vercel.app  
**🔗 Contract**: `0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13`  
**🌐 Network**: Abstract Sepolia Testnet  
**🎮 NFTs**: 46,615 ready for voting  
**💰 Revenue**: Automated distribution active  
**📱 Status**: LIVE & OPERATIONAL  
**⚡ Branch**: `development-backup-enhanced-systems` (auto-deploy)

*Built with ❤️ for the Abstract Chain ecosystem*