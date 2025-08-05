/**
 * API endpoint to check NFT table status and count
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking NFT table status...');

    // Try to count existing NFTs
    const { count, error: countError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count query failed:', countError);
      console.error('❌ Full error details:', JSON.stringify(countError, null, 2));
      return NextResponse.json({
        success: false,
        error: 'Count query failed',
        details: countError,
        fullError: JSON.stringify(countError, null, 2),
        nftCount: 0
      });
    }

    console.log(`✅ NFT count query successful: ${count} NFTs found`);

    // Also try to get a sample of NFT data
    const { data: sampleNFTs, error: sampleError } = await supabase
      .from('nfts')
      .select('id, name, collection_name')
      .limit(3);

    if (sampleError) {
      console.warn('⚠️ Sample query failed:', sampleError);
    }

    return NextResponse.json({
      success: true,
      nftCount: count || 0,
      sampleNFTs: sampleNFTs || [],
      hasData: (count || 0) > 0
    });

  } catch (error) {
    console.error('❌ Error checking NFT count:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error 
      },
      { status: 500 }
    );
  }
}