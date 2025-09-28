import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking collection management status...');
    
    // Get all collection statuses
    const { data: collections, error } = await supabase
      .from('collection_management')
      .select('*')
      .order('collection_name');
    
    if (error) {
      console.error('❌ Error fetching collection status:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    // Also check what collections exist in NFTs table
    const { data: nftCollections, error: nftError } = await supabase
      .from('nfts')
      .select('collection_name')
      .not('collection_name', 'is', null);
    
    if (nftError) {
      console.error('❌ Error fetching NFT collections:', nftError);
    }

    const uniqueCollections = [...new Set(nftCollections?.map(n => n.collection_name) || [])];
    
    return NextResponse.json({
      success: true,
      collection_management: collections || [],
      nft_collections: uniqueCollections,
      analysis: {
        total_managed: collections?.length || 0,
        active_managed: collections?.filter(c => c.active).length || 0,
        inactive_managed: collections?.filter(c => !c.active).length || 0,
        total_nft_collections: uniqueCollections.length,
        fugz_status: collections?.find(c => c.collection_name === 'Fugz') || 'NOT_FOUND'
      }
    });
  } catch (error) {
    console.error('Error checking collection status:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to check collection status', 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

