import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { batch_size = 100, start_offset = 0 } = await request.json();
    
    console.log(`🐻 Starting BEARISH migration - batch size: ${batch_size}, offset: ${start_offset}`);

    // Step 1: Get BEARISH NFTs with votes (second most active collection)
    const { data: bearishNFTs, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, token_id, total_votes, current_elo, slider_average, slider_count')
      .eq('collection_name', 'BEARISH')
      .gt('total_votes', 0) // Only NFTs with votes
      .order('total_votes', { ascending: false }) // Start with most voted
      .range(start_offset, start_offset + batch_size - 1);

    if (nftError) {
      console.error('❌ Error fetching BEARISH NFTs:', nftError);
      return NextResponse.json({ success: false, error: nftError.message });
    }

    if (!bearishNFTs || bearishNFTs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No more BEARISH NFTs to migrate',
        migrated: 0,
        total_processed: start_offset
      });
    }

    console.log(`📦 Found ${bearishNFTs.length} BEARISH NFTs to migrate`);

    // Step 2: For each NFT, get its voting history and migrate to events
    let migratedCount = 0;
    const migrationResults = [];

    for (const nft of bearishNFTs) {
      try {
        console.log(`🔄 Migrating NFT: ${nft.name} (${nft.total_votes} votes)`);

        // Get all votes for this NFT (both as nft_a and nft_b)
        const { data: votes, error: votesError } = await supabase
          .from('votes')
          .select('*')
          .or(`nft_a_id.eq.${nft.id},nft_b_id.eq.${nft.id}`)
          .order('created_at', { ascending: true });

        if (votesError) {
          console.error(`❌ Error fetching votes for ${nft.name}:`, votesError);
          continue;
        }

        // Step 3: Migrate votes to events tables
        const voteEvents = [];
        const sliderEvents = [];
        const fireEvents = [];

        for (const vote of votes || []) {
          // Determine if this NFT won or lost
          const isNftA = vote.nft_a_id === nft.id;
          const isNftB = vote.nft_b_id === nft.id;
          
          if (!isNftA && !isNftB) continue; // Skip if NFT not involved

          // Handle head-to-head votes
          if (vote.vote_type_v2 === 'same_coll' || vote.vote_type_v2 === 'cross_coll') {
            const winner_id = vote.winner_id;
            const nft_won = winner_id === nft.id;
            
            voteEvents.push({
              voter_id: String(vote.user_id),
              nft_a_id: String(vote.nft_a_id),
              nft_b_id: String(vote.nft_b_id),
              winner_id: String(winner_id),
              vote_type: vote.vote_type_v2,
              elo_pre_a: 1500, // Default Elo - historical votes don't have pre-vote Elo
              elo_pre_b: 1500, // Default Elo - historical votes don't have pre-vote Elo
              created_at: vote.created_at
            });
          }

          // Handle slider votes
          if (vote.vote_type_v2 === 'slider' && vote.slider_value !== null) {
            sliderEvents.push({
              voter_id: String(vote.user_id),
              nft_id: String(vote.nft_a_id), // Slider votes are always on nft_a
              raw_score: parseFloat(vote.slider_value),
              created_at: vote.created_at
            });
          }

          // Handle FIRE votes (super votes)
          if (vote.vote_type === 'super' || vote.vote_type_v2?.includes('fire')) {
            fireEvents.push({
              voter_id: String(vote.user_id),
              nft_id: String(isNftA ? vote.nft_a_id : vote.nft_b_id),
              created_at: vote.created_at
            });
          }
        }

        // Step 4: Insert events into new tables
        let insertedEvents = 0;

        if (voteEvents.length > 0) {
          const { error: voteInsertError } = await supabase
            .from('votes_events')
            .insert(voteEvents);
          
          if (voteInsertError) {
            console.error(`❌ Error inserting vote events for ${nft.name}:`, voteInsertError);
          } else {
            insertedEvents += voteEvents.length;
          }
        }

        if (sliderEvents.length > 0) {
          const { error: sliderInsertError } = await supabase
            .from('sliders_events')
            .insert(sliderEvents);
          
          if (sliderInsertError) {
            console.error(`❌ Error inserting slider events for ${nft.name}:`, sliderInsertError);
          } else {
            insertedEvents += sliderEvents.length;
          }
        }

        if (fireEvents.length > 0) {
          const { error: fireInsertError } = await supabase
            .from('fires_events')
            .insert(fireEvents);
          
          if (fireInsertError) {
            console.error(`❌ Error inserting fire events for ${nft.name}:`, fireInsertError);
          } else {
            insertedEvents += fireEvents.length;
          }
        }

        migrationResults.push({
          nft_id: nft.id,
          nft_name: nft.name,
          total_votes: nft.total_votes,
          vote_events: voteEvents.length,
          slider_events: sliderEvents.length,
          fire_events: fireEvents.length,
          inserted_events: insertedEvents
        });

        migratedCount++;
        console.log(`✅ Migrated ${nft.name}: ${insertedEvents} events`);

      } catch (nftError) {
        console.error(`❌ Error migrating NFT ${nft.name}:`, nftError);
        migrationResults.push({
          nft_id: nft.id,
          nft_name: nft.name,
          error: nftError instanceof Error ? nftError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `BEARISH migration batch completed`,
      data: {
        batch_size,
        start_offset,
        nfts_processed: bearishNFTs.length,
        successfully_migrated: migratedCount,
        next_offset: start_offset + batch_size,
        migration_results: migrationResults,
        summary: {
          total_vote_events: migrationResults.reduce((sum, r) => sum + (r.vote_events || 0), 0),
          total_slider_events: migrationResults.reduce((sum, r) => sum + (r.slider_events || 0), 0),
          total_fire_events: migrationResults.reduce((sum, r) => sum + (r.fire_events || 0), 0),
          total_events_inserted: migrationResults.reduce((sum, r) => sum + (r.inserted_events || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ BEARISH migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

