import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking recent vote activity...');

    // Get current counts
    const [votesResult, slidersResult, firesResult] = await Promise.all([
      supabase.from('votes_events').select('*', { count: 'exact', head: true }),
      supabase.from('sliders_events').select('*', { count: 'exact', head: true }),
      supabase.from('fires_events').select('*', { count: 'exact', head: true })
    ]);

    const currentCounts = {
      votes_events: votesResult.count || 0,
      sliders_events: slidersResult.count || 0,
      fires_events: firesResult.count || 0,
      total_events: (votesResult.count || 0) + (slidersResult.count || 0) + (firesResult.count || 0)
    };

    // Get the 5 most recent events from each table
    const [recentVotes, recentSliders, recentFires] = await Promise.all([
      supabase
        .from('votes_events')
        .select('id, voter_id, nft_a_id, nft_b_id, winner_id, vote_type, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('sliders_events')
        .select('id, voter_id, nft_id, raw_score, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('fires_events')
        .select('id, voter_id, nft_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    // Also check the old votes table for comparison
    const { data: recentOldVotes } = await supabase
      .from('votes')
      .select('id, user_id, nft_a_id, nft_b_id, winner_id, vote_type_v2, slider_score, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      current_counts: currentCounts,
      recent_activity: {
        votes_events: recentVotes.data || [],
        sliders_events: recentSliders.data || [],
        fires_events: recentFires.data || [],
        old_votes_table: recentOldVotes || []
      },
      instructions: {
        message: "Submit a vote through the UI, then call this endpoint again to see if it appears in the event tables",
        expected_behavior: "New votes should appear in votes_events or sliders_events, NOT in the old votes table"
      }
    });

  } catch (error) {
    console.error('❌ Vote tracking error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'reset_baseline') {
      // Store current counts as baseline for comparison
      const [votesResult, slidersResult, firesResult] = await Promise.all([
        supabase.from('votes_events').select('*', { count: 'exact', head: true }),
        supabase.from('sliders_events').select('*', { count: 'exact', head: true }),
        supabase.from('fires_events').select('*', { count: 'exact', head: true })
      ]);

      const baseline = {
        votes_events: votesResult.count || 0,
        sliders_events: slidersResult.count || 0,
        fires_events: firesResult.count || 0,
        timestamp: new Date().toISOString()
      };

      return NextResponse.json({
        success: true,
        message: 'Baseline reset - now submit votes and check for changes',
        baseline: baseline
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown action. Use {"action": "reset_baseline"} to reset baseline.'
    });

  } catch (error) {
    console.error('❌ Vote tracking POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

