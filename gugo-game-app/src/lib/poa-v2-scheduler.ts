/**
 * 🕐 POA v2 Computation Scheduler
 * 
 * Implements trigger-based initial computation + hourly batch processing
 * Optimized for database efficiency and real-time responsiveness
 */

import { supabase } from '../../lib/supabase';
import { computePOAv2ForNFT, computePOAv2Batch } from './poa-v2-computation-engine';
import { shouldUsePOAv2 } from './feature-flags';
import { getPOAv2Config } from './poa-v2-config';

export interface ComputationTrigger {
  nft_id: string;
  trigger_type: 'new_vote' | 'milestone' | 'fire_vote' | 'super_vote';
  vote_count: number;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

export interface BatchScheduleConfig {
  enabled: boolean;
  intervalMinutes: number; // 60 for hourly
  batchSize: number;
  maxProcessingTime: number; // Max time per batch in ms
  delayBetweenNFTs: number; // Delay between NFT computations
}

export interface TriggerConfig {
  enabled: boolean;
  voteMilestones: number[]; // [5, 10, 25, 50, 100]
  superVoteAlways: boolean;
  fireVoteAlways: boolean;
  highActivityThreshold: number; // Votes in last 24h
}

// Default configuration
const DEFAULT_CONFIG = {
  batch: {
    enabled: true,
    intervalMinutes: 60, // Hourly
    batchSize: 20, // Conservative batch size
    maxProcessingTime: 45000, // 45 seconds max per batch
    delayBetweenNFTs: 500, // 500ms between NFTs
  } as BatchScheduleConfig,
  
  trigger: {
    enabled: true,
    voteMilestones: [5, 10, 25, 50, 100], // Compute at these vote counts
    superVoteAlways: true, // Always compute for super votes
    fireVoteAlways: true, // Always compute for FIRE votes
    highActivityThreshold: 5, // 5+ votes in 24h = high activity
  } as TriggerConfig,
};

/**
 * Check if an NFT should trigger immediate POA v2 computation
 */
export async function shouldTriggerComputation(
  nftId: string, 
  voteType: 'regular' | 'super' | 'fire',
  newVoteCount: number
): Promise<{ shouldCompute: boolean; priority: 'high' | 'medium' | 'low'; reason: string }> {
  
  if (!shouldUsePOAv2()) {
    return { shouldCompute: false, priority: 'low', reason: 'POA v2 disabled' };
  }

  const config = DEFAULT_CONFIG.trigger;
  
  // Always compute for super votes and FIRE votes
  if (voteType === 'super' && config.superVoteAlways) {
    return { shouldCompute: true, priority: 'high', reason: 'Super vote received' };
  }
  
  if (voteType === 'fire' && config.fireVoteAlways) {
    return { shouldCompute: true, priority: 'high', reason: 'FIRE vote received' };
  }
  
  // Check vote milestones
  if (config.voteMilestones.includes(newVoteCount)) {
    return { 
      shouldCompute: true, 
      priority: newVoteCount >= 25 ? 'high' : 'medium', 
      reason: `Vote milestone: ${newVoteCount}` 
    };
  }
  
  // Check high activity (multiple votes in 24h)
  const isHighActivity = await checkHighActivity(nftId, config.highActivityThreshold);
  if (isHighActivity) {
    return { shouldCompute: true, priority: 'medium', reason: 'High activity NFT' };
  }
  
  return { shouldCompute: false, priority: 'low', reason: 'No trigger conditions met' };
}

/**
 * Process a computation trigger immediately
 */
export async function processTrigger(
  nftId: string, 
  triggerType: ComputationTrigger['trigger_type'],
  priority: ComputationTrigger['priority']
): Promise<{ success: boolean; result?: any; error?: string }> {
  
  const startTime = Date.now();
  
  try {
    console.log(`🎯 Processing ${priority} priority trigger for NFT ${nftId}: ${triggerType}`);
    
    // Compute POA v2 for the NFT
    const result = await computePOAv2ForNFT(nftId);
    
    const processingTime = Date.now() - startTime;
    
    if (result) {
      console.log(`✅ Trigger computation complete: ${result.poa_v2}/100 (${processingTime}ms)`);
      
      // Log the successful computation
      await logComputationActivity({
        nft_id: nftId,
        computation_type: 'trigger',
        trigger_type: triggerType,
        success: true,
        processing_time_ms: processingTime,
        poa_v2_result: result.poa_v2,
      });
      
      return { success: true, result };
    } else {
      console.log(`⏭️ Trigger computation skipped: insufficient data (${processingTime}ms)`);
      return { success: true, result: null };
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Trigger computation failed for ${nftId}:`, error);
    
    // Log the failed computation
    await logComputationActivity({
      nft_id: nftId,
      computation_type: 'trigger',
      trigger_type: triggerType,
      success: false,
      processing_time_ms: processingTime,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Run hourly batch computation for NFTs that need updates
 */
export async function runHourlyBatch(): Promise<{
  success: boolean;
  summary: any;
  error?: string;
}> {
  
  if (!shouldUsePOAv2()) {
    return { success: false, error: 'POA v2 system disabled', summary: null };
  }
  
  const config = DEFAULT_CONFIG.batch;
  const startTime = Date.now();
  
  try {
    console.log('🕐 Starting hourly POA v2 batch computation...');
    
    // Get NFTs that need computation or recalculation
    const candidates = await getHourlyBatchCandidates(config.batchSize);
    
    if (candidates.length === 0) {
      console.log('✅ No NFTs need computation in this batch');
      return { success: true, summary: { processed: 0, skipped: 0 } };
    }
    
    console.log(`📦 Processing ${candidates.length} NFTs in hourly batch...`);
    
    // Process the batch with conservative settings
    const summary = await computePOAv2Batch(candidates, {
      batchSize: Math.min(config.batchSize, 15), // Conservative batch size
      delayMs: config.delayBetweenNFTs,
      skipExisting: false, // Recalculate existing scores
    });
    
    const totalTime = Date.now() - startTime;
    
    // Log batch completion
    await logComputationActivity({
      computation_type: 'batch',
      batch_size: candidates.length,
      success: true,
      processing_time_ms: totalTime,
      successful_computations: summary.successful_computations,
      failed_computations: summary.failed_computations,
    });
    
    console.log(`✅ Hourly batch complete: ${summary.successful_computations}/${candidates.length} NFTs (${totalTime}ms)`);
    
    return { success: true, summary };
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ Hourly batch computation failed:', error);
    
    // Log batch failure
    await logComputationActivity({
      computation_type: 'batch',
      success: false,
      processing_time_ms: totalTime,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      summary: null
    };
  }
}

/**
 * Get NFTs that are candidates for hourly batch processing
 */
async function getHourlyBatchCandidates(limit: number): Promise<string[]> {
  try {
    // Priority 1: NFTs with votes but no POA v2 score
    const { data: newNFTs } = await supabase
      .from('nfts')
      .select('id')
      .is('poa_v2', null)
      .not('elo_mean', 'is', null)
      .gte('total_votes', 1)
      .order('total_votes', { ascending: false })
      .limit(Math.floor(limit * 0.7)); // 70% of batch for new computations
    
    // Priority 2: NFTs with old POA v2 scores (>24h old)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: oldNFTs } = await supabase
      .from('nfts')
      .select('id')
      .not('poa_v2', 'is', null)
      .lt('poa_v2_updated_at', twentyFourHoursAgo)
      .gte('total_votes', 5) // Only recalculate NFTs with decent vote counts
      .order('total_votes', { ascending: false })
      .limit(Math.floor(limit * 0.3)); // 30% of batch for recalculations
    
    const candidates = [
      ...(newNFTs?.map(nft => nft.id) || []),
      ...(oldNFTs?.map(nft => nft.id) || []),
    ];
    
    // Remove duplicates and limit to batch size
    const uniqueCandidates = [...new Set(candidates)].slice(0, limit);
    
    console.log(`📊 Batch candidates: ${newNFTs?.length || 0} new + ${oldNFTs?.length || 0} old = ${uniqueCandidates.length} total`);
    
    return uniqueCandidates;
    
  } catch (error) {
    console.error('Failed to get batch candidates:', error);
    return [];
  }
}

/**
 * Check if an NFT has high activity (multiple votes in 24h)
 */
async function checkHighActivity(nftId: string, threshold: number): Promise<boolean> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentVotes } = await supabase
      .from('votes')
      .select('id')
      .or(`nft_a_id.eq.${nftId},nft_b_id.eq.${nftId}`)
      .gte('created_at', twentyFourHoursAgo);
    
    return (recentVotes?.length || 0) >= threshold;
    
  } catch (error) {
    console.warn('Failed to check high activity:', error);
    return false;
  }
}

/**
 * Log computation activity for monitoring and analytics
 */
async function logComputationActivity(activity: {
  nft_id?: string;
  computation_type: 'trigger' | 'batch';
  trigger_type?: ComputationTrigger['trigger_type'];
  batch_size?: number;
  success: boolean;
  processing_time_ms: number;
  poa_v2_result?: number;
  successful_computations?: number;
  failed_computations?: number;
  error_message?: string;
}): Promise<void> {
  try {
    // For now, just console log. In production, this could go to a dedicated logging table
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...activity,
    };
    
    console.log('📋 Computation Activity:', JSON.stringify(logEntry, null, 2));
    
    // TODO: Implement database logging table for production monitoring
    
  } catch (error) {
    console.warn('Failed to log computation activity:', error);
  }
}

/**
 * Get current scheduler configuration
 */
export function getSchedulerConfig() {
  return {
    ...DEFAULT_CONFIG,
    status: {
      poaV2Enabled: shouldUsePOAv2(),
      nextBatchEstimate: getNextBatchTime(),
      systemHealth: 'healthy', // TODO: Implement health checks
    },
  };
}

/**
 * Get estimated time for next batch
 */
function getNextBatchTime(): string {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return nextHour.toISOString();
}

/**
 * Development helper: Simulate trigger conditions
 */
export async function simulateTrigger(nftId: string, triggerType: 'milestone' | 'super' | 'fire') {
  console.log(`🧪 Simulating ${triggerType} trigger for NFT ${nftId}...`);
  
  const priority = triggerType === 'milestone' ? 'medium' : 'high';
  return await processTrigger(nftId, triggerType === 'milestone' ? 'milestone' : `${triggerType}_vote`, priority);
}

