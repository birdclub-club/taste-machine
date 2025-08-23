import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Sampling NFT names to find real collection patterns...');

    // Get a random sample of NFTs to see name patterns
    const { data: sampleNFTs, error } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, poa_v2')
      .limit(100);

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Analyze name patterns to infer collections
    const namePatterns = sampleNFTs?.map(nft => {
      const name = nft.name || '';
      // Extract potential collection name (usually before # or first word)
      const beforeHash = name.split('#')[0].trim();
      const firstWord = name.split(' ')[0];
      
      return {
        id: nft.id,
        name: nft.name,
        stored_collection: nft.collection_name,
        inferred_from_name: beforeHash,
        first_word: firstWord,
        total_votes: nft.total_votes,
        has_poa: nft.poa_v2 !== null
      };
    }) || [];

    // Count inferred collection names
    const inferredCollections = namePatterns.reduce((acc, nft) => {
      const inferred = nft.inferred_from_name;
      if (inferred && inferred !== '') {
        acc[inferred] = (acc[inferred] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Sort by frequency
    const sortedInferred = Object.entries(inferredCollections)
      .sort(([,a], [,b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    // Check what's actually stored in collection_name vs what we infer
    const collectionMismatch = namePatterns.filter(nft => 
      nft.stored_collection !== nft.inferred_from_name
    );

    return NextResponse.json({
      success: true,
      message: 'NFT name pattern analysis complete',
      data: {
        sample_size: namePatterns.length,
        sample_nfts: namePatterns.slice(0, 20), // First 20 for inspection
        stored_collections: [...new Set(namePatterns.map(nft => nft.stored_collection))],
        inferred_collections: sortedInferred,
        collection_mismatches: collectionMismatch.slice(0, 10),
        analysis: {
          total_stored_collections: new Set(namePatterns.map(nft => nft.stored_collection)).size,
          total_inferred_collections: sortedInferred.length,
          mismatch_count: collectionMismatch.length,
          likely_real_collections: sortedInferred.slice(0, 10)
        }
      }
    });

  } catch (error) {
    console.error('❌ NFT name pattern analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

