/**
 * 🔗 POA v2 Integration Hook
 * 
 * Integrates POA v2 processing with the existing voting system.
 * Runs in parallel with the current system for safe A/B testing.
 */

import { useCallback } from 'react';
import { processVoteForPOAv2, VoteData } from '../lib/poa-v2-vote-processor';
import { shouldUsePOAv2 } from '../lib/feature-flags';
import { getPOAv2Config } from '../lib/poa-v2-config';
import type { VoteSubmission } from '@/types/voting';

export interface POAv2IntegrationResult {
  processed: boolean;
  success: boolean;
  error?: string;
  nftsUpdated: number;
  poaComputed: boolean;
}

/**
 * Hook for integrating POA v2 processing with existing votes
 */
export function usePOAv2Integration() {
  /**
   * Process a vote through the POA v2 system (parallel to existing system)
   */
  const processPOAv2Vote = useCallback(async (
    voteData: VoteSubmission,
    userWallet: string
  ): Promise<POAv2IntegrationResult> => {
    const config = getPOAv2Config();
    
    // Check if POA v2 is enabled
    if (!shouldUsePOAv2()) {
      return {
        processed: false,
        success: true,
        nftsUpdated: 0,
        poaComputed: false,
      };
    }
    
    try {
      if (config.debugLogging) {
        console.log('🔗 POA v2 Integration: Processing vote in parallel...');
      }
      
      // Convert VoteSubmission to POA v2 VoteData format
      const poaVoteData: VoteData = {
        nft_a_id: voteData.nft_a_id || '',
        nft_b_id: voteData.nft_b_id || '',
        winner: determineWinner(voteData),
        user_wallet: userWallet,
        vote_type: voteData.super_vote ? 'super' : 'regular',
        slider_value: voteData.slider_value,
        is_fire_vote: Boolean(voteData.engagement_data?.fire_vote) || false,
      };
      
      // Skip if missing required data
      if (!poaVoteData.nft_a_id || !userWallet) {
        if (config.debugLogging) {
          console.log('🔗 POA v2 Integration: Skipping - missing required data');
        }
        return {
          processed: false,
          success: true,
          nftsUpdated: 0,
          poaComputed: false,
        };
      }
      
      // Process through POA v2 system
      const result = await processVoteForPOAv2(poaVoteData);
      
      const nftsUpdated = 
        (Object.keys(result.nft_a_updated).length > 0 ? 1 : 0) +
        (Object.keys(result.nft_b_updated).length > 0 ? 1 : 0);
      
      if (config.debugLogging) {
        console.log('🔗 POA v2 Integration: Processing complete', {
          success: result.success,
          nftsUpdated,
          poaComputed: result.poa_v2_computed,
          error: result.error,
        });
      }
      
      return {
        processed: true,
        success: result.success,
        error: result.error,
        nftsUpdated,
        poaComputed: result.poa_v2_computed,
      };
      
    } catch (error) {
      console.error('❌ POA v2 Integration failed:', error);
      
      return {
        processed: true,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        nftsUpdated: 0,
        poaComputed: false,
      };
    }
  }, []);
  
  /**
   * Process multiple votes in batch (for batched voting system)
   */
  const processPOAv2Batch = useCallback(async (
    votes: Array<{ voteData: VoteSubmission; userWallet: string }>
  ): Promise<POAv2IntegrationResult[]> => {
    if (!shouldUsePOAv2()) {
      return votes.map(() => ({
        processed: false,
        success: true,
        nftsUpdated: 0,
        poaComputed: false,
      }));
    }
    
    const config = getPOAv2Config();
    
    if (config.debugLogging) {
      console.log(`🔗 POA v2 Integration: Processing batch of ${votes.length} votes...`);
    }
    
    // Process votes in parallel (but limit concurrency to avoid overwhelming the system)
    const batchSize = 3; // Process 3 votes at a time
    const results: POAv2IntegrationResult[] = [];
    
    for (let i = 0; i < votes.length; i += batchSize) {
      const batch = votes.slice(i, i + batchSize);
      const batchPromises = batch.map(({ voteData, userWallet }) => 
        processPOAv2Vote(voteData, userWallet)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be gentle on the database
      if (i + batchSize < votes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (config.debugLogging) {
      const summary = results.reduce((acc, result) => ({
        processed: acc.processed + (result.processed ? 1 : 0),
        successful: acc.successful + (result.success ? 1 : 0),
        nftsUpdated: acc.nftsUpdated + result.nftsUpdated,
        poaComputed: acc.poaComputed + (result.poaComputed ? 1 : 0),
      }), { processed: 0, successful: 0, nftsUpdated: 0, poaComputed: 0 });
      
      console.log('🔗 POA v2 Integration: Batch processing complete', summary);
    }
    
    return results;
  }, [processPOAv2Vote]);
  
  /**
   * Get POA v2 system status for debugging
   */
  const getPOAv2Status = useCallback(() => {
    return {
      enabled: shouldUsePOAv2(),
      config: getPOAv2Config(),
    };
  }, []);
  
  return {
    processPOAv2Vote,
    processPOAv2Batch,
    getPOAv2Status,
    isEnabled: shouldUsePOAv2(),
  };
}

/**
 * Helper function to determine winner from VoteSubmission
 */
function determineWinner(voteData: VoteSubmission): 'a' | 'b' | 'no' {
  // Check for NO vote
  if (voteData.engagement_data?.no_vote || !voteData.winner_id) {
    return 'no';
  }
  
  // Determine if winner is NFT A or B
  if (voteData.winner_id === voteData.nft_a_id) {
    return 'a';
  } else if (voteData.winner_id === voteData.nft_b_id) {
    return 'b';
  }
  
  // Fallback to 'no' if we can't determine
  return 'no';
}

/**
 * Development helper: Test POA v2 integration
 */
export function usePOAv2IntegrationTest() {
  const { processPOAv2Vote } = usePOAv2Integration();
  
  const runTest = useCallback(async () => {
    const testVote: VoteSubmission = {
      vote_type: 'same_coll',
      nft_a_id: '00000000-0000-0000-0000-000000000001', // Replace with real ID
      nft_b_id: '00000000-0000-0000-0000-000000000002', // Replace with real ID
      winner_id: '00000000-0000-0000-0000-000000000001',
      slider_value: 75,
      super_vote: false,
      engagement_data: {
        test_vote: true,
      },
    };
    
    const testWallet = '0x0000000000000000000000000000000000000000'; // Replace with real wallet
    
    return await processPOAv2Vote(testVote, testWallet);
  }, [processPOAv2Vote]);
  
  return { runTest };
}

