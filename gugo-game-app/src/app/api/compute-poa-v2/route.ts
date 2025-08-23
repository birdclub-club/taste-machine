/**
 * 🧮 POA v2 Computation API
 * 
 * API endpoint to compute POA v2 scores for real NFT collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  computePOAv2ForNFT, 
  computePOAv2Batch, 
  computePOAv2ByCollection,
  BatchComputationSummary 
} from '../../../lib/poa-v2-computation-engine';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action, nftId, nftIds, collectionName, limit, options } = await request.json();
    
    console.log('🧮 POA v2 Computation API called:', { action, nftId, collectionName, limit });
    
    // Temporarily enable POA v2 for computation
    const originalEnv = process.env.POA_V2_ENABLED;
    process.env.POA_V2_ENABLED = 'true';
    process.env.POA_V2_COMPUTATION = 'true';
    
    try {
      switch (action) {
        case 'compute_single':
          if (!nftId) {
            return NextResponse.json({
              success: false,
              error: 'Missing nftId parameter'
            }, { status: 400 });
          }
          return await computeSingleNFT(nftId);
          
        case 'compute_batch':
          if (!nftIds || !Array.isArray(nftIds)) {
            return NextResponse.json({
              success: false,
              error: 'Missing or invalid nftIds parameter'
            }, { status: 400 });
          }
          return await computeBatchNFTs(nftIds, options);
          
        case 'compute_collection':
          if (!collectionName) {
            return NextResponse.json({
              success: false,
              error: 'Missing collectionName parameter'
            }, { status: 400 });
          }
          return await computeCollectionNFTs(collectionName, limit);
          
        case 'get_computation_candidates':
          return await getComputationCandidates(limit);
          
        case 'get_collection_stats':
          return await getCollectionStats();
          
        default:
          return NextResponse.json({
            success: false,
            error: 'Invalid action',
            availableActions: [
              'compute_single', 
              'compute_batch', 
              'compute_collection', 
              'get_computation_candidates',
              'get_collection_stats'
            ]
          }, { status: 400 });
      }
    } finally {
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.POA_V2_ENABLED = originalEnv;
      } else {
        delete process.env.POA_V2_ENABLED;
      }
      delete process.env.POA_V2_COMPUTATION;
    }
    
  } catch (error) {
    console.error('❌ POA v2 computation API failed:', error);
    
    return NextResponse.json({
      success: false,
      phase: 'A3',
      error: 'POA v2 computation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function computeSingleNFT(nftId: string) {
  try {
    console.log(`🎯 Computing POA v2 for single NFT: ${nftId}`);
    
    // Get NFT info first
    const { data: nft, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, total_votes, poa_v2')
      .eq('id', nftId)
      .single();
    
    if (nftError || !nft) {
      throw new Error(`NFT not found: ${nftError?.message}`);
    }
    
    const result = await computePOAv2ForNFT(nftId);
    
    return NextResponse.json({
      success: true,
      phase: 'A3',
      message: 'Single NFT POA v2 computation completed',
      data: {
        nft: {
          id: nft.id,
          name: nft.name,
          collection: nft.collection_name,
          eloMean: nft.elo_mean,
          totalVotes: nft.total_votes,
          previousPoa: nft.poa_v2,
        },
        computation: result,
        computed: result !== null,
      }
    });
    
  } catch (error) {
    throw new Error(`Single NFT computation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function computeBatchNFTs(nftIds: string[], options: any = {}) {
  try {
    console.log(`📦 Computing POA v2 for batch of ${nftIds.length} NFTs`);
    
    const summary = await computePOAv2Batch(nftIds, options);
    
    return NextResponse.json({
      success: true,
      phase: 'A3',
      message: 'Batch NFT POA v2 computation completed',
      data: {
        summary,
        performance: {
          nftsPerSecond: Math.round((summary.total_processed / summary.processing_time_ms) * 1000 * 100) / 100,
          avgTimePerNft: Math.round(summary.processing_time_ms / summary.total_processed * 100) / 100,
        }
      }
    });
    
  } catch (error) {
    throw new Error(`Batch computation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function computeCollectionNFTs(collectionName: string, limit?: number) {
  try {
    console.log(`🎨 Computing POA v2 for collection: ${collectionName} (limit: ${limit || 'none'})`);
    
    const summary = await computePOAv2ByCollection(collectionName, limit);
    
    return NextResponse.json({
      success: true,
      phase: 'A3',
      message: `Collection POA v2 computation completed for ${collectionName}`,
      data: {
        collection: collectionName,
        summary,
        performance: {
          nftsPerSecond: summary.processing_time_ms > 0 ? 
            Math.round((summary.total_processed / summary.processing_time_ms) * 1000 * 100) / 100 : 0,
          avgTimePerNft: summary.total_processed > 0 ? 
            Math.round(summary.processing_time_ms / summary.total_processed * 100) / 100 : 0,
        }
      }
    });
    
  } catch (error) {
    throw new Error(`Collection computation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getComputationCandidates(limit: number = 100) {
  try {
    // Get NFTs that are good candidates for POA v2 computation
    const { data: candidates, error } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, elo_sigma, total_votes, poa_v2')
      .not('elo_mean', 'is', null)
      .gte('total_votes', 1) // Minimum 1 vote
      .is('poa_v2', null) // Don't have POA v2 yet
      .order('total_votes', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get computation candidates: ${error.message}`);
    }
    
    // Group by collection
    const byCollection: { [key: string]: any[] } = {};
    candidates?.forEach(nft => {
      if (!byCollection[nft.collection_name]) {
        byCollection[nft.collection_name] = [];
      }
      byCollection[nft.collection_name].push({
        id: nft.id,
        name: nft.name,
        eloMean: nft.elo_mean,
        eloSigma: nft.elo_sigma,
        totalVotes: nft.total_votes,
      });
    });
    
    return NextResponse.json({
      success: true,
      phase: 'A3',
      message: 'POA v2 computation candidates retrieved',
      data: {
        totalCandidates: candidates?.length || 0,
        candidates: candidates?.slice(0, 20) || [], // Show top 20
        byCollection,
        collectionSummary: Object.keys(byCollection).map(collection => ({
          collection,
          count: byCollection[collection].length,
          avgVotes: Math.round(byCollection[collection].reduce((sum, nft) => sum + nft.totalVotes, 0) / byCollection[collection].length * 100) / 100,
          topNFT: byCollection[collection][0],
        })).sort((a, b) => b.count - a.count),
      }
    });
    
  } catch (error) {
    throw new Error(`Failed to get computation candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getCollectionStats() {
  try {
    // Get statistics about collections and their POA v2 readiness
    const { data: stats, error } = await supabase
      .from('nfts')
      .select('collection_name, elo_mean, total_votes, poa_v2')
      .not('elo_mean', 'is', null);
    
    if (error) {
      throw new Error(`Failed to get collection stats: ${error.message}`);
    }
    
    // Aggregate by collection
    const collectionStats: { [key: string]: any } = {};
    
    stats?.forEach(nft => {
      const collection = nft.collection_name;
      if (!collectionStats[collection]) {
        collectionStats[collection] = {
          total_nfts: 0,
          nfts_with_votes: 0,
          nfts_with_poa_v2: 0,
          total_votes: 0,
          avg_elo: 0,
          ready_for_computation: 0,
        };
      }
      
      const stats_obj = collectionStats[collection];
      stats_obj.total_nfts++;
      
      if (nft.total_votes > 0) {
        stats_obj.nfts_with_votes++;
        stats_obj.total_votes += nft.total_votes;
      }
      
      if (nft.poa_v2 !== null) {
        stats_obj.nfts_with_poa_v2++;
      }
      
      if (nft.total_votes >= 1 && nft.poa_v2 === null) {
        stats_obj.ready_for_computation++;
      }
      
      stats_obj.avg_elo += nft.elo_mean || 1000;
    });
    
    // Calculate averages and sort
    const collectionSummary = Object.keys(collectionStats)
      .map(collection => {
        const stats_obj = collectionStats[collection];
        return {
          collection,
          ...stats_obj,
          avg_elo: Math.round(stats_obj.avg_elo / stats_obj.total_nfts),
          avg_votes_per_nft: stats_obj.nfts_with_votes > 0 ? 
            Math.round(stats_obj.total_votes / stats_obj.nfts_with_votes * 100) / 100 : 0,
          poa_v2_coverage: Math.round((stats_obj.nfts_with_poa_v2 / stats_obj.total_nfts) * 100 * 100) / 100,
        };
      })
      .sort((a, b) => b.ready_for_computation - a.ready_for_computation);
    
    return NextResponse.json({
      success: true,
      phase: 'A3',
      message: 'Collection statistics retrieved',
      data: {
        totalCollections: collectionSummary.length,
        collectionStats: collectionSummary,
        overallStats: {
          totalNFTs: collectionSummary.reduce((sum, c) => sum + c.total_nfts, 0),
          nftsWithVotes: collectionSummary.reduce((sum, c) => sum + c.nfts_with_votes, 0),
          nftsWithPOAv2: collectionSummary.reduce((sum, c) => sum + c.nfts_with_poa_v2, 0),
          readyForComputation: collectionSummary.reduce((sum, c) => sum + c.ready_for_computation, 0),
        }
      }
    });
    
  } catch (error) {
    throw new Error(`Failed to get collection stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

