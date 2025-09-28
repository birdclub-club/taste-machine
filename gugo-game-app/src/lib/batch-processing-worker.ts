/**
 * Batch Processing Worker
 * 
 * Handles incremental, debounced POA score updates using the efficient pipeline
 */

import { supabase } from '../../lib/supabase';
import {
  updateEloBayes,
  updateRunningStats,
  normalizeSlider,
  updateReliability,
  computePOAFromStats,
  shouldPublishUpdate,
  getKFactor,
  updateEMA,
  addJitter,
  batchArray,
  type VoteEvent,
  type SliderEvent,
  type FireEvent,
  type NFTStats,
  type UserCalibration,
  type PublishedScore,
} from './efficient-poa-utils';
import { checkPublishGates } from './publish-gates-validator';

export class BatchProcessingWorker {
  private batchSize: number;
  private publishThreshold: number;
  private maxRetries: number;

  constructor(options: {
    batchSize?: number;
    publishThreshold?: number;
    maxRetries?: number;
  } = {}) {
    this.batchSize = options.batchSize || 500;
    this.publishThreshold = options.publishThreshold || 0.5;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Main processing loop - claims and processes a batch of dirty NFTs
   */
  async processBatch(): Promise<{
    success: boolean;
    processed: number;
    published: number;
    errors: string[];
    duration_ms: number;
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let published = 0;

    try {
      console.log(`🔄 Starting batch processing (batch size: ${this.batchSize})`);

      // 1. Claim a batch of dirty NFTs
      const { data: claimedNFTs, error: claimError } = await supabase.rpc(
        'claim_dirty_nfts',
        { limit_n: this.batchSize }
      );

      if (claimError) {
        errors.push(`Failed to claim dirty NFTs: ${claimError.message}`);
        return { success: false, processed: 0, published: 0, errors, duration_ms: Date.now() - startTime };
      }

      if (!claimedNFTs || claimedNFTs.length === 0) {
        console.log('📭 No dirty NFTs to process');
        return { success: true, processed: 0, published: 0, errors: [], duration_ms: Date.now() - startTime };
      }

      console.log(`📋 Claimed ${claimedNFTs.length} dirty NFTs for processing`);

      // 2. Process each NFT individually (with error isolation)
      for (const { nft_id } of claimedNFTs) {
        try {
          const result = await this.processOneNFT(nft_id);
          if (result.success) {
            processed++;
            if (result.published) published++;
          } else {
            errors.push(`NFT ${nft_id}: ${result.error}`);
          }

          // Add small jitter to smooth database load
          await new Promise(resolve => setTimeout(resolve, addJitter(5, 0.5)));

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`NFT ${nft_id}: ${errorMsg}`);
          console.error(`❌ Error processing NFT ${nft_id}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Batch complete: ${processed}/${claimedNFTs.length} processed, ${published} published (${duration}ms)`);

      return {
        success: errors.length < claimedNFTs.length / 2, // Success if < 50% errors
        processed,
        published,
        errors,
        duration_ms: duration,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Batch processing failed: ${errorMsg}`);
      console.error('❌ Batch processing error:', error);

      return {
        success: false,
        processed,
        published,
        errors,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Process a single NFT incrementally
   */
  private async processOneNFT(nft_id: string): Promise<{
    success: boolean;
    published: boolean;
    error?: string;
  }> {
    try {
      // 1. Get or create NFT stats
      const stats = await this.getNFTStats(nft_id);
      if (!stats) {
        return { success: false, published: false, error: 'Failed to get NFT stats' };
      }

      // 2. Process new events incrementally
      const updateResult = await this.processNewEvents(stats);
      if (!updateResult.success) {
        return { success: false, published: false, error: updateResult.error };
      }

      const updatedStats = updateResult.stats;

      // 3. Compute new POA score
      const poaResult = computePOAFromStats({
        elo_mean: updatedStats.elo_mean,
        elo_sigma: updatedStats.elo_sigma,
        slider_sum_w: updatedStats.slider_sum_w,
        slider_weight: updatedStats.slider_weight,
        fire_sum_w: updatedStats.fire_sum_w,
        avg_rater_rel: updatedStats.avg_rater_rel,
        total_votes: updatedStats.total_votes,
        total_sliders: updatedStats.total_sliders,
      });

      // 4. Update NFT stats in database
      await this.updateNFTStats(updatedStats);

      // 5. Conditionally publish to nft_scores
      const published = await this.conditionallyPublish(nft_id, poaResult);

      return { success: true, published };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, published: false, error: errorMsg };
    }
  }

  /**
   * Get or create NFT stats record
   */
  private async getNFTStats(nft_id: string): Promise<NFTStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_or_create_nft_stats', { _nft_id: nft_id });

      if (error) {
        console.error(`Failed to get NFT stats for ${nft_id}:`, error);
        return null;
      }

      return data;

    } catch (error) {
      console.error(`Error getting NFT stats for ${nft_id}:`, error);
      return null;
    }
  }

  /**
   * Process new events for an NFT incrementally
   */
  private async processNewEvents(stats: NFTStats): Promise<{
    success: boolean;
    stats: NFTStats;
    error?: string;
  }> {
    try {
      let updatedStats = { ...stats };

      // Process new votes
      const newVotes = await this.getNewVotes(parseInt(stats.nft_id), stats.last_processed_vote_id);
      for (const vote of newVotes) {
        updatedStats = await this.processVoteEvent(updatedStats, vote);
      }

      // Process new sliders
      const newSliders = await this.getNewSliders(parseInt(stats.nft_id), stats.last_processed_slider_id);
      for (const slider of newSliders) {
        updatedStats = await this.processSliderEvent(updatedStats, slider);
      }

      // Process new FIRE votes
      const newFires = await this.getNewFires(parseInt(stats.nft_id), stats.last_processed_fire_id);
      for (const fire of newFires) {
        updatedStats = await this.processFireEvent(updatedStats, fire);
      }

      return { success: true, stats: updatedStats };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, stats, error: errorMsg };
    }
  }

  /**
   * Get new vote events for an NFT
   */
  private async getNewVotes(nft_id: number, lastProcessedId: number): Promise<VoteEvent[]> {
    const { data: votesA } = await supabase
      .from('votes_events')
      .select('*')
      .eq('nft_a_id', nft_id)
      .gt('id', lastProcessedId)
      .order('id');

    const { data: votesB } = await supabase
      .from('votes_events')
      .select('*')
      .eq('nft_b_id', nft_id)
      .gt('id', lastProcessedId)
      .order('id');

    // Combine and deduplicate
    const allVotes = [...(votesA || []), ...(votesB || [])];
    const uniqueVotes = allVotes.filter((vote, index, arr) => 
      arr.findIndex(v => v.id === vote.id) === index
    );

    return uniqueVotes.sort((a, b) => a.id - b.id);
  }

  /**
   * Get new slider events for an NFT
   */
  private async getNewSliders(nft_id: number, lastProcessedId: number): Promise<SliderEvent[]> {
    const { data } = await supabase
      .from('sliders_events')
      .select('*')
      .eq('nft_id', nft_id)
      .gt('id', lastProcessedId)
      .order('id');

    return data || [];
  }

  /**
   * Get new FIRE events for an NFT
   */
  private async getNewFires(nft_id: number, lastProcessedId: number): Promise<FireEvent[]> {
    const { data } = await supabase
      .from('fires_events')
      .select('*')
      .eq('nft_id', nft_id)
      .gt('id', lastProcessedId)
      .order('id');

    return data || [];
  }

  /**
   * Process a single vote event
   */
  private async processVoteEvent(stats: NFTStats, vote: VoteEvent): Promise<NFTStats> {
    const k = getKFactor(vote.vote_type);
    const isNFTA = vote.nft_a_id === stats.nft_id;
    
    // Determine if this NFT won
    const won = vote.winner_id === stats.nft_id;
    const S = won ? 1 : 0;
    
    // Get opponent's Elo
    const opponentElo = isNFTA ? vote.elo_pre_b : vote.elo_pre_a;
    
    // Update Elo using Bayesian approach
    const eloUpdate = updateEloBayes(stats.elo_mean, stats.elo_sigma, opponentElo, S, k);
    
    // Update voter reliability
    await this.updateVoterReliability(vote.voter_id, won);
    
    return {
      ...stats,
      elo_mean: eloUpdate.mean,
      elo_sigma: eloUpdate.sigma,
      total_votes: stats.total_votes + 1,
      last_processed_vote_id: Math.max(stats.last_processed_vote_id, vote.id),
    };
  }

  /**
   * Process a single slider event
   */
  private async processSliderEvent(stats: NFTStats, slider: SliderEvent): Promise<NFTStats> {
    // Get user calibration
    const userCalibration = await this.getUserCalibration(slider.voter_id);
    if (!userCalibration) return stats;

    // Normalize the slider score
    const normalizedScore = normalizeSlider(
      slider.raw_score,
      userCalibration.slider_mean,
      userCalibration.slider_std
    );

    // Update user calibration
    await this.updateUserSliderCalibration(slider.voter_id, slider.raw_score);

    // Update NFT aggregates
    const weight = userCalibration.reliability_score;
    const newSliderSumW = stats.slider_sum_w + (normalizedScore * weight);
    const newSliderWeight = stats.slider_weight + weight;
    const newAvgRaterRel = updateEMA(stats.avg_rater_rel, weight);

    return {
      ...stats,
      slider_sum_w: newSliderSumW,
      slider_weight: newSliderWeight,
      avg_rater_rel: newAvgRaterRel,
      total_sliders: stats.total_sliders + 1,
      last_processed_slider_id: Math.max(stats.last_processed_slider_id, slider.id),
    };
  }

  /**
   * Process a single FIRE event
   */
  private async processFireEvent(stats: NFTStats, fire: FireEvent): Promise<NFTStats> {
    // Get user reliability for weighting
    const userCalibration = await this.getUserCalibration(fire.voter_id);
    const weight = userCalibration?.reliability_score || 1.0;

    return {
      ...stats,
      fire_sum_w: stats.fire_sum_w + weight,
      total_fires: stats.total_fires + 1,
      last_processed_fire_id: Math.max(stats.last_processed_fire_id, fire.id),
    };
  }

  /**
   * Get user calibration data
   */
  private async getUserCalibration(user_id: string): Promise<UserCalibration | null> {
    const { data } = await supabase
      .from('users')
      .select('id, slider_mean, slider_std, slider_m2, slider_count, reliability_score, reliability_count')
      .eq('id', user_id)
      .single();

    return data;
  }

  /**
   * Update user slider calibration using Welford algorithm
   */
  private async updateUserSliderCalibration(user_id: string, raw_score: number): Promise<void> {
    const user = await this.getUserCalibration(user_id);
    if (!user) return;

    const updated = updateRunningStats(
      user.slider_mean,
      user.slider_m2,
      user.slider_count,
      raw_score
    );

    await supabase
      .from('users')
      .update({
        slider_mean: updated.mean,
        slider_std: updated.std,
        slider_m2: updated.M2,
        slider_count: updated.count,
      })
      .eq('id', user_id);
  }

  /**
   * Update voter reliability based on alignment with consensus
   */
  private async updateVoterReliability(voter_id: string, aligned: boolean): Promise<void> {
    const user = await this.getUserCalibration(voter_id);
    if (!user) return;

    const newReliability = updateReliability(user.reliability_score, aligned);

    await supabase
      .from('users')
      .update({
        reliability_score: newReliability,
        reliability_count: user.reliability_count + 1,
        reliability_updated_at: new Date().toISOString(),
      })
      .eq('id', voter_id);
  }

  /**
   * Update NFT stats in database
   */
  private async updateNFTStats(stats: NFTStats): Promise<void> {
    await supabase
      .from('nft_stats')
      .upsert({
        nft_id: stats.nft_id,
        elo_mean: stats.elo_mean,
        elo_sigma: stats.elo_sigma,
        last_processed_vote_id: stats.last_processed_vote_id,
        last_processed_slider_id: stats.last_processed_slider_id,
        last_processed_fire_id: stats.last_processed_fire_id,
        slider_sum_w: stats.slider_sum_w,
        slider_weight: stats.slider_weight,
        fire_sum_w: stats.fire_sum_w,
        avg_rater_rel: stats.avg_rater_rel,
        total_votes: stats.total_votes,
        total_sliders: stats.total_sliders,
        total_fires: stats.total_fires,
        updated_at: new Date().toISOString(),
      });
  }

  /**
   * Conditionally publish score to nft_scores if change is significant
   */
  private async conditionallyPublish(
    nft_id: string,
    poaResult: ReturnType<typeof computePOAFromStats>
  ): Promise<boolean> {
    try {
      // Check publish gates
      const gateResult = await checkPublishGates(
        nft_id,
        poaResult.poa_v2,
        poaResult.confidence
      );

      if (!gateResult.should_publish) {
        if (!gateResult.meets_minimum_requirements) {
          console.log(`📋 NFT ${nft_id} awaiting data: ${gateResult.reason}`);
          console.log(`   Progress: ${gateResult.progress.h2h}/${gateResult.progress.h2h + gateResult.progress.needed.h2h} H2H, ${gateResult.progress.sliders}/${gateResult.progress.sliders + gateResult.progress.needed.sliders} sliders`);
        } else {
          console.log(`⏳ NFT ${nft_id} not publishing: ${gateResult.reason}`);
        }
        return false;
      }

      // Publish the score
      await supabase
        .from('nft_scores')
        .upsert({
          nft_id,
          poa_v2: poaResult.poa_v2,
          elo_mean: poaResult.elo_component / poaResult.reliability_factor,
          elo_sigma: 0, // Will be populated from nft_stats if needed
          confidence: poaResult.confidence,
          provisional: poaResult.provisional,
          elo_component: poaResult.elo_component,
          slider_component: poaResult.slider_component,
          fire_component: poaResult.fire_component,
          reliability_factor: poaResult.reliability_factor,
          updated_at: new Date().toISOString(),
        });

      console.log(`🎯 Published POA for NFT ${nft_id}: ${poaResult.poa_v2} (confidence: ${poaResult.confidence}%) - ${gateResult.reason}`);
      return true;

    } catch (error) {
      console.error(`Failed to publish score for NFT ${nft_id}:`, error);
      return false;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    success: boolean;
    data?: {
      pipeline_status: any;
      recent_batches: number;
      avg_processing_time: number;
    };
    error?: string;
  }> {
    try {
      const { data: pipelineStatus, error } = await supabase.rpc('get_pipeline_status');

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          pipeline_status: pipelineStatus[0],
          recent_batches: 0, // Could be implemented with a processing_log table
          avg_processing_time: 0, // Could be tracked with metrics
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }


}
