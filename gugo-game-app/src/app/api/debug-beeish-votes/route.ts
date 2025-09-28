import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🐝 Debugging BEEISH vote structure...');

    // Get a sample BEEISH NFT with votes
    const { data: sampleNFT, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes')
      .eq('collection_name', 'BEEISH')
      .gt('total_votes', 0)
      .order('total_votes', { ascending: false })
      .limit(1)
      .single();

    if (nftError || !sampleNFT) {
      return NextResponse.json({ success: false, error: 'No BEEISH NFT found' });
    }

    console.log(`🔍 Analyzing votes for: ${sampleNFT.name} (${sampleNFT.total_votes} votes)`);

    // Get all votes involving this NFT
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('*')
      .or(`nft_a_id.eq.${sampleNFT.id},nft_b_id.eq.${sampleNFT.id}`)
      .order('created_at', { ascending: true })
      .limit(10);

    if (votesError) {
      return NextResponse.json({ success: false, error: votesError.message });
    }

    // Analyze vote structure
    const voteAnalysis = votes?.map(vote => ({
      id: vote.id,
      vote_type: vote.vote_type,
      vote_type_v2: vote.vote_type_v2,
      nft_a_id: vote.nft_a_id,
      nft_b_id: vote.nft_b_id,
      winner_id: vote.winner_id,
      slider_value: vote.slider_value,
      user_id: vote.user_id,
      created_at: vote.created_at,
      elo_pre_a: vote.elo_pre_a,
      elo_pre_b: vote.elo_pre_b,
      is_nft_a: vote.nft_a_id === sampleNFT.id,
      is_nft_b: vote.nft_b_id === sampleNFT.id,
      nft_won: vote.winner_id === sampleNFT.id
    }));

    // Check vote type distribution
    const voteTypeDistribution = votes?.reduce((acc, vote) => {
      const type = vote.vote_type_v2 || vote.vote_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check for missing fields
    const fieldAnalysis = {
      has_vote_type_v2: votes?.filter(v => v.vote_type_v2).length || 0,
      has_vote_type: votes?.filter(v => v.vote_type).length || 0,
      has_winner_id: votes?.filter(v => v.winner_id).length || 0,
      has_slider_value: votes?.filter(v => v.slider_value !== null).length || 0,
      has_elo_pre_a: votes?.filter(v => v.elo_pre_a !== null).length || 0,
      has_elo_pre_b: votes?.filter(v => v.elo_pre_b !== null).length || 0,
      total_votes: votes?.length || 0
    };

    return NextResponse.json({
      success: true,
      data: {
        sample_nft: sampleNFT,
        vote_analysis: voteAnalysis,
        vote_type_distribution: voteTypeDistribution,
        field_analysis: fieldAnalysis,
        migration_issues: {
          missing_vote_type_v2: fieldAnalysis.total_votes - fieldAnalysis.has_vote_type_v2,
          missing_winner_id: fieldAnalysis.total_votes - fieldAnalysis.has_winner_id,
          missing_elo_fields: fieldAnalysis.total_votes - Math.min(fieldAnalysis.has_elo_pre_a, fieldAnalysis.has_elo_pre_b)
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug BEEISH votes error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

