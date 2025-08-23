import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const nft_id = url.searchParams.get('nft_id') || 'fae674db-eaff-4552-8aba-64f103b5e2ac';

    console.log(`🧪 Testing migration for NFT: ${nft_id}`);

    // 1. Get NFT info
    const { data: nft, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes')
      .eq('id', nft_id)
      .single();

    if (nftError || !nft) {
      return NextResponse.json({
        success: false,
        error: `NFT not found: ${nftError?.message || 'No data'}`
      });
    }

    // 2. Check if already has nft_stats
    const { data: existingStats } = await supabase
      .from('nft_stats')
      .select('*')
      .eq('nft_id', nft_id)
      .single();

    // 3. Get historical votes
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('id, user_id, nft_a_id, nft_b_id, winner_id, vote_type, vote_type_v2, slider_value, created_at, engagement_data')
      .or(`nft_a_id.eq.${nft_id},nft_b_id.eq.${nft_id}`)
      .order('created_at', { ascending: true })
      .limit(10);

    if (votesError) {
      return NextResponse.json({
        success: false,
        error: `Error fetching votes: ${votesError.message}`
      });
    }

    // 4. Analyze votes
    const voteAnalysis = {
      total_votes: votes?.length || 0,
      h2h_votes: 0,
      slider_votes: 0,
      vote_types: new Set(),
      vote_types_v2: new Set(),
      sample_votes: [] as any[]
    };

    for (const vote of votes || []) {
      voteAnalysis.vote_types.add(vote.vote_type);
      voteAnalysis.vote_types_v2.add(vote.vote_type_v2);
      
      if (vote.vote_type_v2 === 'slider') {
        voteAnalysis.slider_votes++;
      } else if (vote.nft_b_id !== null) {
        voteAnalysis.h2h_votes++;
      }

      if (voteAnalysis.sample_votes.length < 3) {
        voteAnalysis.sample_votes.push({
          vote_type: vote.vote_type,
          vote_type_v2: vote.vote_type_v2,
          has_nft_b: vote.nft_b_id !== null,
          slider_value: vote.slider_value,
          super_vote: vote.engagement_data?.super_vote,
          created_at: vote.created_at
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        nft: {
          id: nft.id,
          name: nft.name,
          collection_name: nft.collection_name,
          total_votes: nft.total_votes
        },
        existing_stats: existingStats ? 'Yes' : 'No',
        vote_analysis: {
          ...voteAnalysis,
          vote_types: Array.from(voteAnalysis.vote_types),
          vote_types_v2: Array.from(voteAnalysis.vote_types_v2)
        }
      }
    });

  } catch (error) {
    console.error('❌ Test migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

