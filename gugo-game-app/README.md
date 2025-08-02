# 🎮 Gugo Game

**Mobile-first NFT aesthetic voting game on Abstract Chain**

A blockchain-powered game where users vote on NFT aesthetics, earn rewards, and participate in a gamified ecosystem built on Abstract Chain with native account abstraction.

## 🌟 Features

- **🔗 Abstract Global Wallet Integration** - Seamless onboarding with AGW
- **📱 Mobile-First Design** - Optimized for mobile gameplay
- **🎯 NFT Aesthetic Voting** - Vote on matchups between NFTs
- **💰 Token Economy** - GUGO/FGUGO tokens for voting and rewards
- **🎁 Prize Break System** - Random rewards every 10 votes
- **📊 Scoring System** - Elo ratings and aesthetic scores
- **⚡ Real-time Updates** - Live gameplay with Supabase

## 🛠 Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS v4
- **Blockchain**: Abstract Chain (Testnet/Mainnet)
- **Wallets**: Abstract Global Wallet (AGW) + Metamask fallback
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Smart Contracts**: GUGO and FGUGO ERC20 tokens

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Abstract Global Wallet or Metamask

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/gugo-game.git
   cd gugo-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   NEXT_PUBLIC_CHAIN=testnet
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   NEXT_PUBLIC_GUGO_CONTRACT=0x3eAd960365697E1809683617af9390ABC9C24E56
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎮 How to Play

1. **Connect Wallet** - Connect your Abstract Global Wallet
2. **Vote on Matchups** - Choose between NFT pairs
3. **Earn Rewards** - Get XP and tokens for voting
4. **Prize Breaks** - Random rewards every 10 votes
5. **Climb Rankings** - Build your aesthetic score

## 🏗 Architecture

The game follows a mobile-first, modular architecture:

```
/gugo-game-app
├── /src/app/           # Next.js App Router pages
├── /src/components/    # Reusable React components
├── /lib/              # Utilities (Supabase, wallet, contracts)
├── /hooks/            # Custom React hooks
├── /types/            # TypeScript interfaces
└── /public/           # Static assets
```

## 📊 Dynamic Token Economics

The game uses **live market pricing** with hourly updates for responsive economics:

- **Vote Cost**: $0.04 USD per vote (4 cents)
- **Minimum Purchase**: 10 votes = $0.40 USD
- **Payment Methods**: ETH or GUGO tokens  
- **Price Updates**: Fetched hourly from live market data
- **Eligibility**: Need $0.40 worth of **either** ETH OR GUGO (not both)

### Pricing Philosophy:
- **Responsive Pricing**: Uses live market prices updated hourly
- **Consistent Economics**: Same pricing for testnet (FGUGO) and mainnet (GUGO)
- **Fair Market Access**: Reflects real-time market conditions
- **Cache**: 1-hour price caching for performance

### Price Sources:
- **ETH**: Live market price from CryptoCompare API
- **GUGO**: Live market price from multiple sources (CryptoCompare, CoinGecko, DEX)
- **Manual Updates**: Use `scripts/update-gugo-price.js` to set GUGO prices when needed

### Updating GUGO Price:
```bash
# Update GUGO price manually (example with $0.25)
node scripts/update-gugo-price.js 0.25
```

## 🗄️ Database Schema

### Core Tables
- `users` - Player profiles and stats
- `nfts` - NFT metadata and scores
- `votes` - Voting history
- `matchups` - NFT pair combinations
- `prize_breaks` - Reward distribution

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Status

**✅ Completed (Tasks 1-4)**
- [x] Next.js project setup
- [x] Dependencies installation
- [x] Tailwind CSS configuration
- [x] Mobile viewport setup
- [x] Supabase integration
- [x] Abstract Global Wallet integration

**🚧 In Progress**
- [ ] Supabase authentication
- [ ] User table creation
- [ ] Wallet connection flow
- [ ] Game mechanics implementation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Abstract Chain Documentation](https://docs.abs.xyz/)
- [Abstract Global Wallet](https://docs.abs.xyz/abstract-global-wallet/)
- [Supabase Documentation](https://supabase.com/docs)

## 🐛 Support

If you encounter any issues, please file a bug report on the [Issues](https://github.com/yourusername/gugo-game/issues) page.

---

**Built with ❤️ for the Abstract Chain ecosystem**
