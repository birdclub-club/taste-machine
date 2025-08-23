import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Checking duplicate prevention system status...');

    // Get recent voting activity (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: recentVotes, error } = await supabase
      .from('votes')
      .select('nft_a_id, nft_b_id, created_at, user_id')
      .not('nft_b_id', 'is', null)
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Analyze duplicate patterns
    const pairCounts = new Map<string, number>();
    const pairUsers = new Map<string, Set<string>>();
    const userVoteCounts = new Map<string, number>();

    recentVotes?.forEach(vote => {
      if (vote.nft_a_id && vote.nft_b_id) {
        // Create consistent pair key
        const [id1, id2] = [vote.nft_a_id, vote.nft_b_id].sort();
        const pairKey = `${id1}|${id2}`;
        
        // Count pair occurrences
        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
        
        // Track users for each pair
        if (!pairUsers.has(pairKey)) {
          pairUsers.set(pairKey, new Set());
        }
        pairUsers.get(pairKey)?.add(vote.user_id);
        
        // Count votes per user
        userVoteCounts.set(vote.user_id, (userVoteCounts.get(vote.user_id) || 0) + 1);
      }
    });

    // Find duplicate pairs (used more than once)
    const duplicatePairs = Array.from(pairCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([pairKey, count]) => ({
        pair_key: pairKey,
        occurrences: count,
        unique_users: pairUsers.get(pairKey)?.size || 0
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    // Calculate system health metrics
    const totalPairs = pairCounts.size;
    const duplicateCount = duplicatePairs.length;
    const duplicateRate = totalPairs > 0 ? (duplicateCount / totalPairs * 100) : 0;
    
    // User activity analysis
    const activeUsers = Array.from(userVoteCounts.entries())
      .map(([userId, voteCount]) => ({
        user_id: userId.substring(0, 8) + '...', // Truncate for privacy
        vote_count: voteCount
      }))
      .sort((a, b) => b.vote_count - a.vote_count);

    // System status assessment
    let systemStatus = 'EXCELLENT';
    let statusMessage = 'Duplicate prevention working perfectly';
    
    if (duplicateRate > 20) {
      systemStatus = 'POOR';
      statusMessage = 'High duplicate rate - system needs attention';
    } else if (duplicateRate > 10) {
      systemStatus = 'FAIR';
      statusMessage = 'Moderate duplicates - system partially working';
    } else if (duplicateRate > 5) {
      systemStatus = 'GOOD';
      statusMessage = 'Low duplicate rate - system mostly working';
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      system_health: {
        status: systemStatus,
        message: statusMessage,
        duplicate_rate: `${duplicateRate.toFixed(1)}%`,
        cooldown_period: '2 hours',
        prevention_method: 'Database-based system-wide tracking'
      },
      metrics: {
        time_window: '2 hours',
        total_votes: recentVotes?.length || 0,
        unique_pairs: totalPairs,
        duplicate_pairs: duplicateCount,
        active_users: activeUsers.length,
        worst_offenders: duplicatePairs.slice(0, 5)
      },
      user_activity: activeUsers.slice(0, 10), // Top 10 most active users
      recommendations: duplicateRate > 5 ? [
        'System-wide duplicate prevention is active',
        `Current duplicate rate: ${duplicateRate.toFixed(1)}% (target: <5%)`,
        'Check if matchup generation systems are using duplicate prevention',
        'Consider clearing preloader cache if duplicates persist'
      ] : [
        'System working optimally',
        'Duplicate prevention successfully reducing repeat matchups',
        'Continue monitoring for any issues'
      ]
    });

  } catch (error) {
    console.error('❌ Duplicate prevention status error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

