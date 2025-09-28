import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action, nftIds } = await request.json();

    if (action === 'reset_slider_data') {
      // Reset slider data for NFTs that had all their votes deleted
      const { data: resetResult, error: resetError } = await supabase
        .from('nfts')
        .update({
          slider_average: null,
          slider_count: 0
        })
        .in('id', nftIds)
        .select('id, name, collection_name');

      if (resetError) {
        return NextResponse.json({ success: false, error: resetError.message });
      }

      return NextResponse.json({
        success: true,
        message: `Reset slider data for ${resetResult?.length || 0} NFTs`,
        resetNFTs: resetResult
      });
    }

    if (action === 'get_affected_nft_ids') {
      // Get the list of NFT IDs that need fixing
      const { data: nftsWithSliderData, error: sliderError } = await supabase
        .from('nfts')
        .select('id, name, collection_name, slider_average, slider_count')
        .gt('slider_count', 0)
        .not('poa_v2', 'is', null);

      if (sliderError) {
        return NextResponse.json({ success: false, error: sliderError.message });
      }

      const nftIds = nftsWithSliderData?.map(nft => nft.id) || [];
      
      const { data: remainingVotes, error: votesError } = await supabase
        .from('votes')
        .select('nft_a_id')
        .eq('vote_type_v2', 'slider')
        .in('nft_a_id', nftIds);

      if (votesError) {
        return NextResponse.json({ success: false, error: votesError.message });
      }

      const nftsWithVotes = new Set(remainingVotes?.map(v => v.nft_a_id) || []);
      
      // NFTs that have slider_count > 0 but no remaining votes = corrupted
      const corruptedNFTIds = nftsWithSliderData
        ?.filter(nft => !nftsWithVotes.has(nft.id))
        ?.map(nft => nft.id) || [];

      return NextResponse.json({
        success: true,
        corruptedNFTIds,
        count: corruptedNFTIds.length
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action. Use: reset_slider_data or get_affected_nft_ids' 
    });

  } catch (error) {
    console.error('Fix corrupted NFT slider data error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

