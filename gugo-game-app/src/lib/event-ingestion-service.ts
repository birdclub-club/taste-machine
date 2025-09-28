/**
 * Event Ingestion Service
 * 
 * Handles ingesting votes, sliders, and FIRE events into the efficient pipeline
 */

import { supabase } from '../../lib/supabase';
import type { VoteEvent, SliderEvent, FireEvent } from './efficient-poa-utils';

export class EventIngestionService {
  /**
   * Ingest a vote event into the pipeline
   */
  static async ingestVote(params: {
    voter_id: string;
    nft_a_id: string;
    nft_b_id: string;
    winner_id: string;
    elo_pre_a: number;
    elo_pre_b: number;
    vote_type?: 'normal' | 'super';
  }): Promise<{ success: boolean; event_id?: number; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('votes_events')
        .insert({
          voter_id: params.voter_id,
          nft_a_id: params.nft_a_id,
          nft_b_id: params.nft_b_id,
          winner_id: params.winner_id,
          elo_pre_a: params.elo_pre_a,
          elo_pre_b: params.elo_pre_b,
          vote_type: params.vote_type || 'normal',
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to ingest vote event:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Vote event ingested: ${data.id} (${params.voter_id} voted ${params.winner_id} in ${params.nft_a_id} vs ${params.nft_b_id})`);
      return { success: true, event_id: data.id };

    } catch (error) {
      console.error('Vote ingestion error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Ingest a slider event into the pipeline
   */
  static async ingestSlider(params: {
    voter_id: string;
    nft_id: string;
    raw_score: number;
  }): Promise<{ success: boolean; event_id?: number; error?: string }> {
    try {
      // Validate raw score range
      if (params.raw_score < 0 || params.raw_score > 100) {
        return { 
          success: false, 
          error: `Invalid raw_score: ${params.raw_score}. Must be between 0 and 100.` 
        };
      }

      const { data, error } = await supabase
        .from('sliders_events')
        .insert({
          voter_id: params.voter_id,
          nft_id: params.nft_id,
          raw_score: params.raw_score,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to ingest slider event:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Slider event ingested: ${data.id} (${params.voter_id} rated ${params.nft_id} as ${params.raw_score})`);
      return { success: true, event_id: data.id };

    } catch (error) {
      console.error('Slider ingestion error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Ingest a FIRE event into the pipeline
   */
  static async ingestFire(params: {
    voter_id: string;
    nft_id: string;
  }): Promise<{ success: boolean; event_id?: number; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('fires_events')
        .insert({
          voter_id: params.voter_id,
          nft_id: params.nft_id,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to ingest FIRE event:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ FIRE event ingested: ${data.id} (${params.voter_id} fired ${params.nft_id})`);
      return { success: true, event_id: data.id };

    } catch (error) {
      console.error('FIRE ingestion error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Batch ingest multiple events (more efficient for bulk operations)
   */
  static async ingestBatch(events: {
    votes?: Array<Omit<VoteEvent, 'id' | 'created_at'>>;
    sliders?: Array<Omit<SliderEvent, 'id' | 'created_at'>>;
    fires?: Array<Omit<FireEvent, 'id' | 'created_at'>>;
  }): Promise<{
    success: boolean;
    results: {
      votes_inserted: number;
      sliders_inserted: number;
      fires_inserted: number;
    };
    errors: string[];
  }> {
    const results = {
      votes_inserted: 0,
      sliders_inserted: 0,
      fires_inserted: 0,
    };
    const errors: string[] = [];

    try {
      // Batch insert votes
      if (events.votes && events.votes.length > 0) {
        const { data, error } = await supabase
          .from('votes_events')
          .insert(events.votes)
          .select('id');

        if (error) {
          errors.push(`Votes batch insert failed: ${error.message}`);
        } else {
          results.votes_inserted = data?.length || 0;
          console.log(`✅ Batch inserted ${results.votes_inserted} vote events`);
        }
      }

      // Batch insert sliders
      if (events.sliders && events.sliders.length > 0) {
        const { data, error } = await supabase
          .from('sliders_events')
          .insert(events.sliders)
          .select('id');

        if (error) {
          errors.push(`Sliders batch insert failed: ${error.message}`);
        } else {
          results.sliders_inserted = data?.length || 0;
          console.log(`✅ Batch inserted ${results.sliders_inserted} slider events`);
        }
      }

      // Batch insert fires
      if (events.fires && events.fires.length > 0) {
        const { data, error } = await supabase
          .from('fires_events')
          .insert(events.fires)
          .select('id');

        if (error) {
          errors.push(`FIRE batch insert failed: ${error.message}`);
        } else {
          results.fires_inserted = data?.length || 0;
          console.log(`✅ Batch inserted ${results.fires_inserted} FIRE events`);
        }
      }

      return {
        success: errors.length === 0,
        results,
        errors,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Batch ingestion error:', error);
      return {
        success: false,
        results,
        errors: [...errors, errorMsg],
      };
    }
  }

  /**
   * Get pipeline status and health metrics
   */
  static async getPipelineStatus(): Promise<{
    success: boolean;
    data?: {
      dirty_nfts_count: number;
      high_priority_count: number;
      avg_age_minutes: number;
      oldest_dirty_minutes: number;
      total_nft_stats: number;
      total_published_scores: number;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_pipeline_status');

      if (error) {
        console.error('Failed to get pipeline status:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data[0] };

    } catch (error) {
      console.error('Pipeline status error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Manually trigger processing for specific NFTs (for testing/debugging)
   */
  static async markNFTsDirty(
    nft_ids: string[], 
    priority: number = 0
  ): Promise<{ success: boolean; marked_count: number; error?: string }> {
    try {
      let marked_count = 0;

      for (const nft_id of nft_ids) {
        const { error } = await supabase.rpc('mark_dirty_nft', {
          _nft_id: nft_id,
          _priority: priority,
        });

        if (error) {
          console.error(`Failed to mark NFT ${nft_id} as dirty:`, error);
        } else {
          marked_count++;
        }
      }

      console.log(`✅ Marked ${marked_count}/${nft_ids.length} NFTs as dirty`);
      return { success: true, marked_count };

    } catch (error) {
      console.error('Mark dirty error:', error);
      return { 
        success: false, 
        marked_count: 0,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get recent events for monitoring/debugging
   */
  static async getRecentEvents(limit: number = 100): Promise<{
    success: boolean;
    data?: {
      votes: VoteEvent[];
      sliders: SliderEvent[];
      fires: FireEvent[];
    };
    error?: string;
  }> {
    try {
      const [votesResult, slidersResult, firesResult] = await Promise.all([
        supabase
          .from('votes_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('sliders_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('fires_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      if (votesResult.error || slidersResult.error || firesResult.error) {
        const errors = [votesResult.error, slidersResult.error, firesResult.error]
          .filter(Boolean)
          .map(e => e!.message)
          .join(', ');
        return { success: false, error: errors };
      }

      return {
        success: true,
        data: {
          votes: votesResult.data || [],
          sliders: slidersResult.data || [],
          fires: firesResult.data || [],
        },
      };

    } catch (error) {
      console.error('Get recent events error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
