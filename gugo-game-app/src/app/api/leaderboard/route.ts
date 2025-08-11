import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔥 NUCLEAR FIRE-First API - FORCING CORRECT ORDER');

              // Call our NEW function (v2 - the correct one!)
          const { data: rawData, error: leaderboardError } = await supabase
            .rpc('get_fire_first_leaderboard_v2', { limit_count: 20 });

    if (leaderboardError) {
      console.error('❌ Function failed:', leaderboardError);
      return NextResponse.json(
        { success: false, error: `Function error: ${leaderboardError.message}` },
        { status: 500 }
      );
    }

    console.log('🔍 RAW DATA FROM FUNCTION:');
    console.log('Total NFTs returned:', rawData?.length);
    console.log('🔥 First 10 raw results:');
    rawData?.slice(0, 10).forEach((nft: any, index: number) => {
      console.log(`  ${index + 1}. ${nft.name} (${nft.collection_name}) - FIRE: ${nft.fire_votes}, Votes: ${nft.total_votes}, POA: ${nft.poa_score}, Elo: ${nft.current_elo}, Position: ${nft.leaderboard_position}`);
    });

    // Special check for Fugger NFTs
    const fuggerNfts = rawData?.filter((nft: any) => nft.collection_name?.toLowerCase().includes('fugz') || nft.name?.toLowerCase().includes('fugger'));
    if (fuggerNfts && fuggerNfts.length > 0) {
      console.log('🚨 FUGGER/FUGZ NFTs FOUND:');
      fuggerNfts.forEach((nft: any) => {
        console.log(`  - ${nft.name} (${nft.collection_name}) - FIRE: ${nft.fire_votes}, Votes: ${nft.total_votes}, POA: ${nft.poa_score}, Elo: ${nft.current_elo}, Wins: ${nft.wins}, Losses: ${nft.losses}`);
      });
    }

    // Force sort in JavaScript to ensure FIRE votes are at the top
    const sortedLeaderboard = [...(rawData || [])].sort((a: any, b: any) => {
      // Primary sort: FIRE votes (descending)
      if (b.fire_votes !== a.fire_votes) {
        return b.fire_votes - a.fire_votes;
      }
      // Secondary sort: POA score (descending)
      if (b.poa_score !== a.poa_score) {
        return b.poa_score - a.poa_score;
      }
      // Tertiary sort: Total votes (descending)
      if (b.total_votes !== a.total_votes) {
        return b.total_votes - a.total_votes;
      }
      // Final tie-breaker: Random
      return Math.random() - 0.5;
    });

    // Re-assign positions after sorting
    const finalLeaderboard = sortedLeaderboard.slice(0, 20).map((nft: any, index: number) => ({
      ...nft,
      position: index + 1,
      leaderboard_position: index + 1, // Ensure consistency
      taste_score: nft.poa_score // Map poa_score to taste_score for frontend
    }));

    const fireNftsInTop20 = finalLeaderboard.filter((nft: any) => nft.fire_votes > 0).length;
    console.log('🏆 FINAL FORCED ORDER (Top 10):');
    finalLeaderboard.slice(0, 10).forEach((nft: any, index: number) => {
      console.log(`  ${index + 1}. ${nft.name} - 🔥${nft.fire_votes} FIRE, ${nft.total_votes} votes, ${nft.poa_score} POA`);
    });
    console.log(`🔥 FIRE NFTs in top 20: ${fireNftsInTop20}`);

    return NextResponse.json({
      success: true,
      leaderboard: finalLeaderboard,
      metadata: {
        system_mode: 'FORCED_FIRE_FIRST',
        system_status: 'API forcing FIRE-first order in JS',
        total_nfts_analyzed: rawData?.length || 0,
        scored_nfts: finalLeaderboard.length,
        highest_poa_score: finalLeaderboard.length > 0 ? Math.max(...finalLeaderboard.map((n: any) => n.poa_score || 0)) : 0,
        avg_confidence: finalLeaderboard.length > 0 ?
          Math.round(finalLeaderboard.reduce((sum: number, nft: any) => sum + (nft.confidence_score || 0), 0) / finalLeaderboard.length) : 0,
        algorithm_used: 'Forced FIRE-First (JS)',
        analysis_coverage: 'API forcing order after function call',
        fire_votes_total: fireNftsInTop20,
        high_confidence_nfts: 0 // This is not calculated in this forced mode
      }
    });

  } catch (error) {
    console.error('❌ Leaderboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
