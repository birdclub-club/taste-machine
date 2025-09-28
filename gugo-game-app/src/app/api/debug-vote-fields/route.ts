import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking actual vote field values...');

    // Get a specific vote to check field values
    const { data: sampleVote, error } = await supabase
      .from('votes')
      .select('*')
      .eq('vote_type_v2', 'same_coll')
      .limit(1)
      .single();

    if (error || !sampleVote) {
      return NextResponse.json({ success: false, error: 'No vote found' });
    }

    // Check all fields and their actual values
    const fieldCheck = {
      id: sampleVote.id,
      vote_type: sampleVote.vote_type,
      vote_type_v2: sampleVote.vote_type_v2,
      user_id: sampleVote.user_id,
      nft_a_id: sampleVote.nft_a_id,
      nft_b_id: sampleVote.nft_b_id,
      winner_id: sampleVote.winner_id,
      slider_value: sampleVote.slider_value,
      elo_pre_a: sampleVote.elo_pre_a,
      elo_pre_b: sampleVote.elo_pre_b,
      created_at: sampleVote.created_at,
      // Check data types
      user_id_type: typeof sampleVote.user_id,
      nft_a_id_type: typeof sampleVote.nft_a_id,
      nft_b_id_type: typeof sampleVote.nft_b_id,
      winner_id_type: typeof sampleVote.winner_id,
      elo_pre_a_type: typeof sampleVote.elo_pre_a,
      elo_pre_b_type: typeof sampleVote.elo_pre_b
    };

    return NextResponse.json({
      success: true,
      data: {
        sample_vote: fieldCheck,
        all_fields: Object.keys(sampleVote),
        migration_ready: {
          has_user_id: !!sampleVote.user_id,
          has_nft_ids: !!(sampleVote.nft_a_id && sampleVote.nft_b_id),
          has_winner_id: !!sampleVote.winner_id,
          has_vote_type_v2: !!sampleVote.vote_type_v2,
          has_elo_values: !!(sampleVote.elo_pre_a !== null && sampleVote.elo_pre_b !== null)
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug vote fields error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

