import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Finding ALL collection names (case-sensitive search)...');

    // Get ALL unique collection names with counts
    const { data: collections, error } = await supabase
      .from('nfts')
      .select('collection_name')
      .limit(100000); // Much larger limit to catch everything

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Count NFTs per collection
    const collectionCounts = collections?.reduce((acc, nft) => {
      const name = nft.collection_name;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Sort by count (largest first)
    const sortedCollections = Object.entries(collectionCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    // Look for target collections in various cases
    const targetVariations = [
      // Original targets
      'BEARISH', 'Pengztracted', 'Kabu', 'BEEISH',
      // Lowercase
      'bearish', 'pengztracted', 'kabu', 'beeish',
      // Mixed case
      'Bearish', 'PengzTracted', 'KABU', 'Beeish',
      // Partial matches
      'pengz', 'PENGZ', 'Pengz'
    ];

    const foundMatches = sortedCollections.filter(col => 
      targetVariations.some(target => 
        col.name === target ||
        col.name.toLowerCase().includes(target.toLowerCase()) ||
        target.toLowerCase().includes(col.name.toLowerCase())
      )
    );

    // Get detailed stats for found collections
    const detailedStats = await Promise.all(
      foundMatches.map(async (col) => {
        const { data: nfts } = await supabase
          .from('nfts')
          .select('total_votes, poa_v2')
          .eq('collection_name', col.name);
        
        const withVotes = nfts?.filter(nft => nft.total_votes > 0) || [];
        const withPOA = nfts?.filter(nft => nft.poa_v2 !== null) || [];
        const zeroVotes = nfts?.filter(nft => nft.total_votes === 0) || [];

        return {
          collection: col.name,
          total_nfts: col.count,
          with_votes: withVotes.length,
          with_poa_v2: withPOA.length,
          zero_votes: zeroVotes.length,
          avg_votes: withVotes.length > 0 ? 
            Math.round(withVotes.reduce((sum, nft) => sum + nft.total_votes, 0) / withVotes.length) : 0
        };
      })
    );

    // Check if there are other large collections we missed
    const largeCollections = sortedCollections.filter(col => col.count >= 500);
    const otherLarge = largeCollections.filter(col => 
      !foundMatches.some(match => match.name === col.name)
    );

    return NextResponse.json({
      success: true,
      message: 'Complete collection analysis',
      data: {
        total_collections: sortedCollections.length,
        total_nfts: collections?.length || 0,
        all_collections: sortedCollections,
        target_matches: foundMatches,
        detailed_stats: detailedStats,
        large_collections_not_matched: otherLarge,
        search_variations: targetVariations,
        summary: {
          total_nfts_found: detailedStats.reduce((sum, col) => sum + col.total_nfts, 0),
          total_with_votes: detailedStats.reduce((sum, col) => sum + col.with_votes, 0),
          total_with_poa: detailedStats.reduce((sum, col) => sum + col.with_poa_v2, 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Complete collection analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

