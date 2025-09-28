import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { batch_size = 100, start_offset = 0 } = await request.json();
    
    console.log(`🎌 Starting RUYUI migration - batch size: ${batch_size}, offset: ${start_offset}`);

    // Step 1: Get RUYUI NFTs with votes
    const { data: ruyuiNFTs, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, token_id, total_votes, current_elo, slider_average, slider_count')
      .eq('collection_name', 'RUYUI')
      .gt('total_votes', 0) // Only NFTs with votes
      .order('total_votes', { ascending: false }) // Start with most voted
      .range(start_offset, start_offset + batch_size - 1);

    if (nftError) {
      console.error('❌ Error fetching RUYUI NFTs:', nftError);
      return NextResponse.json({ success: false, error: nftError.message });
    }

    if (!ruyuiNFTs || ruyuiNFTs.length === 0) {
      console.log('✅ No more RUYUI NFTs to migrate');
      return NextResponse.json({ 
        success: true, 
        message: 'RUYUI migration complete - no more NFTs to process',
        nfts_processed: 0,
        events_migrated: 0
      });
    }

    console.log(`📦 Processing ${ruyuiNFTs.length} RUYUI NFTs...`);

    // Step 2: Process each NFT and extract vote events
    const voteEvents: any[] = [];
    const sliderEvents: any[] = [];
    const fireEvents: any[] = [];

    for (const nft of ruyuiNFTs) {
      console.log(`🔍 Processing ${nft.name} (${nft.total_votes} votes)...`);

      // Get all votes involving this NFT
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .or(`nft_a_id.eq.${nft.id},nft_b_id.eq.${nft.id}`)
        .order('created_at', { ascending: true });

      if (votesError) {
        console.error(`❌ Error fetching votes for ${nft.name}:`, votesError);
        continue;
      }

      if (votes && votes.length > 0) {
        console.log(`📊 Found ${votes.length} votes for ${nft.name}`);

        for (const vote of votes) {
          // Handle head-to-head votes
          if (vote.vote_type_v2 === 'same_coll' || vote.vote_type_v2 === 'cross_coll') {
            const winner_id = vote.winner_id;
            
            voteEvents.push({
              voter_id: String(vote.user_id),
              nft_a_id: String(vote.nft_a_id),
              nft_b_id: String(vote.nft_b_id),
              winner_id: String(winner_id),
              vote_type: vote.vote_type_v2,
              elo_pre_a: 1500, // Default Elo (no historical Elo data in votes table)
              elo_pre_b: 1500, // Default Elo
              created_at: vote.created_at
            });
          }

          // Handle slider votes
          if (vote.slider_score && vote.slider_score > 0) {
            sliderEvents.push({
              voter_id: String(vote.user_id),
              nft_id: String(vote.nft_a_id || vote.nft_b_id), // Use whichever NFT was rated
              score: parseFloat(vote.slider_score),
              created_at: vote.created_at
            });
          }

          // Handle fire votes (if any)
          if (vote.fire_count && vote.fire_count > 0) {
            fireEvents.push({
              voter_id: String(vote.user_id),
              nft_id: String(vote.nft_a_id || vote.nft_b_id),
              fire_count: parseInt(vote.fire_count),
              created_at: vote.created_at
            });
          }
        }
      }
    }

    // Step 3: Insert events into new tables
    let totalEvents = 0;

    if (voteEvents.length > 0) {
      const { error: voteError } = await supabase
        .from('votes_events')
        .insert(voteEvents);

      if (voteError) {
        console.error('❌ Error inserting vote events:', voteError);
        return NextResponse.json({ success: false, error: voteError.message });
      }
      totalEvents += voteEvents.length;
      console.log(`✅ Inserted ${voteEvents.length} vote events`);
    }

    if (sliderEvents.length > 0) {
      const { error: sliderError } = await supabase
        .from('sliders_events')
        .insert(sliderEvents);

      if (sliderError) {
        console.error('❌ Error inserting slider events:', sliderError);
        return NextResponse.json({ success: false, error: sliderError.message });
      }
      totalEvents += sliderEvents.length;
      console.log(`✅ Inserted ${sliderEvents.length} slider events`);
    }

    if (fireEvents.length > 0) {
      const { error: fireError } = await supabase
        .from('fires_events')
        .insert(fireEvents);

      if (fireError) {
        console.error('❌ Error inserting fire events:', fireError);
        return NextResponse.json({ success: false, error: fireError.message });
      }
      totalEvents += fireEvents.length;
      console.log(`✅ Inserted ${fireEvents.length} fire events`);
    }

    console.log(`🎌 RUYUI batch complete: ${ruyuiNFTs.length} NFTs → ${totalEvents} events`);

    return NextResponse.json({
      success: true,
      nfts_processed: ruyuiNFTs.length,
      events_migrated: totalEvents,
      vote_events: voteEvents.length,
      slider_events: sliderEvents.length,
      fire_events: fireEvents.length,
      next_offset: start_offset + ruyuiNFTs.length
    });

  } catch (error) {
    console.error('❌ RUYUI migration error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

