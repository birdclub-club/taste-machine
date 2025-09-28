import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Analyzing NFT vote coverage...');

    // Get total NFT count
    const { count: totalNFTs } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true });

    // Get NFTs with different vote levels
    const { count: zeroVotes } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .eq('total_votes', 0);

    const { count: lowVotes } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .gt('total_votes', 0)
      .lte('total_votes', 5);

    const { count: mediumVotes } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .gt('total_votes', 5)
      .lte('total_votes', 20);

    const { count: highVotes } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .gt('total_votes', 20);

    // Get slider vote distribution
    const { count: zeroSliders } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .or('slider_count.is.null,slider_count.eq.0');

    const { count: fewSliders } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .gt('slider_count', 0)
      .lt('slider_count', 3);

    // Get some examples of zero-vote NFTs
    const { data: zeroVoteExamples } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, slider_count, elo_rating')
      .eq('total_votes', 0)
      .limit(10);

    // Get current matchup algorithm weights
    const algorithmWeights = {
      UNCERTAINTY_WEIGHT: 0.4,
      ELO_PROXIMITY_WEIGHT: 0.3,
      VOTE_COUNT_WEIGHT: 0.2,  // This is key for zero-vote NFTs
      COLLECTION_DIVERSITY_WEIGHT: 0.1
    };

    // Calculate coverage percentages
    const coverageStats = {
      total_nfts: totalNFTs || 0,
      zero_votes: {
        count: zeroVotes || 0,
        percentage: totalNFTs ? ((zeroVotes || 0) / totalNFTs * 100).toFixed(1) : '0'
      },
      low_votes: {
        count: lowVotes || 0,
        percentage: totalNFTs ? ((lowVotes || 0) / totalNFTs * 100).toFixed(1) : '0'
      },
      medium_votes: {
        count: mediumVotes || 0,
        percentage: totalNFTs ? ((mediumVotes || 0) / totalNFTs * 100).toFixed(1) : '0'
      },
      high_votes: {
        count: highVotes || 0,
        percentage: totalNFTs ? ((highVotes || 0) / totalNFTs * 100).toFixed(1) : '0'
      },
      slider_coverage: {
        zero_sliders: zeroSliders || 0,
        few_sliders: fewSliders || 0,
        zero_percentage: totalNFTs ? ((zeroSliders || 0) / totalNFTs * 100).toFixed(1) : '0'
      }
    };

    // Analysis and recommendations
    const analysis = {
      exploration_vs_exploitation: {
        current_bias: 'EXPLOITATION',
        explanation: 'Algorithm favors NFTs with existing data for maximum information gain',
        problem: `${coverageStats.zero_votes.percentage}% of NFTs have never been seen`,
        impact: 'Rich get richer - popular NFTs get more votes, hidden gems stay hidden'
      },
      algorithm_behavior: {
        uncertainty_weight: '40% - Favors NFTs with uncertain ratings',
        elo_proximity_weight: '30% - Favors close matchups for information',
        vote_count_weight: '20% - Should favor low-vote NFTs but may not be strong enough',
        collection_diversity: '10% - Minor factor for collection balance'
      },
      recommendations: [
        {
          strategy: 'Exploration Boost',
          description: 'Increase VOTE_COUNT_WEIGHT from 20% to 35%',
          impact: 'More zero-vote NFTs will be selected'
        },
        {
          strategy: 'Cold Start Sessions',
          description: 'Dedicate 20% of sessions to zero-vote NFTs only',
          impact: 'Guaranteed exposure for unseen NFTs'
        },
        {
          strategy: 'Progressive Discovery',
          description: 'Gradually reduce exploration as NFT gets votes',
          impact: 'Smooth transition from exploration to exploitation'
        }
      ]
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      coverage_stats: coverageStats,
      zero_vote_examples: zeroVoteExamples?.slice(0, 5) || [],
      current_algorithm: algorithmWeights,
      analysis,
      next_steps: [
        'Review zero-vote NFT examples',
        'Decide on exploration vs exploitation balance',
        'Implement algorithm adjustments',
        'Monitor coverage improvement'
      ]
    });

  } catch (error) {
    console.error('❌ NFT coverage analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

