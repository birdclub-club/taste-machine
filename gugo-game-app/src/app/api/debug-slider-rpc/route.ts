import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing find_optimal_slider_nft_poa_v2 RPC function...');
    
    // Test the RPC function that's causing 500 errors
    const { data, error } = await supabase
      .rpc('find_optimal_slider_nft_poa_v2', {
        excluded_ids: []
      });

    if (error) {
      console.error('❌ RPC Error:', error);
      return NextResponse.json({
        success: false,
        error: 'RPC function failed',
        details: error,
        rpc_function: 'find_optimal_slider_nft_poa_v2'
      }, { status: 500 });
    }

    console.log('✅ RPC Success:', data);
    
    // Check if result includes inactive collections
    if (data && data.collection_name) {
      console.log(`📊 RPC returned NFT from collection: ${data.collection_name}`);
      
      // Check if this collection is active
      const { data: collectionStatus } = await supabase
        .from('collection_management')
        .select('collection_name, active')
        .eq('collection_name', data.collection_name)
        .single();
        
      console.log(`🎛️ Collection ${data.collection_name} status:`, collectionStatus);
    }

    return NextResponse.json({
      success: true,
      rpc_result: data,
      message: 'RPC function test completed'
    });

  } catch (error) {
    console.error('❌ Debug slider RPC error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
