/**
 * 🗳️ POA v2 Vote Processing Service
 * 
 * Handles all vote ingestion for the new Bayesian POA system:
 * - Bayesian Elo updates (Glicko-lite)
 * - Per-user slider normalization
 * - Reliability scoring
 * - POA v2 computation
 */

import { supabase } from '../../lib/supabase';
import { 
  updateEloBayesian, 
  updateUserStats, 
  normalizeSliderValue, 
  updateReliabilityScore, 
  calculateFireComponent, 
  computePOAv2,
  logPOAv2Computation,
  UserStats,
  POAv2Result 
} from './poa-v2-utils';
import { shouldUsePOAv2, logFeatureFlags } from './feature-flags';
import { getPOAv2Config } from './poa-v2-config';

export interface VoteData {
  nft_a_id: string;
  nft_b_id: string;
  winner: 'a' | 'b' | 'no';
  user_wallet: string;
  vote_type: 'regular' | 'super';
  slider_value?: number; // For slider votes
  is_fire_vote?: boolean;
}

export interface NFTData {
  id: string;
  name: string;
  collection_name: string;
  elo_mean: number;
  elo_sigma: number;
  total_votes: number;
  wins: number;
  losses: number;
  poa_v2?: number;
  poa_v2_confidence?: number;
}

export interface ProcessVoteResult {
  success: boolean;
  nft_a_updated: Partial<NFTData>;
  nft_b_updated: Partial<NFTData>;
  user_updated: Partial<UserStats>;
  poa_v2_computed: boolean;
  error?: string;
}

/**
 * Main vote processing function - handles all POA v2 updates
 */
