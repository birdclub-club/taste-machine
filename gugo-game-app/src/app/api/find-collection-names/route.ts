import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Finding actual collection names...');

    // Get all unique collection names with counts
    const { data: collections, error } = await supabase
      .from('nfts')
      .select('collection_name')
      .limit(10000);

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Count NFTs per collection
    const collectionCounts = collections?.reduce((acc, nft) => {
      const name = nft.collection_name;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Sort by count (largest first)
    const sortedCollections = Object.entries(collectionCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    // Look for collections that might match our target names
    const targetNames = ['bearish', 'pengz', 'kabu', 'bee'];
    const possibleMatches = sortedCollections.filter(col => 
      targetNames.some(target => 
        col.name.toLowerCase().includes(target) || 
        target.includes(col.name.toLowerCase())
      )
    );

    // Get some sample NFTs from top collections
    const topCollectionSamples = await Promise.all(
      sortedCollections.slice(0, 5).map(async (col) => {
        const { data: samples } = await supabase
          .from('nfts')
          .select('id, name, collection_name, total_votes, poa_v2')
          .eq('collection_name', col.name)
          .limit(3);
        
        return {
          collection: col.name,
          count: col.count,
          samples: samples || []
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Collection names analysis complete',
      data: {
        total_collections: sortedCollections.length,
        total_nfts: collections?.length || 0,
        top_collections: sortedCollections.slice(0, 20),
        possible_target_matches: possibleMatches,
        collection_samples: topCollectionSamples,
        search_targets: ['BEARISH', 'Pengztracted', 'Kabu', 'BEEISH'],
        recommendations: generateCollectionRecommendations(sortedCollections, possibleMatches)
      }
    });

  } catch (error) {
    console.error('❌ Collection names analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateCollectionRecommendations(sorted: any[], matches: any[]): string[] {
  const recommendations = [];

  if (matches.length > 0) {
    recommendations.push(
      `🎯 FOUND MATCHES: ${matches.map(m => `${m.name} (${m.count} NFTs)`).join(', ')}`
    );
  }

  const large = sorted.filter(col => col.count >= 1000);
  if (large.length > 1) {
    recommendations.push(
      `📊 LARGE COLLECTIONS: ${large.map(col => `${col.name} (${col.count})`).join(', ')}`
    );
  }

  if (sorted.length > 10) {
    recommendations.push(
      `🔍 TOTAL: ${sorted.length} collections found - check exact spelling for target collections`
    );
  }

  return recommendations;
}

