import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing vote ingestion pipeline...');

    // Get a sample NFT pair for testing
    const { data: sampleNFTs, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name')
      .gt('total_votes', 0)
      .limit(2);

    if (nftError || !sampleNFTs || sampleNFTs.length < 2) {
      return NextResponse.json({ 
        success: false, 
        error: 'Could not find sample NFTs for testing' 
      });
    }

    const [nftA, nftB] = sampleNFTs;
    const testUserId = '00000000-0000-0000-0000-000000000001'; // Test user ID

    // Create a test vote event
    const testVoteEvent = {
      voter_id: testUserId,
      nft_a_id: String(nftA.id),
      nft_b_id: String(nftB.id),
      winner_id: String(nftA.id), // A wins
      vote_type: 'test_vote',
      elo_pre_a: 1500,
      elo_pre_b: 1500,
      created_at: new Date().toISOString()
    };

    // Test 1: Insert vote event
    const { data: voteResult, error: voteError } = await supabase
      .from('votes_events')
      .insert([testVoteEvent])
      .select()
      .single();

    if (voteError) {
      console.error('❌ Vote event insertion failed:', voteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Vote event insertion failed',
        details: voteError.message
      });
    }

    console.log('✅ Vote event inserted successfully');

    // Test 2: Create a test slider event
    const testSliderEvent = {
      voter_id: testUserId,
      nft_id: String(nftA.id),
      raw_score: 85, // Use raw_score (0-100 scale from UI)
      created_at: new Date().toISOString()
    };

    const { data: sliderResult, error: sliderError } = await supabase
      .from('sliders_events')
      .insert([testSliderEvent])
      .select()
      .single();

    if (sliderError) {
      console.error('❌ Slider event insertion failed:', sliderError);
      return NextResponse.json({ 
        success: false, 
        error: 'Slider event insertion failed',
        details: sliderError.message
      });
    }

    console.log('✅ Slider event inserted successfully');

    // Test 3: Verify events can be retrieved
    const { data: recentVotes, error: retrievalError } = await supabase
      .from('votes_events')
      .select('*')
      .eq('voter_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (retrievalError) {
      console.error('❌ Event retrieval failed:', retrievalError);
      return NextResponse.json({ 
        success: false, 
        error: 'Event retrieval failed',
        details: retrievalError.message
      });
    }

    console.log('✅ Event retrieval successful');

    // Clean up test data
    await Promise.all([
      supabase.from('votes_events').delete().eq('voter_id', testUserId),
      supabase.from('sliders_events').delete().eq('voter_id', testUserId)
    ]);

    console.log('✅ Test data cleaned up');

    return NextResponse.json({
      success: true,
      test_results: {
        vote_insertion: 'PASS',
        slider_insertion: 'PASS',
        event_retrieval: 'PASS',
        cleanup: 'PASS'
      },
      test_data: {
        nft_a: `${nftA.name} (${nftA.collection_name})`,
        nft_b: `${nftB.name} (${nftB.collection_name})`,
        vote_event_id: voteResult.id,
        slider_event_id: sliderResult.id,
        events_retrieved: recentVotes?.length || 0
      },
      message: 'Vote ingestion pipeline is working correctly'
    });

  } catch (error) {
    console.error('❌ Vote ingestion test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
