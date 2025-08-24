import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet') || '0xd593c708833d606f28E81a147FD33edFeAdE0Aa9';
    
    // Get user record
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Count actual votes in votes table
    const { count: votesTableCount } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Get oldest and newest votes
    const { data: oldestVote } = await supabase
      .from('votes')
      .select('created_at, vote_type_v2')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const { data: newestVote } = await supabase
      .from('votes')
      .select('created_at, vote_type_v2')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check if there are other vote-related tables
    const { data: allTables } = await supabase
      .rpc('get_table_names')
      .single();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        wallet: user.wallet_address,
        total_votes_claimed: user.total_votes,
        xp: user.xp,
        created_at: user.created_at,
        last_vote_at: user.last_vote_at
      },
      votes_table: {
        actual_count: votesTableCount || 0,
        oldest_vote: oldestVote,
        newest_vote: newestVote
      },
      discrepancy: {
        claimed_vs_actual: (user.total_votes || 0) - (votesTableCount || 0),
        percentage_missing: votesTableCount ? 
          Math.round(((user.total_votes - votesTableCount) / user.total_votes) * 100) : 100
      }
    });

  } catch (error) {
    console.error('Error in debug vote discrepancy:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
