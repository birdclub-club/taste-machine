
# Gugo Game — Full Architecture Overview

## 🌐 Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/)
- **Backend / DB**: [Supabase](https://supabase.com/) (PostgreSQL, Edge Functions, Auth)
- **Blockchain**: Abstract Chain (TestNet/Mainnet) using `ethers.js`
- **Wallets**: Metamask, Abstract Global Wallet (AGW)
- **Smart Contracts**: GUGO and FGUGO ERC20
- **Storage**: NFT metadata via IPFS or Abstract-native storage if available
- **UI Framework**: Tailwind CSS (optional but recommended)

## 🗂 File & Folder Structure

```plaintext
/gugo-game-app
│
├── /public                # Static files (e.g., icons, images)
├── /pages                 # Next.js routes
│   ├── /api               # API routes (serverless functions)
│   │   └── prizebreak.ts  # Server function to handle Prize Break logic
│   ├── index.tsx          # Home page
│   ├── play.tsx           # Main swipe game interface
│   ├── wallet.tsx         # Wallet connection & status
│   └── admin.tsx          # Admin dashboard (matchup setup, stats)
│
├── /components            # Reusable React components
│   ├── Layout.tsx
│   ├── Header.tsx
│   ├── SwipeCard.tsx
│   ├── MatchupDisplay.tsx         # Swipe-based matchups, responsive layout 🔶
│   ├── WalletConnect.tsx
│   └── PrizeBreakModal.tsx
│
├── /lib                   # Shared helpers/utilities
│   ├── supabase.ts        # Supabase client
│   ├── wallet.ts          # Wallet connection logic
│   ├── contract.ts        # Abstract Chain + GUGO contract logic
│   ├── matchup.ts         # Fetch/compute next matchup
│   └── aestheticScore.ts  # Calculate score, XP logic
│
├── /hooks                 # Custom React hooks
│   ├── useWallet.ts
│   ├── useVotes.ts
│   └── useXP.ts
│
├── /types                 # TypeScript interfaces
│   └── index.ts
│
├── /styles                # Global styles
│   └── globals.css
│
├── .env.local             # Local environment variables
├── next.config.js         # Next.js config
└── README.md
```

## 🧠 State & Data Flow

### 1. **Auth + User Profiles** (Supabase)
- **State**: Stored in Supabase Auth + user table
- Tracks:
  - XP
  - Total Votes Cast
  - Daily Free Votes Claimed
  - GUGO balance (synced from wallet)
  - Matchup preferences (e.g. cross-project vs. intra-project)

### 2. **Blockchain Interaction**
- **State**: Stored on-chain (GUGO/FGUGO) + in frontend app state
- Interactions:
  - Burn GUGO for votes
  - Claim free votes (frontend check + backend update)
  - Cast regular vote (burn 1 vote token)
  - Cast super vote (burn 10 vote tokens)
  - Claim Prize Break rewards

```ts
export const GUGO_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CHAIN === 'testnet'
    ? '0x3eAd960365697E1809683617af9390ABC9C24E56' // FGUGO
    : 'MAINNET_CONTRACT_HERE';
```

### 3. **Game Logic**
- Matchups pulled from Supabase
- Local state tracks current match
- Result is sent to Supabase, which:
  - Updates aesthetic score
  - Triggers Elo update and XP
  - Calls Prize Break API every 10 votes
  - Stores vote event with timestamp and user ID

### 4. **Prize Break**
- Every 10 votes cast triggers `/api/prizebreak`
- Backend calculates reward using weighted randomness
- GUGO payout triggers on-chain transfer
- XP/Vote rewards updated in Supabase

## 🔗 Wallet Support

### Metamask
- Integrated using `ethers.js`
- Used for transaction signing, GUGO balance fetch

### Abstract Global Wallet (AGW)
- Integrated using AGW React SDK: [`docs.abs.xyz`](https://docs.abs.xyz/abstract-global-wallet/agw-react/native-integration)
- Modular connection via `useWallet.ts` to support both Metamask + AGW

```ts
export const connectWallet = async () => {
  if (isAbstractWalletInstalled()) {
    return connectAbstractWallet();
  } else {
    return connectMetamask();
  }
};
```

## 🔄 Environments

Use `.env.local` for switching between testnet and mainnet:

```env
NEXT_PUBLIC_CHAIN=testnet
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GUGO_CONTRACT=0x3eAd960365697E1809683617af9390ABC9C24E56
```

Switch to mainnet by updating values and redeploying.

## 🛠 Supabase Tables

### `users`
| id | wallet_address | xp | total_votes | last_free_vote_claim |
|----|----------------|----|-------------|-----------------------|

### `votes`
| id | user_id | nft1_id | nft2_id | winner_id | super_vote | timestamp |

### `nfts`
| id | project | metadata_uri | looks_score | elo_rating |

### `matchups`
| id | nft1_id | nft2_id | is_cross_project | status |

### `prize_breaks`
| id | user_id | reward_type | value | timestamp |

## 📊 Admin Tools

Admin dashboard at `/admin.tsx` lets you:
- Manually seed matchups
- Monitor vote trends
- View high ELO or Looks Score NFTs
- Trigger reruns or score recalculations


## 📱 Mobile Optimization

The game is designed with a mobile-first approach:

- All layouts use Tailwind’s mobile-first responsive classes (`flex-col md:flex-row`, etc.)
- Touch gestures (e.g., swipe, tap-hold) are central to gameplay
- Prize modals and buttons are sized for smaller screens
- Wallet integrations support mobile: Abstract Global Wallet and Metamask in-app browsers
- Every screen and interaction is tested for responsiveness


### 🧪 Mobile Testing

- Chrome DevTools mobile emulator used during development
- App tested on physical devices with Metamask Mobile and AGW
