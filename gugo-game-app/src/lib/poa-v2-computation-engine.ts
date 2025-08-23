/**
 * 🧮 POA v2 Computation Engine
 * 
 * Comprehensive algorithm to compute POA v2 scores for real NFT collections.
 * Uses actual voting data, Elo ratings, slider values, and FIRE votes.
 */

import { supabase } from '../../lib/supabase';
import { 
  computePOAv2, 
  calculateFireComponent, 
  normalizeSliderValue,
  logPOAv2Computation 
} from './poa-v2-utils';
import { getPOAv2Config } from './poa-v2-config';
import { shouldUsePOAv2 } from './feature-flags';

export interface NFTComputationData {
  id: string;
  name: string;
  collection_name: string;
  elo_mean: number;
  elo_sigma: number;
  total_votes: number;
  slider_average?: number;
  slider_count?: number;
  fire_vote_count?: number;
  current_poa_v2?: number;
}

export interface ComputationResult {
  nft_id: string;
  poa_v2: number;
  poa_v2_confidence: number;
  poa_v2_components: any;
  poa_v2_explanation: string;
  computation_timestamp: string;
  data_sources: {
    elo_votes: number;
    slider_votes: number;
    fire_votes: number;
    avg_user_reliability: number;
  };
}

export interface BatchComputationSummary {
  total_processed: number;
  successful_computations: number;
  failed_computations: number;
  avg_poa_v2: number;
  avg_confidence: number;
  processing_time_ms: number;
  collections_processed: string[];
}

/**
 * Compute POA v2 score for a single NFT using real data
 */
