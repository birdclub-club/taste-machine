import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get NFTs with POA v2 scores updated after Aug 6 (potentially affected by corrupted data)
    const { data: potentiallyAffected, error } = await supabase
      .from('nfts')
      .select('id, name, collection_name, poa_v2, poa_v2_updated_at, poa_v2_components, slider_average, slider_count, total_votes')
      .not('poa_v2', 'is', null)
      .gte('poa_v2_updated_at', '2025-08-06T00:00:00Z')
      .order('poa_v2_updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Categorize by date ranges
    const byDateRange = {
      corruptedPeriod: potentiallyAffected?.filter(nft => 
        new Date(nft.poa_v2_updated_at) >= new Date('2025-08-06T00:00:00Z') &&
        new Date(nft.poa_v2_updated_at) < new Date('2025-08-15T00:00:00Z')
      ) || [],
      cleanPeriod: potentiallyAffected?.filter(nft => 
        new Date(nft.poa_v2_updated_at) >= new Date('2025-08-15T00:00:00Z')
      ) || []
    };

    // Check which ones have slider_component = 50 (likely defaulted due to missing data)
    const suspiciousScores = byDateRange.corruptedPeriod.filter(nft => 
      nft.poa_v2_components?.slider_component === 50
    );

    return NextResponse.json({
      success: true,
      data: {
        totalPotentiallyAffected: potentiallyAffected?.length || 0,
        corruptedPeriod: {
          count: byDateRange.corruptedPeriod.length,
          dateRange: '2025-08-06 to 2025-08-14',
          nfts: byDateRange.corruptedPeriod.map(nft => ({
            id: nft.id,
            name: nft.name,
            collection: nft.collection_name,
            poa_v2: nft.poa_v2,
            slider_component: nft.poa_v2_components?.slider_component,
            slider_average: nft.slider_average,
            slider_count: nft.slider_count,
            updated_at: nft.poa_v2_updated_at
          }))
        },
        cleanPeriod: {
          count: byDateRange.cleanPeriod.length,
          dateRange: '2025-08-15 onwards'
        },
        suspiciousScores: {
          count: suspiciousScores.length,
          message: `${suspiciousScores.length} NFTs from corrupted period have slider_component=50 (likely defaulted)`
        },
        recommendation: {
          needsRecalculation: byDateRange.corruptedPeriod.length,
          message: `Recommend recalculating ${byDateRange.corruptedPeriod.length} NFTs from the corrupted period`
        }
      }
    });

  } catch (error) {
    console.error('Check affected POA scores error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

