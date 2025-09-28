/**
 * 🔧 POA v2 NFTs Admin API
 * 
 * Admin endpoint to get NFTs with POA v2 scores and details
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const collection = searchParams.get('collection');
    
    // Get NFTs with POA v2 scores (top scoring)
    let topQuery = supabase
      .from('nfts')
      .select(`
        id, name, collection_name, elo_mean, elo_sigma, total_votes,
        poa_v2, poa_v2_confidence, poa_v2_explanation, poa_v2_updated_at,
        poa_v2_components
      `)
      .not('poa_v2', 'is', null)
      .order('poa_v2', { ascending: false })
      .limit(limit);
    
    if (collection) {
      topQuery = topQuery.eq('collection_name', collection);
    }
    
    const { data: topNFTs, error: topError } = await topQuery;
    
    if (topError) {
      throw new Error(`Failed to get top NFTs: ${topError.message}`);
    }
    
    // Get recently computed NFTs (simplified query to avoid timeout)
    let recentNFTs: any[] = [];
    try {
      const { data, error } = await supabase
        .from('nfts')
        .select('id, name, collection_name, poa_v2, poa_v2_updated_at')
        .not('poa_v2', 'is', null)
        .order('poa_v2_updated_at', { ascending: false })
        .limit(5);
      
      if (!error) {
        recentNFTs = data || [];
      }
    } catch (error) {
      console.warn('Recent NFTs query timeout, using empty array');
    }
    
    // Get NFTs ready for computation (simplified to avoid timeout)
    let candidateNFTs: any[] = [];
    try {
      const { data, error } = await supabase
        .from('nfts')
        .select('id, name, collection_name, total_votes')
        .is('poa_v2', null)
        .gte('total_votes', 5) // Higher threshold to reduce query size
        .order('total_votes', { ascending: false })
        .limit(10);
      
      if (!error) {
        candidateNFTs = data || [];
      }
    } catch (error) {
      console.warn('Candidate NFTs query timeout, using empty array');
    }
    
    // Get computation statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_poa_v2_system_status');
    
    return NextResponse.json({
      success: true,
      data: {
        topNFTs: topNFTs?.map(nft => ({
          ...nft,
          poa_v2_components: typeof nft.poa_v2_components === 'string' 
            ? JSON.parse(nft.poa_v2_components) 
            : nft.poa_v2_components,
        })) || [],
        recentlyComputed: recentNFTs || [],
        computationCandidates: candidateNFTs || [],
        systemStats: stats?.[0] || null,
        summary: {
          totalWithPOAv2: topNFTs?.length || 0,
          recentComputations: recentNFTs?.length || 0,
          readyCandidates: candidateNFTs?.length || 0,
          avgPOAv2: topNFTs?.length ? 
            topNFTs.reduce((sum, nft) => sum + (nft.poa_v2 || 0), 0) / topNFTs.length : 0,
          avgConfidence: topNFTs?.length ? 
            topNFTs.reduce((sum, nft) => sum + (nft.poa_v2_confidence || 0), 0) / topNFTs.length : 0,
        }
      }
    });
    
  } catch (error) {
    console.error('❌ POA v2 NFTs admin API failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get POA v2 NFT data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, nftId, nftIds } = await request.json();
    
    switch (action) {
      case 'compute_single':
        return await computeSingleNFT(nftId);
        
      case 'compute_batch':
        return await computeBatchNFTs(nftIds);
        
      case 'get_nft_details':
        return await getNFTDetails(nftId);
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['compute_single', 'compute_batch', 'get_nft_details']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ POA v2 NFTs admin POST failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process POA v2 NFT action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function computeSingleNFT(nftId: string) {
  // Import here to avoid circular dependencies
  const { computePOAv2ForNFT } = await import('../../../../lib/poa-v2-computation-engine');
  
  // Temporarily enable POA v2
  const originalEnv = process.env.POA_V2_ENABLED;
  process.env.POA_V2_ENABLED = 'true';
  process.env.POA_V2_COMPUTATION = 'true';
  
  try {
    const result = await computePOAv2ForNFT(nftId);
    
    return NextResponse.json({
      success: true,
      data: {
        computed: result !== null,
        result,
        nftId,
      }
    });
    
  } finally {
    // Restore environment
    if (originalEnv !== undefined) {
      process.env.POA_V2_ENABLED = originalEnv;
    } else {
      delete process.env.POA_V2_ENABLED;
    }
    delete process.env.POA_V2_COMPUTATION;
  }
}

async function computeBatchNFTs(nftIds: string[]) {
  // Import here to avoid circular dependencies
  const { computePOAv2Batch } = await import('../../../../lib/poa-v2-computation-engine');
  
  // Temporarily enable POA v2
  const originalEnv = process.env.POA_V2_ENABLED;
  process.env.POA_V2_ENABLED = 'true';
  process.env.POA_V2_COMPUTATION = 'true';
  
  try {
    const summary = await computePOAv2Batch(nftIds, {
      batchSize: 3,
      delayMs: 200,
      skipExisting: true,
    });
    
    return NextResponse.json({
      success: true,
      data: {
        summary,
        nftIds,
      }
    });
    
  } finally {
    // Restore environment
    if (originalEnv !== undefined) {
      process.env.POA_V2_ENABLED = originalEnv;
    } else {
      delete process.env.POA_V2_ENABLED;
    }
    delete process.env.POA_V2_COMPUTATION;
  }
}

async function getNFTDetails(nftId: string) {
  const { data: nft, error } = await supabase
    .from('nfts')
    .select(`
      id, name, collection_name, elo_mean, elo_sigma, total_votes, wins, losses,
      slider_average, slider_count, poa_v2, poa_v2_confidence, 
      poa_v2_explanation, poa_v2_updated_at, poa_v2_components,
      created_at, updated_at
    `)
    .eq('id', nftId)
    .single();
  
  if (error) {
    throw new Error(`Failed to get NFT details: ${error.message}`);
  }
  
  // Get FIRE votes
  const { data: fireVotes, error: fireError } = await supabase
    .from('favorites')
    .select('id, created_at, user_id')
    .eq('nft_id', nftId)
    .eq('vote_type', 'fire');
  
  // Get recent votes
  const { data: recentVotes, error: votesError } = await supabase
    .from('votes')
    .select('id, created_at, vote_type_v2, winner_id, slider_value')
    .or(`nft_a_id.eq.${nftId},nft_b_id.eq.${nftId}`)
    .order('created_at', { ascending: false })
    .limit(10);
  
  return NextResponse.json({
    success: true,
    data: {
      nft: {
        ...nft,
        poa_v2_components: typeof nft.poa_v2_components === 'string' 
          ? JSON.parse(nft.poa_v2_components) 
          : nft.poa_v2_components,
      },
      fireVotes: fireVotes || [],
      recentVotes: recentVotes || [],
      analytics: {
        fireVoteCount: fireVotes?.length || 0,
        recentVoteCount: recentVotes?.length || 0,
        winRate: nft.total_votes > 0 ? (nft.wins / nft.total_votes * 100).toFixed(1) : '0',
        hasSliderData: (nft.slider_count || 0) > 0,
        hasPOAv2: nft.poa_v2 !== null,
      }
    }
  });
}
