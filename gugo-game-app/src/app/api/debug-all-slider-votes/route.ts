import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get ALL slider votes from Aug 6 through today
    const { data: allSliderVotes, error } = await supabase
      .from('votes')
      .select('id, user_id, slider_value, created_at, vote_type_v2, nft_a_id')
      .eq('vote_type_v2', 'slider')
      .gte('created_at', '2025-08-06T00:00:00Z')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Analyze the data
    const valueDistribution = allSliderVotes?.reduce((acc, vote) => {
      const value = vote.slider_value;
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<number, number>) || {};

    // Group by date
    const byDate = allSliderVotes?.reduce((acc, vote) => {
      const date = new Date(vote.created_at).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(vote);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Get some non-zero examples if they exist
    const nonZeroVotes = allSliderVotes?.filter(vote => vote.slider_value !== 0) || [];
    const zeroVotes = allSliderVotes?.filter(vote => vote.slider_value === 0) || [];

    return NextResponse.json({
      success: true,
      data: {
        totalVotes: allSliderVotes?.length || 0,
        dateRange: {
          from: '2025-08-06',
          to: new Date().toISOString().split('T')[0]
        },
        valueDistribution,
        nonZeroCount: nonZeroVotes.length,
        zeroCount: zeroVotes.length,
        percentageZero: allSliderVotes?.length ? (zeroVotes.length / allSliderVotes.length * 100).toFixed(1) : 0,
        byDate: Object.entries(byDate).map(([date, votes]) => ({
          date,
          count: votes.length,
          zeroCount: votes.filter(v => v.slider_value === 0).length,
          nonZeroCount: votes.filter(v => v.slider_value !== 0).length,
          uniqueValues: [...new Set(votes.map(v => v.slider_value))].sort((a, b) => a - b)
        })).sort((a, b) => a.date.localeCompare(b.date)),
        sampleNonZeroVotes: nonZeroVotes.slice(0, 20),
        sampleZeroVotes: zeroVotes.slice(0, 10),
        recentVotes: allSliderVotes?.slice(-20) || []
      }
    });

  } catch (error) {
    console.error('Debug all slider votes error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

