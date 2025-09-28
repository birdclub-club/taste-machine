import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { nft_a_id, nft_b_id, check_only = false } = await request.json();
    
    if (!nft_a_id || !nft_b_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing nft_a_id or nft_b_id' 
      });
    }

    console.log(`🔍 Checking duplicate status: ${nft_a_id} vs ${nft_b_id}`);

    // Create consistent pair key (always sort IDs for consistency)
    const [id1, id2] = [nft_a_id, nft_b_id].sort();
    const pairKey = `${id1}|${id2}`;

    // Check if this exact pair has been used recently (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: recentPairs, error } = await supabase
      .from('votes')
      .select('id, created_at, user_id')
      .or(`and(nft_a_id.eq.${id1},nft_b_id.eq.${id2}),and(nft_a_id.eq.${id2},nft_b_id.eq.${id1})`)
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error checking recent pairs:', error);
      return NextResponse.json({ 
        success: true, // Don't block on error
        is_duplicate: false,
        error: 'Could not check recent pairs'
      });
    }

    const isDuplicate = recentPairs && recentPairs.length > 0;
    const lastUsed = isDuplicate ? recentPairs[0].created_at : null;
    
    // Calculate time since last use
    let minutesSinceLastUse = null;
    if (lastUsed) {
      const lastUsedTime = new Date(lastUsed);
      const now = new Date();
      minutesSinceLastUse = Math.floor((now.getTime() - lastUsedTime.getTime()) / 1000 / 60);
    }

    // If this is just a check, return the status
    if (check_only) {
      return NextResponse.json({
        success: true,
        is_duplicate: isDuplicate,
        pair_key: pairKey,
        last_used: lastUsed,
        minutes_since_last_use: minutesSinceLastUse,
        recent_occurrences: recentPairs?.length || 0,
        recommendation: isDuplicate 
          ? `SKIP - Used ${minutesSinceLastUse} minutes ago (cooldown: 120 min)`
          : 'OK - Can use this pair'
      });
    }

    // If not a duplicate, we can track this pair for future prevention
    if (!isDuplicate) {
      // Note: The actual vote will be recorded when the user submits it
      // This endpoint just checks and doesn't record anything
      console.log(`✅ Pair ${pairKey} is available (not used in last 2 hours)`);
    } else {
      console.log(`❌ Pair ${pairKey} is duplicate (used ${minutesSinceLastUse} minutes ago)`);
    }

    return NextResponse.json({
      success: true,
      is_duplicate: isDuplicate,
      pair_key: pairKey,
      last_used: lastUsed,
      minutes_since_last_use: minutesSinceLastUse,
      recent_occurrences: recentPairs?.length || 0,
      cooldown_remaining: isDuplicate && minutesSinceLastUse ? Math.max(0, 120 - minutesSinceLastUse) : 0
    });

  } catch (error) {
    console.error('❌ Matchup duplicate check error:', error);
    return NextResponse.json({ 
      success: true, // Don't block on error
      is_duplicate: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current duplicate statistics
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: recentVotes, error } = await supabase
      .from('votes')
      .select('nft_a_id, nft_b_id, created_at')
      .not('nft_b_id', 'is', null)
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Analyze current pair usage in last 2 hours
    const activePairs = new Set<string>();
    recentVotes?.forEach(vote => {
      if (vote.nft_a_id && vote.nft_b_id) {
        const [id1, id2] = [vote.nft_a_id, vote.nft_b_id].sort();
        activePairs.add(`${id1}|${id2}`);
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        total_votes_last_2h: recentVotes?.length || 0,
        unique_pairs_last_2h: activePairs.size,
        cooldown_period: '2 hours',
        system_status: 'System-wide duplicate prevention active'
      },
      usage: {
        endpoint: 'POST with nft_a_id and nft_b_id to check if pair is duplicate',
        parameters: {
          nft_a_id: 'string - First NFT ID',
          nft_b_id: 'string - Second NFT ID', 
          check_only: 'boolean - If true, only check without any side effects'
        }
      }
    });

  } catch (error) {
    console.error('❌ Get duplicate stats error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

