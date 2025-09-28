import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging matchup system for repeat issues...');

    // Check recent matchups from the old votes table to see patterns
    const { data: recentVotes, error: votesError } = await supabase
      .from('votes')
      .select('id, user_id, nft_a_id, nft_b_id, vote_type_v2, created_at')
      .not('nft_b_id', 'is', null) // Only head-to-head votes (not sliders)
      .order('created_at', { ascending: false })
      .limit(20);

    if (votesError) {
      return NextResponse.json({ 
        success: false, 
        error: votesError.message 
      });
    }

    // Check for duplicate pairs in recent votes
    const pairCounts = new Map<string, number>();
    const pairDetails = new Map<string, any[]>();
    
    recentVotes?.forEach(vote => {
      if (vote.nft_a_id && vote.nft_b_id) {
        const pairKey = [vote.nft_a_id, vote.nft_b_id].sort().join('|');
        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
        
        if (!pairDetails.has(pairKey)) {
          pairDetails.set(pairKey, []);
        }
        pairDetails.get(pairKey)?.push({
          vote_id: vote.id,
          user_id: vote.user_id,
          created_at: vote.created_at,
          vote_type: vote.vote_type_v2
        });
      }
    });

    // Find duplicate pairs
    const duplicatePairs = Array.from(pairCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([pairKey, count]) => ({
        pair_key: pairKey,
        occurrence_count: count,
        votes: pairDetails.get(pairKey) || []
      }));

    // Get NFT names for the duplicate pairs
    const duplicatePairsWithNames = await Promise.all(
      duplicatePairs.map(async (duplicate) => {
        const [nftAId, nftBId] = duplicate.pair_key.split('|');
        
        const [nftAResult, nftBResult] = await Promise.all([
          supabase.from('nfts').select('name, collection_name').eq('id', nftAId).single(),
          supabase.from('nfts').select('name, collection_name').eq('id', nftBId).single()
        ]);

        return {
          ...duplicate,
          nft_a: nftAResult.data ? `${nftAResult.data.name} (${nftAResult.data.collection_name})` : 'Unknown',
          nft_b: nftBResult.data ? `${nftBResult.data.name} (${nftBResult.data.collection_name})` : 'Unknown'
        };
      })
    );

    // Check which matchup system is being used
    const { data: systemStatus } = await supabase
      .rpc('get_collection_statistics')
      .limit(1);

    // Analyze user-specific patterns
    const userVotePatterns = new Map<string, any>();
    recentVotes?.forEach(vote => {
      if (!userVotePatterns.has(vote.user_id)) {
        userVotePatterns.set(vote.user_id, {
          total_votes: 0,
          unique_pairs: new Set(),
          duplicate_pairs: []
        });
      }
      
      const userPattern = userVotePatterns.get(vote.user_id)!;
      userPattern.total_votes++;
      
      if (vote.nft_a_id && vote.nft_b_id) {
        const pairKey = [vote.nft_a_id, vote.nft_b_id].sort().join('|');
        if (userPattern.unique_pairs.has(pairKey)) {
          userPattern.duplicate_pairs.push({
            pair_key: pairKey,
            vote_id: vote.id,
            created_at: vote.created_at
          });
        } else {
          userPattern.unique_pairs.add(pairKey);
        }
      }
    });

    // Convert user patterns to serializable format
    const userAnalysis = Array.from(userVotePatterns.entries()).map(([userId, pattern]) => ({
      user_id: userId,
      total_votes: pattern.total_votes,
      unique_pairs_count: pattern.unique_pairs.size,
      duplicate_pairs_count: pattern.duplicate_pairs.length,
      duplicate_pairs: pattern.duplicate_pairs
    }));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analysis: {
        total_recent_votes: recentVotes?.length || 0,
        total_unique_pairs: pairCounts.size,
        duplicate_pairs_found: duplicatePairs.length,
        duplicate_pairs: duplicatePairsWithNames,
        user_patterns: userAnalysis,
        system_status: {
          rpc_available: !!systemStatus,
          message: duplicatePairs.length > 0 
            ? "⚠️ Duplicate pairs detected - matchup system may not be preventing repeats properly"
            : "✅ No duplicate pairs in recent votes - system working correctly"
        }
      },
      recommendations: duplicatePairs.length > 0 ? [
        "Check if EnhancedMatchupEngine.trackRecentPair() is being called",
        "Verify recentPairs Set is persisting between requests",
        "Consider increasing MAX_RECENT_PAIRS limit",
        "Check if multiple matchup systems are running simultaneously"
      ] : [
        "Matchup system appears to be working correctly",
        "Continue monitoring for user-reported issues"
      ]
    });

  } catch (error) {
    console.error('❌ Matchup system debug error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

