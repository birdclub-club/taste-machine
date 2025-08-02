// Smart Contract Constants
export const GUGO_VOTE_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_GUGO_CONTRACT || '0x0000000000000000000000000000000000000000';

// Smart Contract ABI - Basic voting functions
export const GUGO_VOTE_MANAGER_ABI = [
  {
    "inputs": [{"internalType": "string", "name": "winnerId", "type": "string"}],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "winnerId", "type": "string"}],
    "name": "superVote", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// API Endpoints
export const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
export const OPENSEA_API_BASE = 'https://api.opensea.io/api/v1';

// Collection IDs
export const BEARISH_COLLECTION_ID = 'bearish'; // CoinGecko collection ID