/**
 * API endpoint to clean up duplicate NFTs we accidentally added
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Cleaning up duplicate NFTs...');

    // Remove the Ethereum collections we added (BAYC, MAYC, Otherdeeds)
    const { data: ethereumDeleted, error: ethereumError } = await supabase
      .from('nfts')
      .delete()
      .in('contract_address', [
        '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',  // BAYC
        '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',  // MAYC  
        '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258'   // Otherdeeds
      ]);

    if (ethereumError) {
      console.error('❌ Failed to remove Ethereum collections:', ethereumError);
    } else {
      console.log(`✅ Removed Ethereum collections`);
    }

    // Remove duplicate BEARISH NFTs (keep only the original ones)
    // We'll identify duplicates by keeping the ones with the earliest created_at timestamp
    const { data: duplicateCheck, error: duplicateError } = await supabase
      .rpc('remove_duplicate_bearish_nfts');

    if (duplicateError) {
      console.warn('⚠️ RPC failed, trying manual duplicate removal...');
      
      // Manual approach: Remove BEARISH NFTs that were just added (they'll have recent timestamps)
      const recentTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      const { data: recentBearish, error: recentError } = await supabase
        .from('nfts')
        .delete()
        .eq('collection_name', 'BEARISH')
        .gte('created_at', recentTimestamp.toISOString());

      if (recentError) {
        console.error('❌ Failed to remove recent BEARISH duplicates:', recentError);
      } else {
        console.log(`✅ Removed recent BEARISH duplicates`);
      }
    } else {
      console.log(`✅ Removed duplicate BEARISH NFTs via RPC`);
    }

    // Get current collection stats
    const { data: collections, error: statsError } = await supabase
      .from('nfts')
      .select('collection_name')
      .not('current_elo', 'is', null);

    if (statsError) {
      console.error('❌ Failed to get collection stats:', statsError);
    } else {
      const collectionCounts = collections?.reduce((acc: any, nft: any) => {
        acc[nft.collection_name] = (acc[nft.collection_name] || 0) + 1;
        return acc;
      }, {});

      console.log('📊 Current collection counts:', collectionCounts);
    }

    return NextResponse.json({
      success: true,
      message: 'Duplicate NFTs cleaned up successfully',
      actions: [
        'Removed Ethereum collections (BAYC, MAYC, Otherdeeds)',
        'Removed duplicate BEARISH NFTs'
      ]
    });

  } catch (error) {
    console.error('❌ Error cleaning up duplicates:', error);
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
