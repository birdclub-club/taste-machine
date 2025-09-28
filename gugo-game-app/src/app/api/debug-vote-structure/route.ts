import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Check what vote types exist
    const { data: voteTypes, error: typeError } = await supabase
      .from('votes')
      .select('vote_type')
      .limit(1000);

    // Check the structure of the votes table
    const { data: sampleVotes, error: sampleError } = await supabase
      .from('votes')
      .select('*')
      .limit(10);

    // Check if there's a separate slider_votes table or similar
    const { data: tablesInfo, error: tablesError } = await supabase
      .rpc('get_table_info', {});

    // Look for any votes with slider_value not null
    const { data: votesWithSlider, error: sliderError } = await supabase
      .from('votes')
      .select('*')
      .not('slider_value', 'is', null)
      .limit(20);

    return NextResponse.json({
      success: true,
      data: {
        voteTypesFound: voteTypes ? [...new Set(voteTypes.map(v => v.vote_type))].filter(Boolean) : [],
        sampleVotes: sampleVotes?.slice(0, 5) || [],
        votesWithSliderValue: votesWithSlider || [],
        errors: {
          typeError: typeError?.message,
          sampleError: sampleError?.message,
          tablesError: tablesError?.message,
          sliderError: sliderError?.message
        }
      }
    });

  } catch (error) {
    console.error('Debug vote structure error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

