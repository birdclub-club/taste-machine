import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // First, let's see what NFTs currently have slider data
    const { data: nftsWithSliderData, error: sliderError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, slider_average, slider_count, poa_v2, poa_v2_components, poa_v2_updated_at')
      .gt('slider_count', 0)
      .not('poa_v2', 'is', null);

    if (sliderError) {
      return NextResponse.json({ success: false, error: sliderError.message });
    }

    // Now let's check which NFTs have remaining slider votes and see their date ranges
    const nftIds = nftsWithSliderData?.map(nft => nft.id) || [];
    
    const { data: remainingVotes, error: votesError } = await supabase
      .from('votes')
      .select('nft_a_id, slider_value, created_at, vote_type_v2')
      .eq('vote_type_v2', 'slider')
      .in('nft_a_id', nftIds)
      .order('created_at', { ascending: true });

    if (votesError) {
      return NextResponse.json({ success: false, error: votesError.message });
    }

    // Group votes by NFT and analyze date ranges
    const votesByNFT = remainingVotes?.reduce((acc, vote) => {
      if (!acc[vote.nft_a_id]) acc[vote.nft_a_id] = [];
      acc[vote.nft_a_id].push(vote);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Check each NFT to see if their slider_average was calculated using data from the corrupted period
    const affectedNFTs = [];
    const cleanNFTs = [];

    for (const nft of nftsWithSliderData || []) {
      const votes = votesByNFT[nft.id] || [];
      
      if (votes.length === 0) {
        // NFT has slider_count > 0 but no remaining votes - this means all votes were from corrupted period!
        affectedNFTs.push({
          ...nft,
          issue: 'all_votes_deleted',
          remaining_votes: 0,
          slider_component: nft.poa_v2_components?.slider_component
        });
      } else {
        // Check if the current slider_average matches what it should be with remaining votes
        const currentAverage = votes.reduce((sum, v) => sum + v.slider_value, 0) / votes.length;
        const storedAverage = nft.slider_average;
        
        // If stored average doesn't match current votes, it included corrupted data
        if (Math.abs(currentAverage - storedAverage) > 0.01) {
          affectedNFTs.push({
            ...nft,
            issue: 'average_mismatch',
            stored_average: storedAverage,
            correct_average: currentAverage,
            remaining_votes: votes.length,
            slider_component: nft.poa_v2_components?.slider_component,
            vote_dates: votes.map(v => v.created_at)
          });
        } else {
          cleanNFTs.push({
            ...nft,
            remaining_votes: votes.length,
            slider_component: nft.poa_v2_components?.slider_component
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalNFTsWithSliderData: nftsWithSliderData?.length || 0,
        affectedNFTs: {
          count: affectedNFTs.length,
          nfts: affectedNFTs
        },
        cleanNFTs: {
          count: cleanNFTs.length,
          sample: cleanNFTs.slice(0, 5)
        },
        summary: {
          needsRecalculation: affectedNFTs.length,
          message: `${affectedNFTs.length} NFTs need POA v2 recalculation due to corrupted slider data in their averages`
        }
      }
    });

  } catch (error) {
    console.error('Find NFTs with corrupted slider data error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

