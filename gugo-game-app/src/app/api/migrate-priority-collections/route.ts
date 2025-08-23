import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

const PRIORITY_COLLECTIONS = ['BEARISH', 'Pengztracted', 'Kabu', 'BEEISH'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_size = 25, dry_run = false, collection_filter = null } = body;

    console.log(`🎯 Starting priority collection migration (batch_size: ${batch_size}, dry_run: ${dry_run})`);

    // 1. Get NFTs from priority collections that need migration
    let query = supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, poa_v2')
      .gt('total_votes', 4)  // Only NFTs with meaningful activity
      .in('collection_name', collection_filter ? [collection_filter] : PRIORITY_COLLECTIONS)
      .limit(batch_size);

    const { data: candidateNFTs, error: candidatesError } = await query;

    if (candidatesError) {
      return NextResponse.json({ success: false, error: candidatesError.message });
    }

    if (!candidateNFTs || candidateNFTs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No priority collection NFTs found that need migration',
        data: { migrated: 0 }
      });
    }

    // 2. Check which already have nft_stats (skip those)
    const nftIds = candidateNFTs.map(nft => nft.id);
    const { data: existingStats } = await supabase
      .from('nft_stats')
      .select('nft_id')
      .in('nft_id', nftIds);

    const existingStatsIds = new Set(existingStats?.map(s => s.nft_id) || []);

    // 3. Filter to only NFTs that need migration
    const nftsToMigrate = candidateNFTs.filter(nft => !existingStatsIds.has(nft.id));

    // 4. Categorize by existing POA v2 status
    const withExistingPOA = nftsToMigrate.filter(nft => nft.poa_v2 !== null);
    const withoutPOA = nftsToMigrate.filter(nft => nft.poa_v2 === null);

    console.log(`📊 Found ${nftsToMigrate.length} NFTs to migrate:`);
    console.log(`  - ${withExistingPOA.length} with existing POA v2 scores (will preserve)`);
    console.log(`  - ${withoutPOA.length} without POA v2 scores`);

    if (dry_run) {
      return NextResponse.json({
        success: true,
        message: `DRY RUN: Would migrate ${nftsToMigrate.length} priority collection NFTs`,
        data: {
          would_migrate: nftsToMigrate.length,
          with_existing_poa: withExistingPOA.length,
          without_poa: withoutPOA.length,
          collections: PRIORITY_COLLECTIONS,
          sample_nfts: nftsToMigrate.slice(0, 5).map(nft => ({
            id: nft.id,
            name: nft.name,
            collection: nft.collection_name,
            total_votes: nft.total_votes,
            has_poa_v2: nft.poa_v2 !== null
          }))
        }
      });
    }

    // 5. Migrate each NFT's historical data
    const migrationResults = [];
    let successCount = 0;
    let errorCount = 0;
    let preservedPOACount = 0;

    for (const nft of nftsToMigrate) {
      try {
        console.log(`🔄 Migrating ${nft.collection_name} NFT: ${nft.name} (${nft.total_votes} votes)`);

        // Get historical votes for this NFT
        const { data: votes, error: votesError } = await supabase
          .from('votes')
          .select('id, user_id, nft_a_id, nft_b_id, winner_id, vote_type, vote_type_v2, slider_value, created_at, engagement_data')
          .or(`nft_a_id.eq.${nft.id},nft_b_id.eq.${nft.id}`)
          .order('created_at', { ascending: true });

        if (votesError) {
          console.error(`❌ Error fetching votes for ${nft.id}:`, votesError);
          errorCount++;
          continue;
        }

        // Process votes into events
        const voteEvents = [];
        const sliderEvents = [];

        for (const vote of votes || []) {
          if (vote.vote_type_v2 === 'slider') {
            // Slider vote
            sliderEvents.push({
              voter_id: vote.user_id,
              nft_id: vote.nft_a_id,
              slider_value: vote.slider_value || 0,
              created_at: vote.created_at
            });
          } else if (vote.vote_type_v2 === 'cross_coll' || vote.vote_type_v2 === 'same_coll') {
            // Head-to-head vote (cross-collection or same-collection)
            const isSuper = vote.engagement_data?.super_vote === true;
            voteEvents.push({
              voter_id: vote.user_id,
              nft_a_id: vote.nft_a_id,
              nft_b_id: vote.nft_b_id,
              winner_id: vote.winner_id,
              vote_type: isSuper ? 'super' : 'normal',
              created_at: vote.created_at
            });
          }
        }

        console.log(`  📊 Found ${voteEvents.length} H2H votes, ${sliderEvents.length} slider votes`);

        // Insert events into new tables (only if we have events)
        if (voteEvents.length > 0) {
          const { error: voteInsertError } = await supabase
            .from('votes_events')
            .insert(voteEvents);

          if (voteInsertError) {
            console.error(`❌ Error inserting vote events for ${nft.id}:`, voteInsertError);
            errorCount++;
            continue;
          }
        }

        if (sliderEvents.length > 0) {
          const { error: sliderInsertError } = await supabase
            .from('sliders_events')
            .insert(sliderEvents);

          if (sliderInsertError) {
            console.error(`❌ Error inserting slider events for ${nft.id}:`, sliderInsertError);
            errorCount++;
            continue;
          }
        }

        // Mark NFT as dirty for processing
        const { error: dirtyError } = await supabase
          .from('dirty_nfts')
          .insert({
            nft_id: nft.id,
            priority: nft.poa_v2 !== null ? 'high' : 'medium', // Higher priority for NFTs with existing POA
            reason: nft.poa_v2 !== null ? 'preserve_existing_poa' : 'historical_migration'
          });

        if (dirtyError && !dirtyError.message.includes('duplicate key')) {
          console.error(`❌ Error marking NFT dirty ${nft.id}:`, dirtyError);
        }

        if (nft.poa_v2 !== null) {
          preservedPOACount++;
        }

        migrationResults.push({
          nft_id: nft.id,
          name: nft.name,
          collection: nft.collection_name,
          h2h_events: voteEvents.length,
          slider_events: sliderEvents.length,
          existing_poa_v2: nft.poa_v2,
          status: 'success'
        });

        successCount++;
        console.log(`✅ Migrated ${nft.collection_name} ${nft.name}: ${voteEvents.length} H2H + ${sliderEvents.length} sliders${nft.poa_v2 ? ` (preserved POA: ${nft.poa_v2})` : ''}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Migration error for NFT ${nft.id} (${nft.name}):`, error);
        migrationResults.push({
          nft_id: nft.id,
          name: nft.name,
          collection: nft.collection_name,
          status: 'error',
          error: errorMessage
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Priority migration complete: ${successCount} success, ${errorCount} errors`,
      data: {
        migrated: successCount,
        errors: errorCount,
        preserved_poa_scores: preservedPOACount,
        total_processed: nftsToMigrate.length,
        collections_processed: PRIORITY_COLLECTIONS,
        results: migrationResults.slice(0, 10) // Sample results
      }
    });

  } catch (error) {
    console.error('❌ Priority migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get status of priority collections
    const { data: priorityNFTs, error } = await supabase
      .from('nfts')
      .select('collection_name, total_votes, poa_v2')
      .gt('total_votes', 4)
      .in('collection_name', PRIORITY_COLLECTIONS);

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Analyze by collection
    const collectionStats = PRIORITY_COLLECTIONS.map(collection => {
      const nfts = priorityNFTs?.filter(nft => nft.collection_name === collection) || [];
      const withPOA = nfts.filter(nft => nft.poa_v2 !== null);
      const withoutPOA = nfts.filter(nft => nft.poa_v2 === null);

      return {
        collection,
        total_nfts: nfts.length,
        with_poa_v2: withPOA.length,
        without_poa_v2: withoutPOA.length,
        avg_votes: nfts.length > 0 ? Math.round(nfts.reduce((sum, nft) => sum + nft.total_votes, 0) / nfts.length) : 0
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Priority collections analysis',
      data: {
        priority_collections: PRIORITY_COLLECTIONS,
        collection_stats: collectionStats,
        total_summary: {
          total_nfts: priorityNFTs?.length || 0,
          with_poa_v2: priorityNFTs?.filter(nft => nft.poa_v2 !== null).length || 0,
          without_poa_v2: priorityNFTs?.filter(nft => nft.poa_v2 === null).length || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Priority collections status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

