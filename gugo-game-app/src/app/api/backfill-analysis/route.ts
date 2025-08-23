import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting comprehensive backfill analysis...');

    // 1. Check NFTs with voting activity but no nft_stats (limit to manageable size)
    const { data: nftsWithVotes, error: votesError } = await supabase
      .from('nfts')
      .select('id, total_votes, poa_v2')
      .gt('total_votes', 4)  // Only NFTs with meaningful activity
      .limit(200);

    if (votesError) {
      return NextResponse.json({ success: false, error: votesError.message });
    }

    // 2. Check which of these have nft_stats in the new pipeline
    const nftIds = nftsWithVotes?.map(nft => nft.id) || [];
    const { data: existingStats, error: statsError } = await supabase
      .from('nft_stats')
      .select('nft_id')
      .in('nft_id', nftIds);

    if (statsError) {
      return NextResponse.json({ success: false, error: statsError.message });
    }

    const statsNftIds = new Set(existingStats?.map(s => s.nft_id) || []);

    // 3. Check which have published scores
    const { data: publishedScores, error: scoresError } = await supabase
      .from('nft_scores')
      .select('nft_id')
      .in('nft_id', nftIds);

    if (scoresError) {
      return NextResponse.json({ success: false, error: scoresError.message });
    }

    const publishedNftIds = new Set(publishedScores?.map(s => s.nft_id) || []);

    // 4. Categorize NFTs (counts only for efficiency)
    let needsStatsCount = 0;
    let needsPublishingCount = 0;
    let fullyMigratedCount = 0;
    let oldSystemOnlyCount = 0;

    for (const nft of nftsWithVotes || []) {
      const hasStats = statsNftIds.has(nft.id);
      const hasPublished = publishedNftIds.has(nft.id);
      const hasOldPOA = nft.poa_v2 !== null;

      if (!hasStats && !hasPublished) {
        needsStatsCount++;
      } else if (hasStats && !hasPublished) {
        needsPublishingCount++;
      } else if (hasStats && hasPublished) {
        fullyMigratedCount++;
      } else if (hasOldPOA && !hasStats) {
        oldSystemOnlyCount++;
      }
    }

    // 5. Check event tables for recent activity
    const { data: recentVotes, error: recentVotesError } = await supabase
      .from('votes_events')
      .select('nft_id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    const { data: recentSliders, error: recentSlidersError } = await supabase
      .from('sliders_events')
      .select('nft_id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    // 6. Summary statistics
    const summary = {
      total_nfts_with_votes: nftsWithVotes?.length || 0,
      needs_stats_migration: needsStatsCount,
      needs_publishing_check: needsPublishingCount,
      fully_migrated: fullyMigratedCount,
      old_system_only: oldSystemOnlyCount,
      recent_activity: {
        votes_24h: recentVotes?.length || 0,
        sliders_24h: recentSliders?.length || 0,
      }
    };

    return NextResponse.json({
      success: true,
      message: 'Backfill analysis complete',
      data: {
        summary,
        recommendations: generateRecommendations(summary),
      },
    });

  } catch (error) {
    console.error('❌ Backfill analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateRecommendations(summary: any): string[] {
  const recommendations = [];

  if (summary.needs_stats_migration > 0) {
    recommendations.push(
      `🔄 MIGRATION NEEDED: ${summary.needs_stats_migration} NFTs with voting activity need to be migrated to the new efficient pipeline (nft_stats)`
    );
  }

  if (summary.needs_publishing_check > 0) {
    recommendations.push(
      `📊 PUBLISH CHECK: ${summary.needs_publishing_check} NFTs have stats but no published scores - run publish gates validation`
    );
  }

  if (summary.old_system_only > 0) {
    recommendations.push(
      `🔄 LEGACY MIGRATION: ${summary.old_system_only} NFTs have old POA v2 scores but aren't in the new pipeline`
    );
  }

  if (summary.recent_activity.votes_24h > 0 || summary.recent_activity.sliders_24h > 0) {
    recommendations.push(
      `⚡ ACTIVE PIPELINE: Recent activity detected (${summary.recent_activity.votes_24h} votes, ${summary.recent_activity.sliders_24h} sliders) - new pipeline is working`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ NO BACKFILL NEEDED: All NFTs are properly migrated to the new efficient pipeline');
  }

  return recommendations;
}
