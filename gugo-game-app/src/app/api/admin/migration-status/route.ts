import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking migration status...');

    // Get counts from all event tables
    const [votesResult, slidersResult, firesResult] = await Promise.all([
      supabase.from('votes_events').select('*', { count: 'exact', head: true }),
      supabase.from('sliders_events').select('*', { count: 'exact', head: true }),
      supabase.from('fires_events').select('*', { count: 'exact', head: true })
    ]);

    if (votesResult.error || slidersResult.error || firesResult.error) {
      console.error('❌ Error getting event counts:', {
        votes: votesResult.error,
        sliders: slidersResult.error,
        fires: firesResult.error
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to get event counts' 
      });
    }

    const eventCounts = {
      votes_events: votesResult.count || 0,
      sliders_events: slidersResult.count || 0,
      fires_events: firesResult.count || 0,
      total_events: (votesResult.count || 0) + (slidersResult.count || 0) + (firesResult.count || 0)
    };

    // Get collection breakdown from votes_events
    const { data: collectionBreakdown, error: collectionError } = await supabase
      .from('votes_events')
      .select(`
        nft_a_id,
        nfts!votes_events_nft_a_id_fkey(collection_name)
      `)
      .limit(1000); // Sample to get collection representation

    let collectionStats: Record<string, number> = {};
    if (!collectionError && collectionBreakdown) {
      // Count events per collection (approximate from sample)
      collectionBreakdown.forEach(event => {
        const collection = (event.nfts as any)?.collection_name;
        if (collection) {
          collectionStats[collection] = (collectionStats[collection] || 0) + 1;
        }
      });
    }

    // Get NFT migration status
    const { data: nftStats, error: nftError } = await supabase
      .from('nfts')
      .select('collection_name, total_votes')
      .gt('total_votes', 0);

    let nftBreakdown: Record<string, { nfts_with_votes: number, total_votes: number }> = {};
    if (!nftError && nftStats) {
      nftStats.forEach(nft => {
        if (!nftBreakdown[nft.collection_name]) {
          nftBreakdown[nft.collection_name] = { nfts_with_votes: 0, total_votes: 0 };
        }
        nftBreakdown[nft.collection_name].nfts_with_votes++;
        nftBreakdown[nft.collection_name].total_votes += nft.total_votes;
      });
    }

    // Expected migration results (from our completed migration)
    const expectedResults = {
      total_nfts_migrated: 6977,
      total_events_migrated: 22902,
      collections_migrated: [
        'BEEISH', 'BEARISH', 'Pengztracted', 'Kabu', 'DreamilioMaker',
        'Final Bosu', 'RUYUI', 'Canna Sapiens', 'Fugz'
      ]
    };

    // Calculate migration health
    const migrationHealth = {
      events_migrated_percentage: Math.round((eventCounts.total_events / expectedResults.total_events_migrated) * 100),
      collections_represented: Object.keys(collectionStats).length,
      expected_collections: expectedResults.collections_migrated.length,
      migration_complete: eventCounts.total_events >= expectedResults.total_events_migrated * 0.95 // 95% threshold
    };

    console.log('✅ Migration status check complete');

    return NextResponse.json({
      success: true,
      migration_status: {
        event_counts: eventCounts,
        collection_stats: collectionStats,
        nft_breakdown: nftBreakdown,
        expected_results: expectedResults,
        migration_health: migrationHealth,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Migration status check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

