import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { nftIds } = await request.json();

    if (!nftIds || !Array.isArray(nftIds)) {
      return NextResponse.json({ 
        success: false, 
        error: 'nftIds array is required' 
      });
    }

    // Get current NFT slider data
    const { data: nftData, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, slider_average, slider_count')
      .in('id', nftIds);

    if (nftError) {
      return NextResponse.json({ success: false, error: nftError.message });
    }

    // Get remaining slider votes for these NFTs
    const { data: sliderVotes, error: votesError } = await supabase
      .from('votes')
      .select('nft_a_id, slider_value, created_at, vote_type_v2')
      .eq('vote_type_v2', 'slider')
      .in('nft_a_id', nftIds)
      .order('created_at', { ascending: true });

    if (votesError) {
      return NextResponse.json({ success: false, error: votesError.message });
    }

    // Group votes by NFT
    const votesByNFT = sliderVotes?.reduce((acc, vote) => {
      if (!acc[vote.nft_a_id]) acc[vote.nft_a_id] = [];
      acc[vote.nft_a_id].push(vote);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Analyze each NFT
    const analysis = nftData?.map(nft => {
      const votes = votesByNFT[nft.id] || [];
      const actualAverage = votes.length > 0 ? 
        votes.reduce((sum, v) => sum + v.slider_value, 0) / votes.length : null;

      return {
        id: nft.id,
        name: nft.name,
        collection: nft.collection_name,
        stored_slider_average: nft.slider_average,
        stored_slider_count: nft.slider_count,
        actual_votes_count: votes.length,
        actual_average: actualAverage,
        votes: votes.map(v => ({ value: v.slider_value, date: v.created_at })),
        issue: votes.length === 0 && nft.slider_count > 0 ? 'corrupted_data' : 
               Math.abs((actualAverage || 0) - (nft.slider_average || 0)) > 0.01 ? 'mismatch' : 'clean'
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Check NFT slider data error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

