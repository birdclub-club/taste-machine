import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { checkPublishGates, getUnscoredNFTProgress } from '../../../lib/publish-gates-validator';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const nft_id = url.searchParams.get('nft_id');
    
    if (!nft_id) {
      return NextResponse.json({
        success: false,
        error: 'nft_id parameter required'
      });
    }

    console.log(`🧪 Testing publish gates for NFT: ${nft_id}`);

    // Check if NFT has published score
    const { data: publishedScore } = await supabase
      .from('nft_scores')
      .select('*')
      .eq('nft_id', nft_id)
      .single();

    // Get NFT basic info
    const { data: nft } = await supabase
      .from('nfts')
      .select('id, name, collection_name')
      .eq('id', nft_id)
      .single();

    if (!nft) {
      return NextResponse.json({
        success: false,
        error: 'NFT not found'
      });
    }

    if (publishedScore) {
      // NFT is scored
      return NextResponse.json({
        success: true,
        message: 'NFT has published score',
        data: {
          nft: {
            id: nft.id,
            name: nft.name,
            collection_name: nft.collection_name,
          },
          status: 'scored',
          score: {
            poa_v2: publishedScore.poa_v2,
            confidence: publishedScore.confidence,
            provisional: publishedScore.provisional,
            updated_at: publishedScore.updated_at,
          },
        },
      });
    } else {
      // NFT is unscored - get progress
      const progress = await getUnscoredNFTProgress(nft_id);
      
      return NextResponse.json({
        success: true,
        message: 'NFT awaiting data',
        data: {
          nft: {
            id: nft.id,
            name: nft.name,
            collection_name: nft.collection_name,
          },
          ...progress,
        },
      });
    }

  } catch (error) {
    console.error('❌ Test publish gates error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nft_id, test_poa = 45.5, test_confidence = 75 } = body;
    
    if (!nft_id) {
      return NextResponse.json({
        success: false,
        error: 'nft_id required'
      });
    }

    console.log(`🧪 Testing publish gates logic for NFT: ${nft_id}`);

    // Test the publish gates logic
    const gateResult = await checkPublishGates(nft_id, test_poa, test_confidence);

    return NextResponse.json({
      success: true,
      message: 'Publish gates test completed',
      data: {
        nft_id,
        test_poa,
        test_confidence,
        gate_result: gateResult,
      },
    });

  } catch (error) {
    console.error('❌ Test publish gates POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

