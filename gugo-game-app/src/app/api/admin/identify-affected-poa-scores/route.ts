import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get all NFTs that had corrupted slider votes AND have POA v2 scores
    const { data: corruptedNFTs, error: corruptedError } = await supabase
      .from('votes')
      .select('nft_a_id')
      .eq('vote_type_v2', 'slider')
      .eq('slider_value', 0)
      .gte('created_at', '2025-08-06T00:00:00Z')
      .lt('created_at', '2025-08-15T00:00:00Z');

    if (corruptedError) {
      return NextResponse.json({ success: false, error: corruptedError.message });
    }

    const affectedNFTIds = [...new Set(corruptedNFTs?.map(v => v.nft_a_id) || [])];

    // Check which of these have POA v2 scores
    const { data: nftsWithPOA, error: poaError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, slider_average, slider_count, poa_v2, poa_v2_updated_at, poa_v2_components, total_votes')
      .in('id', affectedNFTIds)
      .not('poa_v2', 'is', null);

    if (poaError) {
      return NextResponse.json({ success: false, error: poaError.message });
    }

    // Separate into categories
    const needsRecalculation = nftsWithPOA?.filter(nft => 
      nft.poa_v2_updated_at && new Date(nft.poa_v2_updated_at) >= new Date('2025-08-06')
    ) || [];

    const olderScores = nftsWithPOA?.filter(nft => 
      nft.poa_v2_updated_at && new Date(nft.poa_v2_updated_at) < new Date('2025-08-06')
    ) || [];

    return NextResponse.json({
      success: true,
      data: {
        totalCorruptedNFTs: affectedNFTIds.length,
        nftsWithPOAv2: nftsWithPOA?.length || 0,
        needsRecalculation: {
          count: needsRecalculation.length,
          nfts: needsRecalculation.map(nft => ({
            id: nft.id,
            name: nft.name,
            collection: nft.collection_name,
            poa_v2: nft.poa_v2,
            slider_component: nft.poa_v2_components?.slider_component,
            updated_at: nft.poa_v2_updated_at,
            slider_average: nft.slider_average,
            slider_count: nft.slider_count
          }))
        },
        olderScores: {
          count: olderScores.length,
          nfts: olderScores.slice(0, 10) // Sample
        },
        summary: {
          message: `${needsRecalculation.length} NFTs need POA v2 recalculation due to corrupted slider data`
        }
      }
    });

  } catch (error) {
    console.error('Identify affected POA scores error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
