import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_size = 50, dry_run = false } = body;

    console.log(`🔄 Starting historical data migration (batch_size: ${batch_size}, dry_run: ${dry_run})`);

    // 1. Get NFTs that need migration (have votes but no nft_stats)
    const { data: candidateNFTs, error: candidatesError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes')
      .gt('total_votes', 4)
      .limit(batch_size);

    if (candidatesError) {
      return NextResponse.json({ success: false, error: candidatesError.message });
    }

    if (!candidateNFTs || candidateNFTs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No NFTs found that need migration',
        data: { migrated: 0 }
      });
    }

    // 2. Check which already have nft_stats
    const nftIds = candidateNFTs.map(nft => nft.id);
    const { data: existingStats } = await supabase
      .from('nft_stats')
      .select('nft_id')
      .in('nft_id', nftIds);

    const existingStatsIds = new Set(existingStats?.map(s => s.nft_id) || []);
    const nftsToMigrate = candidateNFTs.filter(nft => !existingStatsIds.has(nft.id));

    console.log(`📊 Found ${nftsToMigrate.length} NFTs that need migration`);

    if (dry_run) {
      return NextResponse.json({
        success: true,
        message: `DRY RUN: Would migrate ${nftsToMigrate.length} NFTs`,
        data: {
          would_migrate: nftsToMigrate.length,
          sample_nfts: nftsToMigrate.slice(0, 5).map(nft => ({
            id: nft.id,
            name: nft.name,
            total_votes: nft.total_votes
          }))
        }
      });
    }

    // 3. Migrate each NFT's historical data
    const migrationResults = [];
    let successCount = 0;
    let errorCount = 0;

    for (const nft of nftsToMigrate) {
      try {
        console.log(`🔄 Migrating NFT: ${nft.name} (${nft.total_votes} votes)`);

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
            // Check engagement_data for super_vote flag
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

        // Insert events into new tables
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
            priority: 'medium',
            reason: 'historical_migration'
          });

        if (dirtyError && !dirtyError.message.includes('duplicate key')) {
          console.error(`❌ Error marking NFT dirty ${nft.id}:`, dirtyError);
        }

        migrationResults.push({
          nft_id: nft.id,
          name: nft.name,
          h2h_events: voteEvents.length,
          slider_events: sliderEvents.length,
          status: 'success'
        });

        successCount++;
        console.log(`✅ Migrated ${nft.name}: ${voteEvents.length} H2H + ${sliderEvents.length} sliders`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Migration error for NFT ${nft.id} (${nft.name}):`, error);
        migrationResults.push({
          nft_id: nft.id,
          name: nft.name,
          status: 'error',
          error: errorMessage
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${successCount} success, ${errorCount} errors`,
      data: {
        migrated: successCount,
        errors: errorCount,
        total_processed: nftsToMigrate.length,
        results: migrationResults
      }
    });

  } catch (error) {
    console.error('❌ Historical migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
