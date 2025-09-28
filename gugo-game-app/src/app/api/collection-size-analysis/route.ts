import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

const PRIORITY_COLLECTIONS = ['BEARISH', 'Pengztracted', 'Kabu', 'BEEISH'];

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Analyzing collection sizes and vote distribution...');

    // 1. Get total NFTs per collection (all NFTs)
    const { data: allNFTs, error: allError } = await supabase
      .from('nfts')
      .select('collection_name, total_votes, poa_v2')
      .in('collection_name', PRIORITY_COLLECTIONS);

    if (allError) {
      return NextResponse.json({ success: false, error: allError.message });
    }

    // 2. Analyze vote distribution by collection
    const collectionAnalysis = PRIORITY_COLLECTIONS.map(collection => {
      const nfts = allNFTs?.filter(nft => nft.collection_name === collection) || [];
      
      // Vote buckets
      const zeroVotes = nfts.filter(nft => nft.total_votes === 0);
      const lowVotes = nfts.filter(nft => nft.total_votes > 0 && nft.total_votes <= 4);
      const mediumVotes = nfts.filter(nft => nft.total_votes >= 5 && nft.total_votes <= 10);
      const highVotes = nfts.filter(nft => nft.total_votes > 10);
      
      // POA status
      const withPOA = nfts.filter(nft => nft.poa_v2 !== null);
      const withoutPOA = nfts.filter(nft => nft.poa_v2 === null);

      return {
        collection,
        total_nfts: nfts.length,
        vote_distribution: {
          zero_votes: zeroVotes.length,
          low_votes_1_4: lowVotes.length,
          medium_votes_5_10: mediumVotes.length,
          high_votes_10plus: highVotes.length
        },
        poa_status: {
          with_poa_v2: withPOA.length,
          without_poa_v2: withoutPOA.length
        },
        migration_candidates: {
          // NFTs with any votes that don't have POA v2
          any_votes_no_poa: nfts.filter(nft => nft.total_votes > 0 && nft.poa_v2 === null).length,
          // NFTs with 5+ votes (our current filter)
          medium_high_votes: nfts.filter(nft => nft.total_votes >= 5).length,
          // NFTs with any votes at all
          any_votes: nfts.filter(nft => nft.total_votes > 0).length
        }
      };
    });

    // 3. Overall statistics
    const totalStats = {
      total_nfts_all_collections: allNFTs?.length || 0,
      total_with_any_votes: allNFTs?.filter(nft => nft.total_votes > 0).length || 0,
      total_with_5plus_votes: allNFTs?.filter(nft => nft.total_votes >= 5).length || 0,
      total_with_poa_v2: allNFTs?.filter(nft => nft.poa_v2 !== null).length || 0,
      total_zero_votes: allNFTs?.filter(nft => nft.total_votes === 0).length || 0
    };

    // 4. Check if we're missing collections
    const { data: allCollections, error: collectionsError } = await supabase
      .from('nfts')
      .select('collection_name')
      .limit(1000);

    const uniqueCollections = [...new Set(allCollections?.map(nft => nft.collection_name) || [])];
    const missingCollections = uniqueCollections.filter(col => !PRIORITY_COLLECTIONS.includes(col));

    return NextResponse.json({
      success: true,
      message: 'Collection size analysis complete',
      data: {
        priority_collections: PRIORITY_COLLECTIONS,
        collection_analysis: collectionAnalysis,
        total_stats: totalStats,
        other_collections: {
          total_collections_found: uniqueCollections.length,
          priority_collections_count: PRIORITY_COLLECTIONS.length,
          other_collections: missingCollections.slice(0, 10), // Sample
          missing_collections_count: missingCollections.length
        },
        recommendations: generateRecommendations(collectionAnalysis, totalStats)
      }
    });

  } catch (error) {
    console.error('❌ Collection size analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateRecommendations(analysis: any[], totalStats: any): string[] {
  const recommendations = [];

  const totalAnyVotes = analysis.reduce((sum, col) => sum + col.migration_candidates.any_votes, 0);
  const totalZeroVotes = analysis.reduce((sum, col) => sum + col.vote_distribution.zero_votes, 0);

  if (totalZeroVotes > totalAnyVotes) {
    recommendations.push(
      `📊 INSIGHT: ${totalZeroVotes} NFTs have 0 votes vs ${totalAnyVotes} with votes - most NFTs haven't been voted on yet`
    );
  }

  if (totalAnyVotes > 500) {
    recommendations.push(
      `🔄 MIGRATION SCOPE: Consider migrating ALL ${totalAnyVotes} NFTs with any votes (not just 5+ votes)`
    );
  }

  analysis.forEach(col => {
    if (col.migration_candidates.any_votes > col.migration_candidates.medium_high_votes * 2) {
      recommendations.push(
        `📈 ${col.collection}: ${col.migration_candidates.any_votes} NFTs have votes but only ${col.migration_candidates.medium_high_votes} have 5+ votes - consider lowering threshold`
      );
    }
  });

  return recommendations;
}

