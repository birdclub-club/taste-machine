import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get some NFTs with slider data
    const { data: nftsWithSlider, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, slider_average, slider_count, total_votes')
      .not('slider_average', 'is', null)
      .gt('slider_count', 0)
      .order('slider_average', { ascending: false })
      .limit(10);

    if (nftError) {
      return NextResponse.json({ success: false, error: nftError.message });
    }

    // Get earliest and latest slider votes to check for scale changes
    const { data: earliestVotes, error: earlyError } = await supabase
      .from('votes')
      .select('id, nft_a_id, user_id, vote_type, slider_value, created_at')
      .eq('vote_type', 'slider')
      .not('slider_value', 'is', null)
      .order('created_at', { ascending: true })
      .limit(50);

    const { data: latestVotes, error: lateError } = await supabase
      .from('votes')
      .select('id, nft_a_id, user_id, vote_type, slider_value, created_at')
      .eq('vote_type', 'slider')
      .not('slider_value', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: allSliderStats, error: statsError } = await supabase
      .from('votes')
      .select('slider_value, created_at')
      .eq('vote_type', 'slider')
      .not('slider_value', 'is', null)
      .order('created_at', { ascending: true });

    if (earlyError || lateError || statsError) {
      return NextResponse.json({ 
        success: false, 
        error: earlyError?.message || lateError?.message || statsError?.message 
      });
    }

    // Analyze the data for scale changes over time
    const allValues = allSliderStats?.map(v => v.slider_value).filter(v => v !== null) || [];
    const earlyValues = earliestVotes?.map(v => v.slider_value).filter(v => v !== null) || [];
    const lateValues = latestVotes?.map(v => v.slider_value).filter(v => v !== null) || [];

    // Group by date ranges to detect scale changes
    const dateGroups = allSliderStats?.reduce((acc, vote) => {
      const date = new Date(vote.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(vote.slider_value);
      return acc;
    }, {} as Record<string, number[]>) || {};

    return NextResponse.json({
      success: true,
      data: {
        nftsWithSliderData: nftsWithSlider,
        historicalAnalysis: {
          totalSliderVotes: allValues.length,
          overallRange: {
            min: allValues.length > 0 ? Math.min(...allValues) : null,
            max: allValues.length > 0 ? Math.max(...allValues) : null,
            unique: [...new Set(allValues)].sort((a, b) => a - b)
          },
          earliestVotes: {
            count: earlyValues.length,
            range: {
              min: earlyValues.length > 0 ? Math.min(...earlyValues) : null,
              max: earlyValues.length > 0 ? Math.max(...earlyValues) : null,
              unique: [...new Set(earlyValues)].sort((a, b) => a - b)
            },
            dates: earliestVotes?.map(v => v.created_at).slice(0, 10) || []
          },
          latestVotes: {
            count: lateValues.length,
            range: {
              min: lateValues.length > 0 ? Math.min(...lateValues) : null,
              max: lateValues.length > 0 ? Math.max(...lateValues) : null,
              unique: [...new Set(lateValues)].sort((a, b) => a - b)
            },
            dates: latestVotes?.map(v => v.created_at).slice(0, 10) || []
          },
          monthlyBreakdown: Object.entries(dateGroups).map(([month, values]) => ({
            month,
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            unique: [...new Set(values)].sort((a, b) => a - b)
          })).sort((a, b) => a.month.localeCompare(b.month))
        }
      }
    });

  } catch (error) {
    console.error('Debug slider data error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
