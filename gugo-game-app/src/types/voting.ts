// 🗳️ New Voting System Types
// Enhanced types for the sophisticated voting system

export type VoteType = 'same_coll' | 'cross_coll' | 'slider';

export interface NFT {
  id: string;
  name: string;
  image: string;
  collection_address: string;
  token_address: string;
  token_id: string;
  collection_name: string;
  current_elo: number;
  slider_average?: number;
  slider_count: number;
}

export interface MatchupPair {
  id?: string; // Optional for dynamic matchups
  nft1: NFT;
  nft2: NFT;
  vote_type: 'same_coll' | 'cross_coll';
  queueId?: string; // For queue cleanup after vote
}

export interface SliderVote {
  nft: NFT;
  vote_type: 'slider';
  queueId?: string; // For queue cleanup after vote
}

export type VotingSession = MatchupPair | SliderVote;

export interface Vote {
  id: string;
  user_id: string;
  vote_type_v2: VoteType;
  nft_a_id?: string;
  nft_b_id?: string;
  winner_id?: string;
  slider_value?: number;
  engagement_data: Record<string, unknown>;
  created_at: string;
}

export interface VoteSubmission {
  vote_type: VoteType;
  winner_id?: string;
  slider_value?: number;
  nft_a_id?: string;
  nft_b_id?: string;
  super_vote?: boolean; // Costs 5 votes, applies 2x Elo effect
  engagement_data?: Record<string, unknown>;
}

export interface EloUpdate {
  nft_a_id: string;
  nft_b_id: string;
  winner: 'a' | 'b';
  old_elo_a: number;
  old_elo_b: number;
  new_elo_a: number;
  new_elo_b: number;
}

export interface VoteResult {
  hash: string;
  voteId: string | null;
  isPrizeBreak: boolean;
  voteCount: number;
  insufficientVotes?: boolean;
  requiredVotes?: number;
}

export interface SliderUpdate {
  nft_id: string;
  old_average?: number;
  old_count: number;
  new_average: number;
  new_count: number;
  slider_value: number;
}

export interface VotingStats {
  total_votes: number;
  vote_streak: number;
  last_vote_at?: string;
  xp: number;
  taste_vector: Record<string, unknown>;
}