export async function computePOAv2ForNFT(nftId: string): Promise<ComputationResult | null> {
  const config = getPOAv2Config();
  
  if (!shouldUsePOAv2()) {
    throw new Error('POA v2 computation is disabled');
  }
  
  try {
    // Get comprehensive NFT data
    const nftData = await getNFTComputationData(nftId);
    if (!nftData) {
      throw new Error(`NFT ${nftId} not found or insufficient data`);
    }
    
    // Check minimum vote threshold
    if (nftData.total_votes < config.thresholds.minVotesForPOAv2) {
      console.log(`⏭️ Skipping ${nftData.name}: insufficient votes (${nftData.total_votes}/${config.thresholds.minVotesForPOAv2})`);
      return null;
    }
    
    // Get FIRE vote data
    const fireVoteCount = await getFireVoteCount(nftId);
    const reliabilityAdjustedFireCount = await getReliabilityAdjustedFireCount(nftId);
    
    // Get normalized slider data
    const normalizedSlider = await getNormalizedSliderScore(nftId);
    
    // Get average reliability of voters for this NFT
    const avgReliability = await getAverageVoterReliability(nftId);
    
    // Compute POA v2 score
    const poaResult = computePOAv2(
      nftData.elo_mean,
      nftData.elo_sigma,
      normalizedSlider,
      calculateFireComponent(reliabilityAdjustedFireCount),
      avgReliability
    );
    
    const result: ComputationResult = {
      nft_id: nftId,
      poa_v2: poaResult.poa_v2,
      poa_v2_confidence: poaResult.components.confidence,
      poa_v2_components: poaResult.components,
      poa_v2_explanation: poaResult.explanation,
      computation_timestamp: new Date().toISOString(),
      data_sources: {
        elo_votes: nftData.total_votes,
        slider_votes: nftData.slider_count || 0,
        fire_votes: fireVoteCount,
        avg_user_reliability: avgReliability,
      },
    };
    
    if (config.debugLogging) {
      logPOAv2Computation(poaResult, nftId);
    }
    
    // Save the computed POA v2 score to the database
    const { error: saveError } = await supabase
      .from('nfts')
      .update({
        poa_v2: result.poa_v2,
        poa_v2_confidence: result.poa_v2_confidence,
        poa_v2_components: result.poa_v2_components,
        poa_v2_explanation: result.poa_v2_explanation,
        poa_v2_updated_at: result.computation_timestamp,
      })
      .eq('id', nftId);

    if (saveError) {
      console.error(`❌ Failed to save POA v2 for NFT ${nftId}:`, saveError);
      throw new Error(`Database save failed: ${saveError.message}`);
    }

    console.log(`✅ POA v2 computed and saved for NFT ${nftId}: ${result.poa_v2} (confidence: ${result.poa_v2_confidence})`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ Failed to compute POA v2 for NFT ${nftId}:`, error);
    return null;
  }
}

/**
 * Compute POA v2 scores for multiple NFTs in batch
 */
export async function computePOAv2Batch(
  nftIds: string[], 
  options: { 
    batchSize?: number; 
    delayMs?: number; 
    skipExisting?: boolean;
  } = {}
): Promise<BatchComputationSummary> {
  const { batchSize = 10, delayMs = 100, skipExisting = true } = options;
  const startTime = Date.now();
  
  console.log(`🧮 Starting POA v2 batch computation for ${nftIds.length} NFTs...`);
  
  const results: ComputationResult[] = [];
  const failures: string[] = [];
  const collectionsProcessed = new Set<string>();
  
  // Process in batches to avoid overwhelming the database
  for (let i = 0; i < nftIds.length; i += batchSize) {
    const batch = nftIds.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(nftIds.length / batchSize)} (${batch.length} NFTs)...`);
    
    const batchPromises = batch.map(async (nftId) => {
      try {
        // Skip if already has POA v2 score (optional)
        if (skipExisting) {
          const { data: existing } = await supabase
            .from('nfts')
            .select('poa_v2, collection_name')
            .eq('id', nftId)
            .single();
          
          if (existing?.poa_v2 !== null) {
            console.log(`⏭️ Skipping ${nftId}: already has POA v2 score`);
            if (existing?.collection_name) collectionsProcessed.add(existing.collection_name);
            return null;
          }
        }
        
        const result = await computePOAv2ForNFT(nftId);
        if (result) {
          // Get collection name for tracking
          const { data: nft } = await supabase
            .from('nfts')
            .select('collection_name')
            .eq('id', nftId)
            .single();
          
          if (nft?.collection_name) collectionsProcessed.add(nft.collection_name);
        }
        return result;
      } catch (error) {
        console.error(`❌ Batch computation failed for ${nftId}:`, error);
        failures.push(nftId);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(r => r !== null) as ComputationResult[]);
    
    // Small delay between batches
    if (i + batchSize < nftIds.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Save results to database
  if (results.length > 0) {
    await savePOAv2Results(results);
  }
  
  const processingTime = Date.now() - startTime;
  const avgPoa = results.length > 0 ? results.reduce((sum, r) => sum + r.poa_v2, 0) / results.length : 0;
  const avgConfidence = results.length > 0 ? results.reduce((sum, r) => sum + r.poa_v2_confidence, 0) / results.length : 0;
  
  const summary: BatchComputationSummary = {
    total_processed: nftIds.length,
    successful_computations: results.length,
    failed_computations: failures.length,
    avg_poa_v2: Math.round(avgPoa * 100) / 100,
    avg_confidence: Math.round(avgConfidence * 100) / 100,
    processing_time_ms: processingTime,
    collections_processed: Array.from(collectionsProcessed),
  };
  
  console.log('✅ POA v2 batch computation complete:', summary);
  return summary;
}

/**
 * Compute POA v2 scores for NFTs by collection
 */
export async function computePOAv2ByCollection(
  collectionName: string, 
  limit?: number
): Promise<BatchComputationSummary> {
  console.log(`🎨 Computing POA v2 for collection: ${collectionName}`);
  
  // Get NFTs from the collection with sufficient voting data
  const query = supabase
    .from('nfts')
    .select('id')
    .eq('collection_name', collectionName)
    .not('elo_mean', 'is', null)
    .gte('total_votes', getPOAv2Config().thresholds.minVotesForPOAv2)
    .order('total_votes', { ascending: false });
  
  if (limit) {
    query.limit(limit);
  }
  
  const { data: nfts, error } = await query;
  
  if (error) {
    throw new Error(`Failed to get NFTs for collection ${collectionName}: ${error.message}`);
  }
  
  if (!nfts || nfts.length === 0) {
    console.log(`⚠️ No NFTs found for collection ${collectionName} with sufficient voting data`);
    return {
      total_processed: 0,
      successful_computations: 0,
      failed_computations: 0,
      avg_poa_v2: 0,
      avg_confidence: 0,
      processing_time_ms: 0,
      collections_processed: [],
    };
  }
  
  console.log(`📊 Found ${nfts.length} NFTs in ${collectionName} with sufficient voting data`);
  
  return await computePOAv2Batch(nfts.map(nft => nft.id));
}

/**
 * Get comprehensive NFT data for computation
 */
async function getNFTComputationData(nftId: string): Promise<NFTComputationData | null> {
  const { data, error } = await supabase
    .from('nfts')
    .select(`
      id, name, collection_name, elo_mean, elo_sigma, total_votes,
      slider_average, slider_count, poa_v2
    `)
    .eq('id', nftId)
    .single();
  
  if (error || !data) {
    console.error(`Failed to get NFT data for ${nftId}:`, error);
    return null;
  }
  
  return {
    ...data,
    current_poa_v2: data.poa_v2,
  };
}

/**
 * Get FIRE vote count for an NFT
 */
async function getFireVoteCount(nftId: string): Promise<number> {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('nft_id', nftId)
    .eq('vote_type', 'fire');
  
  if (error) {
    console.warn(`Failed to get FIRE votes for ${nftId}:`, error);
    return 0;
  }
  
  return data?.length || 0;
}

/**
 * Get reliability-adjusted FIRE vote count
 */
async function getReliabilityAdjustedFireCount(nftId: string): Promise<number> {
  // For now, return raw count. In future, weight by user reliability
  // TODO: Implement reliability weighting
  return await getFireVoteCount(nftId);
}

/**
 * Get normalized slider score for an NFT
 */
async function getNormalizedSliderScore(nftId: string): Promise<number> {
  const { data, error } = await supabase
    .from('nfts')
    .select('slider_average, slider_count')
    .eq('id', nftId)
    .single();
  
  if (error || !data) {
    console.warn(`Failed to get slider data for ${nftId}:`, error);
    return 50; // Default middle value
  }
  
  // If no slider data, return default
  if (!data.slider_average || !data.slider_count) {
    return 50;
  }
  
  // For now, use the raw average. In future, implement per-user normalization
  // TODO: Implement proper per-user slider normalization
  return Math.max(0, Math.min(100, data.slider_average * 10)); // Convert 1-10 to 0-100
}

/**
 * Get average reliability of voters for an NFT
 */
async function getAverageVoterReliability(nftId: string): Promise<number> {
  // For now, return default reliability. In future, calculate from actual voter data
  // TODO: Implement actual voter reliability calculation
  return 1.0; // Default reliability
}

/**
 * Save POA v2 computation results to database
 */
async function savePOAv2Results(results: ComputationResult[]): Promise<void> {
  console.log(`💾 Saving ${results.length} POA v2 computation results...`);
  
  const updates = results.map(result => ({
    id: result.nft_id,
    poa_v2: result.poa_v2,
    poa_v2_confidence: result.poa_v2_confidence,
    poa_v2_components: result.poa_v2_components,
    poa_v2_explanation: result.poa_v2_explanation,
    poa_v2_updated_at: result.computation_timestamp,
  }));
  
  // Save in batches to avoid timeout
  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('nfts')
      .upsert(batch, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`Failed to save POA v2 batch ${i}-${i + batch.length}:`, error);
      throw error;
    }
    
    console.log(`✅ Saved POA v2 batch ${i + 1}-${i + batch.length}/${updates.length}`);
  }
  
  console.log('✅ All POA v2 results saved successfully');
}
