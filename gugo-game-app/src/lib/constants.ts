// Smart Contract Constants
export const GUGO_VOTE_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_VOTE_MANAGER_CONTRACT || '0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13';

// Smart Contract ABI - Complete voting and prize break functions
export const GUGO_VOTE_MANAGER_ABI = [
  // Voting functions
  {
    "inputs": [
      {"internalType": "bytes32", "name": "matchupId", "type": "bytes32"},
      {"internalType": "uint256", "name": "winnerTokenId", "type": "uint256"},
      {"internalType": "uint256", "name": "loserTokenId", "type": "uint256"}
    ],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "matchupId", "type": "bytes32"},
      {"internalType": "uint256", "name": "winnerTokenId", "type": "uint256"},
      {"internalType": "uint256", "name": "loserTokenId", "type": "uint256"}
    ],
    "name": "superVote", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Prize break functions
  {
    "inputs": [],
    "name": "claimPrizeBreak",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // View functions for prize break eligibility
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "users",
    "outputs": [
      {"internalType": "uint256", "name": "xp", "type": "uint256"},
      {"internalType": "uint256", "name": "totalVotes", "type": "uint256"},
      {"internalType": "uint256", "name": "winningVotes", "type": "uint256"},
      {"internalType": "uint256", "name": "streak", "type": "uint256"},
      {"internalType": "uint256", "name": "lastVoteTimestamp", "type": "uint256"},
      {"internalType": "uint256", "name": "pendingXP", "type": "uint256"},
      {"internalType": "uint256", "name": "votesRemaining", "type": "uint256"},
      {"internalType": "uint256", "name": "lastPrizeBreak", "type": "uint256"},
      {"internalType": "bool", "name": "isRegistered", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint8", "name": "rewardType", "type": "uint8"},
      {"indexed": false, "internalType": "uint256", "name": "xpAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "votesAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "gugoAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "totalXp", "type": "uint256"}
    ],
    "name": "PrizeBreakClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "voter", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "matchupId", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "winnerTokenId", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "loserTokenId", "type": "uint256"},
      {"indexed": false, "internalType": "bool", "name": "isSuperVote", "type": "bool"},
      {"indexed": false, "internalType": "uint256", "name": "xpValue", "type": "uint256"}
    ],
    "name": "VoteCast",
    "type": "event"
  }
] as const;

// Prize Break Reward Types (matching smart contract enum)
export enum RewardType {
  BASE_XP = 0,
  BIG_XP = 1, 
  XP_VOTES_10 = 2,
  XP_VOTES_5 = 3,
  VOTE_BONUS = 4,
  GUGO_TIER_1 = 5,
  GUGO_TIER_2 = 6,
  GUGO_TIER_3 = 7,
  GUGO_TIER_4 = 8,
  GUGO_TIER_5 = 9,
  GUGO_TIER_6 = 10,
  GUGO_TIER_7 = 11,
  GUGO_TIER_8 = 12,
  GUGO_TIER_9 = 13,
  WELCOME_LICKS = 14 // Special first-time player reward
}

// Prize Break Reward interface
export interface PrizeBreakReward {
  rewardType: RewardType;
  xpAmount: number;
  votesAmount: number;
  gugoAmount: number;
  licksAmount: number; // Daily Licks/votes reward
  timestamp?: number;
}

// API Endpoints
export const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
export const OPENSEA_API_BASE = 'https://api.opensea.io/api/v1';

// Collection IDs
export const BEARISH_COLLECTION_ID = 'bearish'; // CoinGecko collection ID