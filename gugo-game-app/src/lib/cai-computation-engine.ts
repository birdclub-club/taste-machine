/**
 * Collection Aesthetic Index (CAI) Computation Engine
 * 
 * Handles the computation of CAI scores for collections
 */

import { supabase } from '../../lib/supabase';
import { computeCAI, validateCollectionForCAI, type CollectionData, type CaiResult } from './cai-utils';
import { getCaiConfig } from './cai-config';
import { shouldUseCAI } from './feature-flags';

export interface CaiComputationResult extends CaiResult {
  computed: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Fetch collection data needed for CAI computation
 */
export async function fetchCollectionData(collectionName: string): Promise<CollectionData | null> {
  try {
    console.log(`📊 Fetching data for collection: ${collectionName}`);

    // Get collection info
    const { data: collectionInfo, error: collectionError } = await supabase
      .from('collection_management')
      .select('collection_name, active')
      .eq('collection_name', collectionName)
      .eq('active', true)
      .single();

    if (collectionError || !collectionInfo) {
      console.error(`❌ Collection ${collectionName} not found or inactive:`, collectionError);
      return null;
    }

    // Get NFTs with POA v2 scores
    const { data: nfts, error: nftsError } = await supabase
      .from('nfts')
      .select('id, poa_v2, total_votes, poa_v2_confidence')
      .eq('collection_name', collectionName)
      .not('poa_v2', 'is', null);

    if (nftsError) {
      console.error(`❌ Failed to fetch NFTs for ${collectionName}:`, nftsError);
      return null;
    }

    if (!nfts || nfts.length === 0) {
      console.warn(`⚠️ No NFTs with POA v2 scores found for ${collectionName}`);
      return null;
    }

    // Calculate total votes
    const totalVotes = nfts.reduce((sum, nft) => sum + (nft.total_votes || 0), 0);

    console.log(`✅ Fetched ${nfts.length} NFTs with ${totalVotes} total votes for ${collectionName}`);

    return {
      collection_name: collectionName,
      nfts: nfts.map(nft => ({
        id: nft.id,
        poa_v2: nft.poa_v2,
        total_votes: nft.total_votes || 0,
        poa_v2_confidence: nft.poa_v2_confidence,
      })),
      total_votes: totalVotes,
      active: true,
    };

  } catch (error) {
    console.error(`❌ Error fetching collection data for ${collectionName}:`, error);
    return null;
  }
}

/**
 * Compute CAI score for a single collection
 */
export async function computeCAIForCollection(collectionName: string): Promise<CaiComputationResult> {
  try {
    console.log(`🧮 Computing CAI for collection: ${collectionName}`);

    // Check if CAI is enabled
    if (!shouldUseCAI()) {
      return {
        collection_name: collectionName,
        cai_score: 0,
        cai_confidence: 0,
        cai_cohesion: 0,
        cai_coverage: 0,
        cai_components: {} as any,
        cai_explanation: 'CAI computation disabled',
        computation_timestamp: new Date().toISOString(),
        computed: false,
        error: 'CAI computation is disabled via feature flags',
      };
    }

    // Fetch collection data
    const collectionData = await fetchCollectionData(collectionName);
    if (!collectionData) {
      return {
        collection_name: collectionName,
        cai_score: 0,
        cai_confidence: 0,
        cai_cohesion: 0,
        cai_coverage: 0,
        cai_components: {} as any,
        cai_explanation: 'Collection data not available',
        computation_timestamp: new Date().toISOString(),
        computed: false,
        error: 'Failed to fetch collection data',
      };
    }

    // Validate collection data
    const validation = validateCollectionForCAI(collectionData);
    if (!validation.isValid) {
      return {
        collection_name: collectionName,
        cai_score: 0,
        cai_confidence: 0,
        cai_cohesion: 0,
        cai_coverage: 0,
        cai_components: {} as any,
        cai_explanation: 'Collection validation failed',
        computation_timestamp: new Date().toISOString(),
        computed: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        warnings: validation.warnings,
      };
    }

    // Compute CAI
    const caiResult = computeCAI(collectionData);

    // Save CAI result to database
    const { error: saveError } = await supabase
      .from('collection_management')
      .update({
        cai_score: caiResult.cai_score,
        cai_confidence: caiResult.cai_confidence,
        cai_cohesion: caiResult.cai_cohesion,
        cai_coverage: caiResult.cai_coverage,
        cai_updated_at: caiResult.computation_timestamp,
        cai_components: caiResult.cai_components,
        cai_explanation: caiResult.cai_explanation,
      })
      .eq('collection_name', collectionName);

    if (saveError) {
      console.error(`❌ Failed to save CAI for ${collectionName}:`, saveError);
      return {
        ...caiResult,
        computed: false,
        error: `Database save failed: ${saveError.message}`,
        warnings: validation.warnings,
      };
    }

    // Save to history
    const { error: historyError } = await supabase
      .from('cai_history')
      .insert({
        collection_name: collectionName,
        cai_score: caiResult.cai_score,
        cai_confidence: caiResult.cai_confidence,
        cai_cohesion: caiResult.cai_cohesion,
        cai_coverage: caiResult.cai_coverage,
        cai_components: caiResult.cai_components,
        cai_explanation: caiResult.cai_explanation,
        nft_count: caiResult.cai_components.nft_count,
        total_votes: caiResult.cai_components.total_votes,
        avg_poa_v2: caiResult.cai_components.aesthetic_mean,
        computation_trigger: 'manual',
      });

    if (historyError) {
      console.warn(`⚠️ Failed to save CAI history for ${collectionName}:`, historyError);
    }

    console.log(`✅ CAI computed and saved for ${collectionName}: ${caiResult.cai_score} (confidence: ${caiResult.cai_confidence})`);

    return {
      ...caiResult,
      computed: true,
      warnings: validation.warnings,
    };

  } catch (error) {
    console.error(`❌ CAI computation error for ${collectionName}:`, error);
    return {
      collection_name: collectionName,
      cai_score: 0,
      cai_confidence: 0,
      cai_cohesion: 0,
      cai_coverage: 0,
      cai_components: {} as any,
      cai_explanation: 'Computation failed',
      computation_timestamp: new Date().toISOString(),
      computed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Compute CAI for multiple collections in batch
 */
export async function computeCAIBatch(
  collectionNames: string[],
  options: {
    maxConcurrent?: number;
    delayMs?: number;
  } = {}
): Promise<CaiComputationResult[]> {
  const config = getCaiConfig();
  const maxConcurrent = options.maxConcurrent || config.batch.max_concurrent;
  const delayMs = options.delayMs || config.batch.delay_between_ms;

  console.log(`🧮 Starting CAI batch computation for ${collectionNames.length} collections`);

  const results: CaiComputationResult[] = [];
  
  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < collectionNames.length; i += maxConcurrent) {
    const batch = collectionNames.slice(i, i + maxConcurrent);
    
    console.log(`📊 Processing batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.join(', ')}`);
    
    // Process batch concurrently
    const batchPromises = batch.map(collectionName => 
      computeCAIForCollection(collectionName)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches (except for the last batch)
    if (i + maxConcurrent < collectionNames.length && delayMs > 0) {
      console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const successful = results.filter(r => r.computed).length;
  const failed = results.filter(r => !r.computed).length;
  
  console.log(`✅ CAI batch computation completed: ${successful} successful, ${failed} failed`);

  return results;
}

/**
 * Get collections that need CAI computation
 */
export async function getCAIComputationCandidates(): Promise<string[]> {
  try {
    const { data: collections, error } = await supabase
      .from('collection_management')
      .select('collection_name, cai_updated_at')
      .eq('active', true);

    if (error) {
      console.error('❌ Failed to get CAI candidates:', error);
      return [];
    }

    if (!collections) {
      return [];
    }

    const config = getCaiConfig();
    const staleThresholdMs = config.thresholds.staleness_hours * 60 * 60 * 1000;
    const now = Date.now();

    const candidates = collections.filter(collection => {
      // Include collections with no CAI score
      if (!collection.cai_updated_at) {
        return true;
      }

      // Include collections with stale CAI scores
      const lastUpdated = new Date(collection.cai_updated_at).getTime();
      const ageMs = now - lastUpdated;
      return ageMs > staleThresholdMs;
    });

    return candidates.map(c => c.collection_name);

  } catch (error) {
    console.error('❌ Error getting CAI candidates:', error);
    return [];
  }
}

/**
 * Get CAI leaderboard data
 */
export async function getCAILeaderboard(limit: number = 10): Promise<Array<{
  collection_name: string;
  cai_score: number;
  cai_confidence: number;
  cai_cohesion: number;
  cai_coverage: number;
  nft_count: number;
  total_votes: number;
  cai_updated_at: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('collection_management')
      .select(`
        collection_name,
        cai_score,
        cai_confidence,
        cai_cohesion,
        cai_coverage,
        cai_components,
        cai_updated_at
      `)
      .eq('active', true)
      .not('cai_score', 'is', null)
      .order('cai_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Failed to get CAI leaderboard:', error);
      return [];
    }

    return (data || []).map(collection => ({
      collection_name: collection.collection_name,
      cai_score: collection.cai_score,
      cai_confidence: collection.cai_confidence,
      cai_cohesion: collection.cai_cohesion,
      cai_coverage: collection.cai_coverage,
      nft_count: collection.cai_components?.nft_count || 0,
      total_votes: collection.cai_components?.total_votes || 0,
      cai_updated_at: collection.cai_updated_at,
    }));

  } catch (error) {
    console.error('❌ Error getting CAI leaderboard:', error);
    return [];
  }
}
