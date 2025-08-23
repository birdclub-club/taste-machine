import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const userId = searchParams.get('user_id');
    
    console.log(`🔍 Checking last ${limit} votes for repeat matchups...`);

    // Get more recent votes to find patterns
    let query = supabase
      .from('votes')
      .select('id, user_id, nft_a_id, nft_b_id, vote_type_v2, created_at')
      .not('nft_b_id', 'is', null) // Only head-to-head votes (not sliders)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by specific user if provided
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: recentVotes, error: votesError } = await query;

    if (votesError) {
      return NextResponse.json({ 
        success: false, 
        error: votesError.message 
      });
    }

    // Analyze for duplicate pairs
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
      }))
      .sort((a, b) => b.occurrence_count - a.occurrence_count); // Sort by most duplicates first

    // Get NFT names for the duplicate pairs
    const duplicatePairsWithNames = await Promise.all(
      duplicatePairs.slice(0, 10).map(async (duplicate) => { // Limit to top 10 for performance
        const [nftAId, nftBId] = duplicate.pair_key.split('|');
        
        const [nftAResult, nftBResult] = await Promise.all([
          supabase.from('nfts').select('name, collection_name').eq('id', nftAId).single(),
          supabase.from('nfts').select('name, collection_name').eq('id', nftBId).single()
        ]);

        return {
          ...duplicate,
          nft_a: nftAResult.data ? `${nftAResult.data.name} (${nftAResult.data.collection_name})` : 'Unknown',
          nft_b: nftBResult.data ? `${nftBResult.data.name} (${nftBResult.data.collection_name})` : 'Unknown',
          time_span: duplicate.votes.length > 1 ? {
            first_occurrence: duplicate.votes[duplicate.votes.length - 1].created_at,
            last_occurrence: duplicate.votes[0].created_at,
            votes_between: duplicate.votes.length - 1
          } : null
        };
      })
    );

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

    // Convert user patterns to serializable format and find users with most duplicates
    const userAnalysis = Array.from(userVotePatterns.entries())
      .map(([userId, pattern]) => ({
        user_id: userId,
        total_votes: pattern.total_votes,
        unique_pairs_count: pattern.unique_pairs.size,
        duplicate_pairs_count: pattern.duplicate_pairs.length,
        duplicate_rate: pattern.total_votes > 0 ? (pattern.duplicate_pairs.length / pattern.total_votes * 100).toFixed(1) : '0',
        duplicate_pairs: pattern.duplicate_pairs.slice(0, 5) // Limit to first 5 for readability
      }))
      .sort((a, b) => b.duplicate_pairs_count - a.duplicate_pairs_count); // Sort by most duplicates

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      search_parameters: {
        votes_analyzed: recentVotes?.length || 0,
        limit_used: limit,
        user_filter: userId || 'all_users'
      },
      analysis: {
        total_unique_pairs: pairCounts.size,
        duplicate_pairs_found: duplicatePairs.length,
        worst_offenders: duplicatePairsWithNames,
        user_patterns: userAnalysis.slice(0, 10), // Top 10 users with most duplicates
        system_health: {
          duplicate_rate: recentVotes && recentVotes.length > 0 
            ? ((duplicatePairs.reduce((sum, pair) => sum + pair.occurrence_count - 1, 0) / recentVotes.length) * 100).toFixed(2) + '%'
            : '0%',
          status: duplicatePairs.length > 0 
            ? "⚠️ Duplicate pairs detected in extended history"
            : "✅ No duplicate pairs found"
        }
      },
      recommendations: duplicatePairs.length > 0 ? [
        `Found ${duplicatePairs.length} duplicate pairs in last ${limit} votes`,
        "Recent pairs tracking may have insufficient memory",
        "Consider increasing MAX_RECENT_PAIRS from 1500 to 3000+",
        "Check if preloader cache is bypassing recent pairs tracking"
      ] : [
        "No duplicate pairs found in extended history",
        "Matchup system appears to be working correctly"
      ]
    });

  } catch (error) {
    console.error('❌ Matchup history debug error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

