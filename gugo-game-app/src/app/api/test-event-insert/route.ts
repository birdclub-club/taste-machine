import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing event insertion...');

    // Get current Elo values for the NFTs
    const { data: nftA } = await supabase
      .from('nfts')
      .select('current_elo')
      .eq('id', 'ffc0f657-be79-483a-97b3-e91c7d80f450')
      .single();

    const { data: nftB } = await supabase
      .from('nfts')
      .select('current_elo')
      .eq('id', 'fae674db-eaff-4552-8aba-64f103b5e2ac')
      .single();

    // Test inserting a single vote event
    const testVoteEvent = {
      voter_id: '702adb47-2792-4329-9ff0-9a56063b137a', // Real user ID from our data
      nft_a_id: 'ffc0f657-be79-483a-97b3-e91c7d80f450', // BEARISH #1972
      nft_b_id: 'fae674db-eaff-4552-8aba-64f103b5e2ac', // BEEISH #4428
      winner_id: 'ffc0f657-be79-483a-97b3-e91c7d80f450', // BEARISH wins
      elo_pre_a: nftA?.current_elo || 1500,
      elo_pre_b: nftB?.current_elo || 1500,
      vote_type: 'normal',
      created_at: new Date().toISOString()
    };

    console.log('Inserting test vote event:', testVoteEvent);

    const { data: voteResult, error: voteError } = await supabase
      .from('votes_events')
      .insert([testVoteEvent])
      .select();

    if (voteError) {
      console.error('❌ Vote insert error:', voteError);
      return NextResponse.json({
        success: false,
        error: `Vote insert failed: ${voteError.message}`,
        details: voteError
      });
    }

    console.log('✅ Vote event inserted:', voteResult);

    // Test inserting a single slider event
    const testSliderEvent = {
      voter_id: '702adb47-2792-4329-9ff0-9a56063b137a',
      nft_id: 'ffc0f657-be79-483a-97b3-e91c7d80f450',
      raw_score: 75, // 0-100 scale as expected by schema
      created_at: new Date().toISOString()
    };

    console.log('Inserting test slider event:', testSliderEvent);

    const { data: sliderResult, error: sliderError } = await supabase
      .from('sliders_events')
      .insert([testSliderEvent])
      .select();

    if (sliderError) {
      console.error('❌ Slider insert error:', sliderError);
      return NextResponse.json({
        success: false,
        error: `Slider insert failed: ${sliderError.message}`,
        details: sliderError
      });
    }

    console.log('✅ Slider event inserted:', sliderResult);

    // Test marking NFT as dirty
    const { data: dirtyResult, error: dirtyError } = await supabase
      .from('dirty_nfts')
      .insert([{
        nft_id: 'ffc0f657-be79-483a-97b3-e91c7d80f450',
        priority: 10 // High priority as integer
      }])
      .select();

    if (dirtyError && !dirtyError.message.includes('duplicate key')) {
      console.error('❌ Dirty insert error:', dirtyError);
      return NextResponse.json({
        success: false,
        error: `Dirty insert failed: ${dirtyError.message}`,
        details: dirtyError
      });
    }

    console.log('✅ NFT marked as dirty:', dirtyResult);

    return NextResponse.json({
      success: true,
      message: 'Event insertion test successful',
      data: {
        vote_event: voteResult,
        slider_event: sliderResult,
        dirty_nft: dirtyResult
      }
    });

  } catch (error) {
    console.error('❌ Test event insert error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
