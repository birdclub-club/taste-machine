import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { nftIds } = await request.json();

    if (!nftIds || !Array.isArray(nftIds)) {
      return NextResponse.json({ 
        success: false, 
        error: 'nftIds array is required' 
      });
    }

    // Reset slider data for these specific NFTs
    const { data: updateResult, error: updateError } = await supabase
      .from('nfts')
      .update({
        slider_average: null,
        slider_count: 0
      })
      .in('id', nftIds)
      .select('id, name, collection_name, slider_average, slider_count');

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message });
    }

    return NextResponse.json({
      success: true,
      message: `Reset slider data for ${updateResult?.length || 0} NFTs`,
      updatedNFTs: updateResult
    });

  } catch (error) {
    console.error('Reset corrupted slider values error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

