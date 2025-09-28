import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { nft_a_id, nft_b_id, user_id } = await request.json();
    
    if (!nft_a_id || !nft_b_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing nft_a_id or nft_b_id' 
      });
    }

    console.log(`🔍 Checking if pair has been seen recently: ${nft_a_id} vs ${nft_b_id}`);

    // Create consistent pair key
    const pairKey = [nft_a_id, nft_b_id].sort().join('|');

    // Check if this exact pair has been used recently (last 1000 votes)
    const { data: recentPairs, error } = await supabase
      .from('votes')
      .select('id, created_at')
      .or(`and(nft_a_id.eq.${nft_a_id},nft_b_id.eq.${nft_b_id}),and(nft_a_id.eq.${nft_b_id},nft_b_id.eq.${nft_a_id})`)
      .order('created_at', { ascending: false })
      .limit(5); // Check last 5 occurrences

    if (error) {
      console.error('Error checking recent pairs:', error);
      return NextResponse.json({ 
        success: true, // Don't block on error
        is_recent: false,
        error: 'Could not check recent pairs'
      });
    }

    const isRecent = recentPairs && recentPairs.length > 0;
    const lastSeen = isRecent ? recentPairs[0].created_at : null;

    // If seen recently, calculate time since last occurrence
    let timeSinceLastSeen = null;
    if (lastSeen) {
      const lastSeenTime = new Date(lastSeen);
      const now = new Date();
      timeSinceLastSeen = Math.floor((now.getTime() - lastSeenTime.getTime()) / 1000 / 60); // minutes
    }

    return NextResponse.json({
      success: true,
      is_recent: isRecent,
      pair_key: pairKey,
      occurrences: recentPairs?.length || 0,
      last_seen: lastSeen,
      minutes_since_last_seen: timeSinceLastSeen,
      recommendation: isRecent && timeSinceLastSeen && timeSinceLastSeen < 60 
        ? 'SKIP - Too recent (less than 1 hour ago)'
        : 'OK - Can use this pair'
    });

  } catch (error) {
    console.error('❌ Prevent duplicate pairs error:', error);
    return NextResponse.json({ 
      success: true, // Don't block on error
      is_recent: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get statistics about recent pair usage
    const { data: recentVotes, error } = await supabase
      .from('votes')
      .select('nft_a_id, nft_b_id, created_at')
      .not('nft_b_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Analyze pair frequency
    const pairCounts = new Map<string, number>();
    recentVotes?.forEach(vote => {
      if (vote.nft_a_id && vote.nft_b_id) {
        const pairKey = [vote.nft_a_id, vote.nft_b_id].sort().join('|');
        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
      }
    });

    const duplicatePairs = Array.from(pairCounts.entries())
      .filter(([_, count]) => count > 1)
      .length;

    return NextResponse.json({
      success: true,
      stats: {
        total_recent_votes: recentVotes?.length || 0,
        unique_pairs: pairCounts.size,
        duplicate_pairs: duplicatePairs,
        duplicate_rate: pairCounts.size > 0 ? ((duplicatePairs / pairCounts.size) * 100).toFixed(1) + '%' : '0%'
      },
      message: 'Use POST with nft_a_id and nft_b_id to check if a specific pair is recent'
    });

  } catch (error) {
    console.error('❌ Get duplicate pairs stats error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

