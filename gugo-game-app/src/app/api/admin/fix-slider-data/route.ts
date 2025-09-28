import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'analyze') {
      // Analyze the corrupted data first
      const { data: corruptedVotes, error: corruptedError } = await supabase
        .from('votes')
        .select('id, user_id, slider_value, created_at, nft_a_id')
        .eq('vote_type_v2', 'slider')
        .eq('slider_value', 0)
        .gte('created_at', '2025-08-06T00:00:00Z')
        .lt('created_at', '2025-08-15T00:00:00Z')
        .order('created_at', { ascending: true });

      if (corruptedError) {
        return NextResponse.json({ success: false, error: corruptedError.message });
      }

      // Get affected NFTs
      const affectedNFTIds = [...new Set(corruptedVotes?.map(v => v.nft_a_id) || [])];
      
      const { data: affectedNFTs, error: nftError } = await supabase
        .from('nfts')
        .select('id, name, collection_name, slider_average, slider_count, poa_v2, poa_v2_updated_at')
        .in('id', affectedNFTIds);

      return NextResponse.json({
        success: true,
        analysis: {
          corruptedVotesCount: corruptedVotes?.length || 0,
          dateRange: '2025-08-06 to 2025-08-14',
          affectedNFTsCount: affectedNFTIds.length,
          corruptedVotes: corruptedVotes?.slice(0, 10) || [], // Sample
          affectedNFTs: affectedNFTs || []
        }
      });
    }

    if (action === 'delete_corrupted') {
      // Delete the corrupted slider votes (Aug 6-14 with value 0)
      const { data: deletedVotes, error: deleteError } = await supabase
        .from('votes')
        .delete()
        .eq('vote_type_v2', 'slider')
        .eq('slider_value', 0)
        .gte('created_at', '2025-08-06T00:00:00Z')
        .lt('created_at', '2025-08-15T00:00:00Z')
        .select('id, nft_a_id');

      if (deleteError) {
        return NextResponse.json({ success: false, error: deleteError.message });
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedVotes?.length || 0} corrupted slider votes`,
        deletedCount: deletedVotes?.length || 0
      });
    }

    if (action === 'recalculate_slider_averages') {
      // Recalculate slider averages for all NFTs after cleanup
      const { data: nftsWithSlider, error: nftError } = await supabase
        .rpc('recalculate_slider_averages');

      if (nftError) {
        return NextResponse.json({ success: false, error: nftError.message });
      }

      return NextResponse.json({
        success: true,
        message: 'Slider averages recalculated',
        result: nftsWithSlider
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action. Use: analyze, delete_corrupted, or recalculate_slider_averages' 
    });

  } catch (error) {
    console.error('Fix slider data error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

