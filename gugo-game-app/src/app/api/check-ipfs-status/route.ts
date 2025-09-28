/**
 * Check current IPFS status in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking IPFS status in database...');

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true });

    // Get IPFS count
    const { count: ipfsCount, error: ipfsError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .like('image', 'ipfs:%');

    // Get HTTP count  
    const { count: httpCount, error: httpError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .like('image', 'http%');

    // Get sample IPFS NFTs
    const { data: ipfsSamples, error: sampleError } = await supabase
      .from('nfts')
      .select('id, collection_name, name, image')
      .like('image', 'ipfs:%')
      .limit(10);

    // Get collection breakdown
    const { data: collectionBreakdown, error: collectionError } = await supabase
      .from('nfts')
      .select('collection_name, image')
      .like('image', 'ipfs:%');

    let collectionCounts: Record<string, number> = {};
    if (collectionBreakdown) {
      collectionCounts = collectionBreakdown.reduce((acc: Record<string, number>, nft: any) => {
        acc[nft.collection_name] = (acc[nft.collection_name] || 0) + 1;
        return acc;
      }, {});
    }

    // Check if any errors occurred
    const errors = [totalError, ipfsError, httpError, sampleError, collectionError].filter(Boolean);
    if (errors.length > 0) {
      console.error('Database errors:', errors);
    }

    const result = {
      success: true,
      counts: {
        total: totalCount || 0,
        ipfs: ipfsCount || 0,
        http: httpCount || 0
      },
      collectionBreakdown: collectionCounts,
      ipfsSamples: ipfsSamples || [],
      errors: errors.map(e => e?.message).filter(Boolean)
    };

    console.log('📊 IPFS Status:', result.counts);
    console.log('📋 Collections with IPFS:', Object.keys(collectionCounts));

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error checking IPFS status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check IPFS status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
