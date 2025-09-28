import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Reality check: Finding actual database contents...');

    // 1. Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ success: false, error: countError.message });
    }

    console.log(`📊 Total NFTs in database: ${totalCount}`);

    // 2. Get collection names with aggregation (no limit)
    const { data: collectionsRaw, error: collectionsError } = await supabase
      .rpc('get_collection_counts'); // Use RPC if available, otherwise fallback

    let collectionCounts = {};
    
    if (collectionsError) {
      console.log('RPC failed, using direct query...');
      // Fallback: Get a larger sample and aggregate
      const { data: sampleNFTs, error: sampleError } = await supabase
        .from('nfts')
        .select('collection_name')
        .limit(50000); // Much larger sample

      if (sampleError) {
        return NextResponse.json({ success: false, error: sampleError.message });
      }

      // Count collections from sample
      collectionCounts = sampleNFTs?.reduce((acc, nft) => {
        const name = nft.collection_name;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
    } else {
      collectionCounts = collectionsRaw;
    }

    // 3. Sort collections by size
    const sortedCollections = Object.entries(collectionCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .map(([name, count]) => ({ name, count }));

    // 4. Look for target collections (case insensitive)
    const targets = ['bearish', 'pengztracted', 'kabu', 'beeish'];
    const foundTargets = sortedCollections.filter(col => 
      targets.some(target => col.name.toLowerCase().includes(target))
    );

    // 5. Get top 10 collections with vote stats
    const top10WithStats = await Promise.all(
      sortedCollections.slice(0, 10).map(async (col) => {
        const { data: stats, error } = await supabase
          .from('nfts')
          .select('total_votes, poa_v2')
          .eq('collection_name', col.name)
          .limit(1000); // Sample from each collection

        if (error) {
          return { ...col, error: error.message };
        }

        const withVotes = stats?.filter(nft => nft.total_votes > 0) || [];
        const withPOA = stats?.filter(nft => nft.poa_v2 !== null) || [];

        return {
          ...col,
          sample_size: stats?.length || 0,
          with_votes: withVotes.length,
          with_poa_v2: withPOA.length,
          vote_percentage: stats?.length ? Math.round((withVotes.length / stats.length) * 100) : 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Database reality check complete',
      data: {
        total_nfts: totalCount,
        total_collections: sortedCollections.length,
        collections_found: sortedCollections.length,
        target_collections_found: foundTargets,
        top_10_collections: top10WithStats,
        all_collections_list: sortedCollections,
        discrepancy_analysis: {
          expected_nfts: '43,000+',
          found_nfts: totalCount,
          previous_search_found: 1000,
          issue: (totalCount || 0) > 1000 ? 'Previous search had limit issues' : 'Database smaller than expected'
        }
      }
    });

  } catch (error) {
    console.error('❌ Database reality check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

