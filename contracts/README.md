# Gugo Game Smart Contracts

Smart contracts for **"Taste Machine"** - an NFT aesthetic voting game on Abstract Chain.

## 🏗️ Architecture

### Core Contracts

#### `GugoVoteManager.sol`
The main game contract that handles:
- **Voting mechanics** - NFT vs NFT voting matches
- **Elo rating system** - Dynamic rating updates based on vote outcomes  
- **User management** - XP, votes, streaks, daily free votes
- **Payment processing** - ETH and GUGO token payments for votes
- **Dynamic pricing** - USD-based vote pricing with live exchange rates

#### `MockERC20.sol`
Test token for development and testing purposes.

## 🎮 Game Mechanics

### Vote Economics
- **Vote Price**: $0.04 USD per vote
- **Minimum Purchase**: 10 votes ($0.40 total)
- **Daily Free Votes**: 3 votes per day per user
- **Payment Methods**: Abstract ETH or GUGO tokens

### Elo Rating System
- **Initial Rating**: 1200 points
- **K-Factor**: 32 (adjustment rate)
- **Minimum Rating**: 100 points
- **Dynamic updates** based on vote outcomes

### User Progression
- **XP per Vote**: 10 XP
- **Winner Bonus**: +25 XP for picking the winning NFT
- **Streak Tracking**: Win/loss streaks for achievements

## 💰 Dynamic Pricing

The contract uses real-time price feeds to maintain consistent USD pricing:

```solidity
// Example: 10 votes = $0.40
// If ETH = $3200: Cost = 0.000125 ETH
// If GUGO = $0.01: Cost = 40 GUGO tokens
```

Price updates are managed by the price oracle (owner by default).

## 🚀 Deployment

### Prerequisites
```bash
npm install
```

### Compile Contracts
```bash
npm run compile
```

### Run Tests
```bash
npm run test
```

### Deploy to Abstract Testnet
```bash
# Set up environment variables
export PRIVATE_KEY="your_private_key_here"
export GUGO_TOKEN_ADDRESS="0x3eAd960365697E1809683617af9390ABC9C24E56"

# Deploy
npm run deploy:testnet
```

### Deploy to Abstract Mainnet
```bash
npm run deploy:mainnet
```

## 🔧 Environment Variables

Create a `.env` file in the contracts directory:

```env
# Required for deployment
PRIVATE_KEY=your_wallet_private_key

# Token addresses
GUGO_TOKEN_ADDRESS=0x3eAd960365697E1809683617af9390ABC9C24E56

# Price settings
INITIAL_GUGO_PRICE=1000000  # $0.01 * 1e8 for testnet

# API keys (for contract verification)
ABSTRACT_API_KEY=your_api_key
```

## 📡 Contract Interaction

### Register User
```solidity
function registerUser() external
```

### Claim Daily Free Votes
```solidity
function claimDailyFreeVotes() external
```

### Purchase Votes with ETH
```solidity
function purchaseVotesWithETH(uint256 voteCount) external payable
```

### Purchase Votes with GUGO
```solidity
function purchaseVotesWithGUGO(uint256 voteCount) external
```

### Vote on Match
```solidity
function vote(uint256 matchId, uint256 choice, uint256 voteAmount) external
```
- `choice`: 1 for NFT A, 2 for NFT B
- `voteAmount`: Number of votes to cast

### View Functions
```solidity
function getVoteCostETH(uint256 voteCount) external view returns (uint256)
function getVoteCostGUGO(uint256 voteCount) external view returns (uint256)
function getMatchInfo(uint256 matchId) external view returns (...)
function canClaimFreeVotes(address user) external view returns (bool)
```

## 🎯 Game Flow

1. **User Registration**: Call `registerUser()`
2. **Get Votes**: Claim daily free votes or purchase with ETH/GUGO
3. **Match Creation**: Admin creates NFT vs NFT matches
4. **Voting**: Users vote on active matches
5. **Resolution**: Matches auto-resolve after 24 hours
6. **Rewards**: XP and streak updates, Elo rating changes

## 🔐 Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Emergency pause functionality
- **Ownable**: Admin controls for critical functions
- **Input validation**: Comprehensive checks for all parameters
- **Safe arithmetic**: Uses Solidity 0.8+ built-in overflow protection

## 🧪 Testing

The test suite covers:
- Contract deployment and initialization
- User registration and vote claiming
- Vote purchasing with ETH and GUGO
- NFT registration and match creation
- Voting mechanics and restrictions
- Price updates and calculations

Run tests:
```bash
npm run test:verbose
```

## 📊 Gas Optimization

The contracts are optimized for gas efficiency:
- **Batch operations** where possible
- **Efficient storage** layout
- **Minimal external calls**
- **Optimized loops** and calculations

## 🔗 Integration with Frontend

The frontend integration requires:
1. Contract ABI files (generated in `artifacts/`)
2. Contract addresses from deployment
3. Environment variables updated with contract addresses

Example frontend integration:
```typescript
import { GugoVoteManager__factory } from './typechain-types';

const contract = GugoVoteManager__factory.connect(
  contractAddress,
  signer
);

// Purchase votes with ETH
const cost = await contract.getVoteCostETH(10);
await contract.purchaseVotesWithETH(10, { value: cost });
```

## 📈 Roadmap

Future enhancements:
- [ ] NFT staking for vote multipliers
- [ ] Tournament brackets and seasons
- [ ] Achievement system integration
- [ ] Governance token features
- [ ] Cross-chain bridge support

## 🐛 Troubleshooting

### Common Issues

**Compilation Errors**: 
- Ensure Node.js version compatibility
- Run `npm install` to update dependencies

**Deployment Failures**:
- Check private key format
- Verify sufficient ETH balance for gas
- Confirm network configuration

**Transaction Reverts**:
- Check minimum vote requirements
- Verify token approvals for GUGO payments
- Ensure match hasn't expired

## 📝 License

MIT License - see LICENSE file for details. 