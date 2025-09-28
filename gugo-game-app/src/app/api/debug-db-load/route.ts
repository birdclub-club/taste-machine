import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking database load and performance...');
    
    const results = {
      performance_tests: [] as Array<{ 
        test: string; 
        timing?: number; 
        success?: boolean; 
        error?: any; 
        timeout_used?: number; 
      }>,
      timing: {} as Record<string, number>,
      load_indicators: {} as Record<string, number>
    };

    // Test 1: Simple query timing
    const start1 = Date.now();
    try {
      const { data: simpleData, error: simpleError } = await supabase
        .from('nfts')
        .select('id')
        .limit(1);
      
      const timing1 = Date.now() - start1;
      results.timing.simple_query = timing1;
      results.performance_tests.push({ test: 'simple_query', timing: timing1, success: !simpleError });
    } catch (err) {
      results.performance_tests.push({ test: 'simple_query', error: err });
    }

    // Test 2: Complex query timing (similar to what POA v2 does)
    const start2 = Date.now();
    try {
      const { data: complexData, error: complexError } = await supabase
        .from('nfts')
        .select('id, collection_name, total_votes, poa_v2')
        .not('poa_v2', 'is', null)
        .order('total_votes', { ascending: false })
        .limit(10);
      
      const timing2 = Date.now() - start2;
      results.timing.complex_query = timing2;
      results.performance_tests.push({ test: 'complex_query', timing: timing2, success: !complexError });
    } catch (err) {
      results.performance_tests.push({ test: 'complex_query', error: err });
    }

    // Test 3: RPC function timing with different timeouts
    const timeouts = [500, 1000, 2000];
    for (const timeout of timeouts) {
      const start3 = Date.now();
      try {
        const { data: rpcData, error: rpcError } = await Promise.race([
          supabase.rpc('find_optimal_slider_nft_poa_v2', { excluded_ids: [] }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]) as any;
        
        const timing3 = Date.now() - start3;
        results.performance_tests.push({ 
          test: `rpc_${timeout}ms`, 
          timing: timing3, 
          success: !rpcError,
          timeout_used: timeout
        });
      } catch (err: any) {
        const timing3 = Date.now() - start3;
        results.performance_tests.push({ 
          test: `rpc_${timeout}ms`, 
          timing: timing3, 
          success: false,
          error: err.message,
          timeout_used: timeout
        });
      }
    }

    // Test 4: Collection management query timing
    const start4 = Date.now();
    try {
      const { data: collectionData, error: collectionError } = await supabase
        .from('collection_management')
        .select('collection_name, active')
        .eq('active', true);
      
      const timing4 = Date.now() - start4;
      results.timing.collection_query = timing4;
      results.performance_tests.push({ test: 'collection_query', timing: timing4, success: !collectionError });
      results.load_indicators.active_collections = collectionData?.length || 0;
    } catch (err) {
      results.performance_tests.push({ test: 'collection_query', error: err });
    }

    // Calculate performance summary
    const avgTiming = results.performance_tests
      .filter(t => t.timing && t.success)
      .reduce((sum, t) => sum + (t.timing || 0), 0) / 
      results.performance_tests.filter(t => t.timing && t.success).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        average_timing: Math.round(avgTiming) || 0,
        successful_tests: results.performance_tests.filter(t => t.success).length,
        failed_tests: results.performance_tests.filter(t => !t.success).length,
        total_tests: results.performance_tests.length,
        performance_status: avgTiming < 500 ? 'good' : avgTiming < 1000 ? 'moderate' : 'slow'
      }
    });

  } catch (error) {
    console.error('❌ Debug DB load error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
