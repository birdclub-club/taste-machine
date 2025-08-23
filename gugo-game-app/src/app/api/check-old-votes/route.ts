import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking recent votes in OLD votes table...');

    // Get the 10 most recent votes from the old votes table
    const { data: recentOldVotes, error } = await supabase
      .from('votes')
      .select('id, user_id, nft_a_id, nft_b_id, winner_id, vote_type_v2, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      });
    }

    // Get total count of votes table
    const { count: totalVotes } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_votes_in_old_table: totalVotes,
      recent_votes_in_old_table: recentOldVotes || [],
      message: "If you see recent votes here, it means new votes are still going to the old table instead of event tables"
    });

  } catch (error) {
    console.error('❌ Check old votes error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
