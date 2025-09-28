import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Getting ALL real collection names from database...');

    // Get ALL unique collection names (no limit this time)
    const { data: allNFTs, error } = await supabase
      .from('nfts')
      .select('collection_name, name, total_votes, poa_v2')
      .range(0, 54311); // Get all 54,312 NFTs

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Count all collections
    const collectionCounts = allNFTs?.reduce((acc, nft) => {
      const collection = nft.collection_name;
      if (!acc[collection]) {
        acc[collection] = {
          count: 0,
          with_votes: 0,
          with_poa: 0,
          sample_names: []
        };
      }
      acc[collection].count++;
      if (nft.total_votes > 0) acc[collection].with_votes++;
      if (nft.poa_v2 !== null) acc[collection].with_poa++;
      
      // Keep sample names for each collection
      if (acc[collection].sample_names.length < 5) {
        acc[collection].sample_names.push(nft.name);
      }
      
      return acc;
    }, {} as Record<string, any>) || {};

    // Sort by count
    const sortedCollections = Object.entries(collectionCounts)
      .sort(([,a], [,b]) => b.count - a.count)
      .map(([name, stats]) => ({
        collection_name: name,
        total_nfts: stats.count,
        with_votes: stats.with_votes,
        with_poa_v2: stats.with_poa,
        vote_percentage: Math.round((stats.with_votes / stats.count) * 100),
        sample_nft_names: stats.sample_names
      }));

    // Look for collections that might match your targets
    const targetKeywords = ['pengz', 'kabu', 'bee', 'bear', 'dreami'];
    const possibleMatches = sortedCollections.filter(col => 
      targetKeywords.some(keyword => 
        col.collection_name.toLowerCase().includes(keyword)
      )
    );

    return NextResponse.json({
      success: true,
      message: 'Complete real collections analysis',
      data: {
        total_nfts_processed: allNFTs?.length || 0,
        total_collections: sortedCollections.length,
        all_collections: sortedCollections,
        possible_target_matches: possibleMatches,
        summary: {
          largest_collections: sortedCollections.slice(0, 10),
          total_with_votes: sortedCollections.reduce((sum, col) => sum + col.with_votes, 0),
          total_with_poa: sortedCollections.reduce((sum, col) => sum + col.with_poa_v2, 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Real collections analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

