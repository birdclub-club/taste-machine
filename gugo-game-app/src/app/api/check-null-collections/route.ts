import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking for NFTs with NULL or empty collection names...');

    // 1. Count NFTs with NULL collection_name
    const { count: nullCount, error: nullError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .is('collection_name', null);

    // 2. Count NFTs with empty string collection_name
    const { count: emptyCount, error: emptyError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .eq('collection_name', '');

    // 3. Count NFTs with non-null collection_name
    const { count: nonNullCount, error: nonNullError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .not('collection_name', 'is', null);

    // 4. Get sample of NFTs with NULL collection names
    const { data: nullSamples, error: nullSamplesError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, poa_v2')
      .is('collection_name', null)
      .limit(10);

    // 5. Get sample of NFTs with empty collection names
    const { data: emptySamples, error: emptySamplesError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, poa_v2')
      .eq('collection_name', '')
      .limit(10);

    // 6. Check if there are other collection name patterns
    const { data: distinctCollections, error: distinctError } = await supabase
      .from('nfts')
      .select('collection_name')
      .not('collection_name', 'is', null)
      .limit(10000);

    const uniqueCollections = [...new Set(distinctCollections?.map(nft => nft.collection_name) || [])];

    return NextResponse.json({
      success: true,
      message: 'NULL collection analysis complete',
      data: {
        total_analysis: {
          null_collection: nullCount || 0,
          empty_collection: emptyCount || 0,
          non_null_collection: nonNullCount || 0,
          total_expected: 54312
        },
        samples: {
          null_samples: nullSamples || [],
          empty_samples: emptySamples || [],
        },
        unique_collections_found: uniqueCollections,
        unique_count: uniqueCollections.length,
        diagnosis: {
          missing_nfts: (54312 - (nonNullCount || 0)),
          likely_issue: (nullCount || 0) > 50000 ? 'Most NFTs have NULL collection_name' : 
                       (emptyCount || 0) > 50000 ? 'Most NFTs have empty collection_name' :
                       'Collection names might be in different format',
          recommendation: 'Check NFT name patterns to infer collection names'
        }
      }
    });

  } catch (error) {
    console.error('❌ NULL collection analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

