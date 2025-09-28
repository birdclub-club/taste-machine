/**
 * Check DreamilioMaker collection in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🎨 Checking DreamilioMaker collection...');

    // Get DreamilioMaker NFTs
    const { data: dreamilioNFTs, error } = await supabase
      .from('nfts')
      .select('id, token_id, name, image, collection_name, contract_address, traits')
      .eq('collection_name', 'DreamilioMaker')
      .limit(10);

    if (error) {
      console.error('❌ Error fetching DreamilioMaker NFTs:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch DreamilioMaker collection',
          details: error.message
        },
        { status: 500 }
      );
    }

    // Get count
    const { count: totalCount, error: countError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true })
      .eq('collection_name', 'DreamilioMaker');

    if (countError) {
      console.warn('⚠️ Error getting count:', countError);
    }

    const result = {
      success: true,
      collection: {
        name: 'DreamilioMaker',
        contract_address: '0x30072084ff8724098cbb65e07f7639ed31af5f66',
        total_nfts: totalCount || 0,
        sample_nfts: dreamilioNFTs || []
      }
    };

    console.log(`✅ DreamilioMaker: ${totalCount} NFTs found`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error checking DreamilioMaker:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
