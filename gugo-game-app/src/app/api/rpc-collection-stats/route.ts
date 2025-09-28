import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Calling get_collection_statistics RPC function...');

    // Call the RPC function directly
    const { data: collectionStats, error } = await supabase
      .rpc('get_collection_statistics');

    if (error) {
      console.error('❌ RPC error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      });
    }

    console.log(`✅ RPC returned ${collectionStats?.length || 0} collections`);

    // Also get total NFT count for comparison
    const { count: totalNFTs, error: countError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: `Collection statistics retrieved via RPC`,
      data: {
        total_nfts_count: totalNFTs,
        collections_from_rpc: collectionStats,
        collection_count: collectionStats?.length || 0,
        summary: {
          total_nfts_in_collections: collectionStats?.reduce((sum: number, col: any) => sum + (col.nft_count || 0), 0) || 0,
          total_votes_across_collections: collectionStats?.reduce((sum: number, col: any) => sum + (col.total_votes || 0), 0) || 0,
          collections_with_votes: collectionStats?.filter((col: any) => col.total_votes > 0).length || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ RPC collection stats error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