export async function processVoteForPOAv2(voteData: VoteData): Promise<ProcessVoteResult> {
  const config = getPOAv2Config();
  
  if (!config.enabled) {
    return {
      success: false,
      nft_a_updated: {},
      nft_b_updated: {},
      user_updated: {},
      poa_v2_computed: false,
      error: 'POA v2 system is disabled'
    };
  }
  
  try {
    if (config.debugLogging) {
      console.log('🗳️ Processing vote for POA v2:', voteData);
      logFeatureFlags();
    }
    
    // Step 1: Get current NFT data
    const { data: nfts, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, elo_sigma, total_votes, wins, losses, poa_v2, poa_v2_confidence')
      .in('id', [voteData.nft_a_id, voteData.nft_b_id]);
    
    if (nftError || !nfts || nfts.length !== 2) {
      throw new Error(`Failed to fetch NFT data: ${nftError?.message}`);
    }
    
    const nftA = nfts.find(n => n.id === voteData.nft_a_id) as NFTData;
    const nftB = nfts.find(n => n.id === voteData.nft_b_id) as NFTData;
    
    if (!nftA || !nftB) {
      throw new Error('NFT data not found');
    }
    
    // Step 2: Get current user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, slider_mean, slider_std, slider_count, slider_m2, reliability_score, reliability_count')
      .eq('wallet_address', voteData.user_wallet)
      .single();
    
    if (userError || !userData) {
      throw new Error(`Failed to fetch user data: ${userError?.message}`);
    }
    
    const currentUserStats: UserStats = {
      slider_mean: userData.slider_mean || config.user.defaultSliderMean,
      slider_std: userData.slider_std || config.user.defaultSliderStd,
      slider_count: userData.slider_count || 0,
      reliability_score: userData.reliability_score || config.user.defaultReliability,
      reliability_count: userData.reliability_count || 0,
    };
    
    let result: ProcessVoteResult = {
      success: true,
      nft_a_updated: {},
      nft_b_updated: {},
      user_updated: currentUserStats,
      poa_v2_computed: false,
    };
    
    // Step 3: Process head-to-head vote (if not 'no' vote)
    if (voteData.winner !== 'no') {
      const winnerNFT = voteData.winner === 'a' ? nftA : nftB;
      const loserNFT = voteData.winner === 'a' ? nftB : nftA;
      const isSuperVote = voteData.vote_type === 'super';
      
      // Update Bayesian Elo for both NFTs
      const winnerEloUpdate = updateEloBayesian(
        winnerNFT.elo_mean,
        winnerNFT.elo_sigma,
        loserNFT.elo_mean,
        1, // winner score
        isSuperVote
      );
      
      const loserEloUpdate = updateEloBayesian(
        loserNFT.elo_mean,
        loserNFT.elo_sigma,
        winnerNFT.elo_mean,
        0, // loser score
        isSuperVote
      );
      
      // Update vote counts
      const voteWeight = isSuperVote ? 5 : 1;
      
      if (voteData.winner === 'a') {
        result.nft_a_updated = {
          elo_mean: winnerEloUpdate.mean,
          elo_sigma: winnerEloUpdate.sigma,
          wins: nftA.wins + voteWeight,
          total_votes: nftA.total_votes + voteWeight,
        };
        result.nft_b_updated = {
          elo_mean: loserEloUpdate.mean,
          elo_sigma: loserEloUpdate.sigma,
          losses: nftB.losses + voteWeight,
          total_votes: nftB.total_votes + voteWeight,
        };
      } else {
        result.nft_a_updated = {
          elo_mean: loserEloUpdate.mean,
          elo_sigma: loserEloUpdate.sigma,
          losses: nftA.losses + voteWeight,
          total_votes: nftA.total_votes + voteWeight,
        };
        result.nft_b_updated = {
          elo_mean: winnerEloUpdate.mean,
          elo_sigma: winnerEloUpdate.sigma,
          wins: nftB.wins + voteWeight,
          total_votes: nftB.total_votes + voteWeight,
        };
      }
      
      // Update user reliability based on consensus alignment
      // For now, we'll use a simple heuristic: if the winner had higher Elo, user aligned with consensus
      const expectedWinner = winnerNFT.elo_mean > loserNFT.elo_mean;
      const userAligned = expectedWinner;
      const matchDifficulty = Math.abs(winnerNFT.elo_mean - loserNFT.elo_mean) / 400; // 0-1 scale
      
      result.user_updated.reliability_score = updateReliabilityScore(
        currentUserStats.reliability_score,
        userAligned,
        matchDifficulty
      );
      result.user_updated.reliability_count = currentUserStats.reliability_count + 1;
      
      if (config.debugLogging) {
        console.log('🎯 Elo updates:', {
          winner: voteData.winner,
          nftA: `${nftA.elo_mean} → ${result.nft_a_updated.elo_mean}`,
          nftB: `${nftB.elo_mean} → ${result.nft_b_updated.elo_mean}`,
          reliability: `${currentUserStats.reliability_score} → ${result.user_updated.reliability_score}`,
        });
      }
    }
    
    // Step 4: Process slider vote (if provided)
    if (voteData.slider_value !== undefined) {
      // Update user slider statistics
      result.user_updated = updateUserStats(result.user_updated as UserStats, voteData.slider_value);
      
      if (config.debugLogging) {
        console.log('📊 Slider stats updated:', {
          rawValue: voteData.slider_value,
          newMean: result.user_updated.slider_mean,
          newStd: result.user_updated.slider_std,
          count: result.user_updated.slider_count,
        });
      }
    }
    
    // Step 5: Compute POA v2 for affected NFTs (if they have enough data)
    const shouldComputePOA = (nft: NFTData, updates: Partial<NFTData>) => {
      const totalVotes = (updates.total_votes ?? nft.total_votes) || 0;
      return totalVotes >= config.thresholds.minVotesForPOAv2;
    };
    
    if (shouldComputePOA(nftA, result.nft_a_updated)) {
      const poaResult = await computePOAv2ForNFT(nftA.id, result.nft_a_updated);
      if (poaResult) {
        result.nft_a_updated.poa_v2 = poaResult.poa_v2;
        result.nft_a_updated.poa_v2_confidence = poaResult.components.confidence;
        result.poa_v2_computed = true;
      }
    }
    
    if (shouldComputePOA(nftB, result.nft_b_updated)) {
      const poaResult = await computePOAv2ForNFT(nftB.id, result.nft_b_updated);
      if (poaResult) {
        result.nft_b_updated.poa_v2 = poaResult.poa_v2;
        result.nft_b_updated.poa_v2_confidence = poaResult.components.confidence;
        result.poa_v2_computed = true;
      }
    }
    
    // Step 6: Save all updates to database
    await saveVoteUpdates(voteData, result, userData.id);
    
    if (config.debugLogging) {
      console.log('✅ POA v2 vote processing complete:', {
        nftAUpdated: Object.keys(result.nft_a_updated).length > 0,
        nftBUpdated: Object.keys(result.nft_b_updated).length > 0,
        userUpdated: Object.keys(result.user_updated).length > 0,
        poaComputed: result.poa_v2_computed,
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ POA v2 vote processing failed:', error);
    return {
      success: false,
      nft_a_updated: {},
      nft_b_updated: {},
      user_updated: {},
      poa_v2_computed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Compute POA v2 score for a specific NFT
 */
async function computePOAv2ForNFT(nftId: string, updates: Partial<NFTData> = {}): Promise<POAv2Result | null> {
  try {
    // Get comprehensive NFT data including FIRE votes and slider data
    const { data: nftData, error: nftError } = await supabase
      .from('nfts')
      .select(`
        id, name, collection_name, elo_mean, elo_sigma, total_votes, wins, losses,
        slider_average, slider_count
      `)
      .eq('id', nftId)
      .single();
    
    if (nftError || !nftData) {
      throw new Error(`Failed to fetch NFT data for POA v2: ${nftError?.message}`);
    }
    
    // Get FIRE vote count
    const { data: fireData, error: fireError } = await supabase
      .from('favorites')
      .select('id')
      .eq('nft_id', nftId)
      .eq('vote_type', 'fire');
    
    const fireCount = fireData?.length || 0;
    
    // Get reliability-weighted FIRE count (simplified for now)
    const reliabilityAdjustedFireCount = fireCount; // TODO: Weight by user reliability
    
    // Use updated values if provided
    const eloMean = updates.elo_mean ?? nftData.elo_mean;
    const eloSigma = updates.elo_sigma ?? nftData.elo_sigma;
    const normalizedSlider = nftData.slider_average || 50; // TODO: Use normalized slider values
    const fireComponent = calculateFireComponent(reliabilityAdjustedFireCount);
    const avgReliability = 1.0; // TODO: Calculate actual average reliability of voters
    
    const poaResult = computePOAv2(eloMean, eloSigma, normalizedSlider, fireComponent, avgReliability);
    
    logPOAv2Computation(poaResult, nftId);
    
    return poaResult;
    
  } catch (error) {
    console.error(`❌ Failed to compute POA v2 for NFT ${nftId}:`, error);
    return null;
  }
}

/**
 * Save all vote processing updates to the database
 */
async function saveVoteUpdates(
  voteData: VoteData, 
  result: ProcessVoteResult, 
  userId: string
): Promise<void> {
  const updates = [];
  
  // Update NFT A
  if (Object.keys(result.nft_a_updated).length > 0) {
    const updateData = {
      ...result.nft_a_updated,
      poa_v2_updated_at: new Date().toISOString(),
    };
    
    updates.push(
      supabase
        .from('nfts')
        .update(updateData)
        .eq('id', voteData.nft_a_id)
    );
  }
  
  // Update NFT B
  if (Object.keys(result.nft_b_updated).length > 0) {
    const updateData = {
      ...result.nft_b_updated,
      poa_v2_updated_at: new Date().toISOString(),
    };
    
    updates.push(
      supabase
        .from('nfts')
        .update(updateData)
        .eq('id', voteData.nft_b_id)
    );
  }
  
  // Update User
  if (Object.keys(result.user_updated).length > 0) {
    const updateData = {
      ...result.user_updated,
      reliability_updated_at: new Date().toISOString(),
    };
    
    updates.push(
      supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
    );
  }
  
  // Execute all updates
  if (updates.length > 0) {
    const results = await Promise.all(updates);
    
    for (const { error } of results) {
      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    }
  }
}

/**
 * Development helper: Process a test vote
 */
export async function processTestVote(): Promise<ProcessVoteResult> {
  const testVote: VoteData = {
    nft_a_id: '00000000-0000-0000-0000-000000000001', // Replace with actual NFT ID
    nft_b_id: '00000000-0000-0000-0000-000000000002', // Replace with actual NFT ID
    winner: 'a',
    user_wallet: '0x0000000000000000000000000000000000000000', // Replace with actual wallet
    vote_type: 'regular',
    slider_value: 75,
    is_fire_vote: false,
  };
  
  return processVoteForPOAv2(testVote);
}
