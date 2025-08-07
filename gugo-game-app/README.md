# 🎮 Taste Machine

**Swiss Minimalist NFT Aesthetic Voting Game on Abstract Chain**

A sophisticated blockchain-powered game where users vote on NFT aesthetics with a clean, professional interface inspired by Swiss graphic design. Features mobile-first responsive design, interactive components, and seamless Abstract Chain integration.

## 🚀 Live Deployment

**✅ Production Ready**: Taste Machine is live and fully operational on Vercel with robust error handling and retry mechanisms.

- **Live URL**: [Deployed on Vercel](https://vercel.com)
- **Database**: Supabase (PostgreSQL) with 46,615+ NFTs
- **Status**: All core features operational, purchase flows tested and working
- **Last Updated**: August 2025

## 🌟 Features

### **🎨 Swiss Minimalist Design**
- **Clean Interface**: Inspired by 60s/70s Swiss graphic design principles
- **Dark Theme**: Consistent `#1a1a1a` background with Abstract Chain green accents
- **Professional Status Bar**: Real-time balances and wallet connection
- **Green Dot Grid**: Subtle pattern with 28px spacing and medium green dots
- **Background Consistency**: Welcome modal matches site background perfectly

### **📱 Mobile-First Experience**
- **Responsive Layout**: Side-by-side on desktop, stacked on mobile  
- **Touch Gestures**: Native swipe-to-vote functionality
- **Optimized Performance**: Smooth animations and transitions
- **Mobile Breakpoints**: Tailored experience for all screen sizes

### **⚡ Interactive Components**
- **Clickable Token IDs**: Large numbers (#1234) for instant address copying
- **Swipe Slider**: Horizontal on desktop, vertical swipe on mobile
- **Hover Effects**: NFT cards with "VOTE" overlay and scaling
- **Copy Confirmation**: Visual feedback for all copy actions
- **Smart "No" Button**: Appears after 5 seconds with smooth fade-in animation

### **🦆 Enhanced Prize Experience**
- **Duck Notifications**: Context-aware duck animations for different prize types
  - **Burning Duck**: Appears for GUGO prizes with fire glow effect
  - **Art Duck**: Appears for non-GUGO prizes with white glow effect
- **Linear Marquee**: Infinite scrolling text effects with prize-specific phrases
- **Delayed Prize Reveal**: 1-second delay for dramatic prize unveiling
- **Random Messages**: Dynamic "It's Happening" variations for anticipation

### **🎯 Core Gameplay**
- **NFT Aesthetic Voting** - Vote on matchups between NFTs
- **💰 Token Economy** - FGUGO tokens for voting and rewards  
- **🎁 Enhanced Prize Break System** - Rewards every 10 votes + free vote compensation
- **🔥 Super Vote System** - Premium fire votes with 2x Elo impact (costs 5 votes)
- **📊 Elo Rating System** - Dynamic aesthetic rankings
- **🔗 Abstract Global Wallet** - Seamless onboarding with AGW
- **🎮 Enhanced Welcome Experience** - Comprehensive onboarding with detailed mission explanation
  - **Clear Value Proposition**: "Where beauty matters — and metadata doesn't"
  - **Detailed Explanation**: On-chain aesthetic scoring and voting logic
  - **Simple CTA**: Clean "Ready" button for immediate engagement
- **🔗 Simplified Wallet Connection** - Streamlined prompt: "Connect your wallet to start voting, earning, and burning"
- **🛍️ Streamlined Purchase Flow** - Professional Licks purchase with session key integration
- **⚡ Session Keys** - Gasless transactions with detailed authorization messages
- **⭐ Favorites Gallery** - Track and manage your most loved NFTs with pricing data
- **📊 Real-time Activity Counter** - Live "Taste Activity Today" with dynamic growth simulation

### **🛡️ Robust Infrastructure**
- **Intelligent IPFS Gateway Management** - Adaptive selection from 8+ gateways with health tracking
- **Graceful Image Failure Handling** - 10 free votes awarded + automatic recovery attempts
- **Professional Maintenance Mode** - Polished UX during system issues
- **Self-Healing Systems** - Automatic recovery when gateway issues resolve
- **Robust Purchase System** - 3-retry mechanism with exponential backoff for failed transactions
- **Balance Sync** - 5-retry refresh system ensures accurate balance updates after purchases
- **API Error Handling** - Comprehensive error boundaries with user-friendly fallbacks

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

1. **Welcome Experience** - Learn about Taste Machine's mission through comprehensive onboarding
2. **Connect Wallet** - Simple prompt: "Connect your wallet to start voting, earning, and burning"
3. **Vote on Matchups** - Choose between NFT pairs or wait for the "No" button (appears after 5 seconds)
4. **Super Votes** - Use fire buttons for premium votes (costs 5 votes, 2x Elo impact)
5. **Earn Rewards** - Get XP and tokens for voting with enhanced prize notifications
6. **Prize Breaks** - Rewards every 10 votes with duck animations and marquee effects
7. **Experience Burning** - Watch your GUGO prizes trigger burning duck notifications
8. **Climb Rankings** - Build your aesthetic score with enhanced Elo system

### **🔥 Super Vote System**
- **Fire Buttons**: Premium voting option with flame emoji
- **Cost**: 5 regular votes per super vote
- **Impact**: 2x Elo rating change for both NFTs
- **Purpose**: Express strong aesthetic preferences

### **⭐ Favorites Gallery System**
- **Automatic Collection**: Fire votes and 100% slider votes automatically add NFTs to favorites
- **Smart Gallery**: Access via gold shimmer button in wallet dropdown
- **Rich Metadata**: Display collection names, Token IDs, and vote types
- **Magic Eden Integration**: Direct links to collection and NFT pages
- **Price Discovery**: Toggle to show/hide current listing prices
- **Easy Management**: Remove favorites with dedicated buttons
- **Visual Excellence**: Clean grid layout with responsive design

### **📊 Real-time Activity Counter**
- **Live Data**: Fetches daily vote count from Supabase database
- **Boost Multiplier**: 5x multiplier for enhanced engagement metrics
- **Simulated Growth**: Believable real-time increases every 1.5 seconds
- **Visual Design**: Integrated with main interface, includes Lick icon
- **Data Source**: `SELECT COUNT(*) FROM votes WHERE created_at::date = CURRENT_DATE`

### **🎁 Enhanced Rewards & Notifications**
- **Regular Prize Breaks**: Every 10 votes with dramatic reveal timing
- **Duck Notifications**: Context-aware animations based on prize type
  - **GUGO Prizes**: Burning duck with fire effects and "We're burning GUGO fam!" message
  - **Non-GUGO Prizes**: Art duck with white glow and "I'm here for the art." message
- **Infinite Marquee**: Linear scrolling text with prize-specific phrases
  - **GUGO Phrases**: "Let it burn!", "Burn. Burn. Burn. Burn.", "Oh hell yeah!"
  - **Non-GUGO Phrases**: "This should come in handy.", "For the love of art.", "Gib"
- **Random Prize Messages**: Dynamic "It's happening again", "Prize incoming", "This could be good"
- **Free Vote Compensation**: 10 votes awarded during image loading issues
- **Automatic Recovery**: System attempts to fix issues during prize breaks

## 🏗 Architecture

The game follows a mobile-first, component-based architecture with Swiss design principles:

```
/gugo-game-app
├── /src/app/           # Next.js App Router with main voting interface
│   ├── /api/           # API routes for data and external services
│   │   ├── daily-vote-count/ # Real-time activity counter data source
│   │   ├── favorites/    # Favorites management endpoints
│   │   └── nft-price/    # NFT pricing data from external APIs
│   ├── globals.css     # Swiss design system & CSS variables with dot grid
│   ├── page.tsx        # Main voting experience with favorites integration
│   └── layout.tsx      # App layout and providers
├── /src/components/    # Reusable React components
│   ├── StatusBar.tsx   # Top navigation with gold shimmer Favorites button
│   ├── MatchupCard.tsx # NFT voting interface with smart "No" button timing
│   ├── TokenBalance.tsx # Balance checking and display
│   ├── WalletConnect.tsx # Wallet integration
│   ├── WelcomePopup.tsx # Enhanced onboarding with comprehensive mission explanation
│   ├── CircularMarquee.tsx # Linear scrolling text effects for prize celebrations
│   ├── FavoritesGallery.tsx # Professional favorites management modal
│   └── PurchaseAlert.tsx # Elegant modal for vote purchase prompts
├── /src/hooks/         # Custom React hooks for game logic
│   ├── useVote.ts      # Vote submission with super vote support
│   ├── usePrizeBreak.ts # Enhanced prize break with free vote integration
│   ├── useFavorites.ts # Favorites management and state
│   └── useActivityCounter.ts # Real-time activity counter with growth simulation
├── /lib/              # Utilities and core systems
│   ├── supabase.ts     # Database client
│   ├── preloader.ts    # Advanced session preloading with IPFS health tracking
│   ├── matchup.ts      # Matchup generation with unrevealed NFT filtering
│   └── ipfs-gateway-manager.ts # 🌐 Intelligent IPFS gateway system
├── /migrations/        # Database schema updates
│   ├── 15-add-favorites-system.sql # Initial favorites implementation
│   └── 16-add-collection-address-to-favorites.sql # Enhanced favorites metadata
└── /public/           # Static assets (logos, icons)
```

### **Component Highlights**
- **StatusBar**: drip.haus-inspired design with balance tracking and gold shimmer Favorites button
- **MatchupCard**: Interactive NFT cards with smart timing and hover effects
- **WelcomePopup**: Comprehensive onboarding with consistent background styling
- **CircularMarquee**: Infinite scrolling text effects with phrase categories
- **PurchaseAlert**: Elegant modal for insufficient vote scenarios
- **FavoritesGallery**: Professional modal with NFT grid, pricing data, and Magic Eden integration
- **ActivityCounter**: Real-time taste activity display with live data and growth simulation
- **IPFS Gateway Manager**: Bulletproof image loading with health tracking
- **Enhanced Prize Notifications**: Duck animations with context-aware messaging
- **Responsive Design**: Mobile-first with touch gesture support
- **CSS Variables**: Consistent color palette and spacing system

## 🌐 Intelligent IPFS Infrastructure

**Production-grade image loading with bulletproof reliability:**

### **Multi-Gateway Health System**
- **8+ IPFS Gateways**: Automatic failover across multiple providers
- **Real-time Health Tracking**: Success rates, response times, and availability monitoring
- **Adaptive Selection**: Always uses the fastest, most reliable gateway available
- **Self-Healing**: Automatically recovers when gateways come back online

### **Graceful Failure Handling**
```typescript
// Three-tier protection system:
// Tier 1: Robust gateway switching (8+ gateways)
// Tier 2: Free votes prize break (10 votes awarded) 
// Tier 3: Professional maintenance mode
```

**User Experience During Issues:**
1. **Normal Operation**: Lightning-fast images with best gateway
2. **First Issue**: *"Good news! We awarded you 10 free votes as compensation!"*
3. **Auto Recovery**: System attempts repair during 3-second prize break
4. **Persistent Issues**: Professional maintenance screen with Try Again option

### **Gateway Network**
- `ipfs.io` (Primary)
- `gateway.pinata.cloud`
- `dweb.link` 
- `ipfs.filebase.io`
- `w3s.link`
- `gateway.ipfs.io`
- `hardbin.com`
- `cloudflare-ipfs.com` (Fallback)

### **Debug Tools**
```javascript
// Available in browser console
gatewayHealth() // View real-time gateway status
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

### Current Development Workflow

**Development Environment**
1. Run `npm run dev` to start local development server on http://localhost:3000
2. Test all features locally before pushing to production
3. Use browser developer tools to monitor API calls and error handling

**Deployment Pipeline**
1. Push code to GitHub repository
2. Vercel automatically deploys from main branch
3. Environment variables are managed through Vercel dashboard
4. Production database uses Supabase with live API keys

**Testing Protocol**
- Test wallet connection and session key creation
- Verify voting flows (matchup and slider)
- Test Licks purchase flow with retry mechanisms
- Confirm balance updates and refresh logic

### Project Status

**✅ Phase 1: Core Setup (COMPLETE)**
- [x] Next.js project setup with TypeScript
- [x] Dependencies installation and configuration
- [x] Tailwind CSS with custom design system
- [x] Mobile viewport and responsive setup
- [x] Supabase integration and database schema
- [x] Abstract Global Wallet integration

**✅ Phase 2: UI/UX Design (COMPLETE)**
- [x] Swiss minimalist design system
- [x] Dark theme with sophisticated gradients
- [x] Professional StatusBar component
- [x] Interactive NFT voting interface
- [x] Mobile-first responsive design
- [x] Touch gesture support and swipe voting
- [x] Clickable token IDs with copy functionality
- [x] Smooth animations and transitions

**✅ Phase 3: Core Gameplay (COMPLETE)**
- [x] NFT aesthetic voting mechanics
- [x] Real-time balance checking and display
- [x] Enhanced prize break system with free vote compensation
- [x] Super vote system with fire buttons (2x Elo impact)
- [x] Elo rating system for NFTs
- [x] Multi-wallet revenue distribution
- [x] Smart "No" button with 5-second delay and fade-in

**✅ Phase 4: Production Infrastructure (COMPLETE)**
- [x] Intelligent IPFS gateway management (8+ gateways)
- [x] Graceful image failure handling with automatic recovery
- [x] Professional maintenance mode UI
- [x] Real-time gateway health tracking and adaptive selection
- [x] Comprehensive error handling and user compensation
- [x] Self-healing systems with automatic failover

**✅ Phase 5: Enhanced User Experience (COMPLETE)**
- [x] Welcome popup with collection choice (Bearish vs Mix it Up)
- [x] Collections menu with toggle functionality
- [x] Redesigned modals (About, How, Buy Licks) with professional styling
- [x] Simplified reward popups and session prompts
- [x] Enhanced session key authorization messages
- [x] Streamlined purchase flow with robust error handling

**✅ Phase 6: Production Deployment (COMPLETE)**
- [x] Live deployment on Vercel with automatic CI/CD
- [x] Database connectivity with 46,615+ NFTs operational
- [x] Purchase flow with 3-retry mechanism and exponential backoff
- [x] Balance refresh system with 5-retry logic
- [x] Comprehensive error logging and user feedback
- [x] Production-ready with all core features tested and working

## 🔧 Recent Fixes & Improvements

### **Latest Updates (August 2025)**
- **✅ Favorites Gallery System**: Complete NFT favorites tracking with Magic Eden integration
  - **Automatic Collection**: Fire votes and 100% slider votes auto-add to favorites
  - **Price Discovery**: Toggle to show/hide current NFT listing prices
  - **Rich Metadata**: Collection names, Token IDs, vote types, and direct links
  - **Gold Shimmer Button**: Premium styling with 3-second animation cycle
- **✅ Real-time Activity Counter**: Live "Taste Activity Today" with 5x boost multiplier
  - **Live Database**: Fetches daily vote count from Supabase with growth simulation
  - **Visual Integration**: Inline display with Lick icon and real-time updates
- **✅ Enhanced UI Polish**: 
  - **Gold Shimmer Effects**: Premium button styling with keyframe animations
  - **Dot Grid Background**: Extended to cover entire scrollable area
  - **Status Bar Enhancements**: Adjusted red dot positioning and icon sizing
  - **Prize Display**: Color-matched Lick icons and "Congrats!" text for non-GUGO awards
- **✅ Database Schema Updates**: 
  - **Favorites Table**: Added collection_address column for Magic Eden integration
  - **Safe Migrations**: Incremental SQL updates with IF NOT EXISTS logic
  - **RPC Functions**: Enhanced favorites management with proper security
- **✅ Enhanced Welcome Experience**: Comprehensive onboarding with detailed mission explanation
- **✅ Simplified Wallet Connection**: Streamlined prompt focusing on core value proposition
- **✅ Duck Notification System**: Context-aware animations for different prize types
- **✅ Infinite Marquee Effects**: Linear scrolling text with prize-specific phrase categories
- **✅ Background Consistency**: Welcome modal matches main site's green dot pattern
- **✅ Prize Reveal Timing**: 1-second delay for dramatic effect with random messages
- **✅ Number Formatting**: Comma formatting for large prize amounts (1,000+)
- **✅ Fixed**: "Failed to fetch" error in Licks purchase flow
- **✅ Enhanced**: Purchase retry mechanism with exponential backoff (3 attempts)
- **✅ Improved**: Balance refresh logic with 5-retry system and delay handling
- **✅ Resolved**: Development server stability issues
- **✅ Optimized**: API error handling across all endpoints

### **Pending Items for Future Development**
- **🔄 Security**: Re-implement Row Level Security (RLS) for production
- **🔍 Audit**: Conduct comprehensive security audit before mainnet
- **📊 Monitoring**: Set up API key expiration alerts
- **🏥 Health**: Implement automated health monitoring in CI/CD
- **🧪 Testing**: End-to-end voting flow automation

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
