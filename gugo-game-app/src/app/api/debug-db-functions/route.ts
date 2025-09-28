import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database functions for 500 error causes...');
    
    const results = {
      functions_tested: [] as string[],
      errors: [] as Array<{ function: string; error: string; code?: string }>,
      timeouts: [] as string[],
      success: [] as Array<{ function: string; result: string | number }>,
    };

    // Test 1: Simple function that should work
    try {
      console.log('🧪 Testing get_collection_statistics...');
      const { data, error } = await Promise.race([
        supabase.rpc('get_collection_statistics'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]) as any;
      
      if (error) {
        results.errors.push({ function: 'get_collection_statistics', error: error.message });
      } else {
        results.success.push({ function: 'get_collection_statistics', result: 'OK' });
      }
      results.functions_tested.push('get_collection_statistics');
    } catch (err: any) {
      if (err.message === 'Timeout') {
        results.timeouts.push('get_collection_statistics');
      } else {
        results.errors.push({ function: 'get_collection_statistics', error: err.message });
      }
      results.functions_tested.push('get_collection_statistics');
    }

    // Test 2: The problematic POA v2 function
    try {
      console.log('🧪 Testing find_optimal_slider_nft_poa_v2...');
      const { data, error } = await Promise.race([
        supabase.rpc('find_optimal_slider_nft_poa_v2', { excluded_ids: [] }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;
      
      if (error) {
        results.errors.push({ function: 'find_optimal_slider_nft_poa_v2', error: error.message, code: error.code });
      } else {
        results.success.push({ function: 'find_optimal_slider_nft_poa_v2', result: 'OK' });
      }
      results.functions_tested.push('find_optimal_slider_nft_poa_v2');
    } catch (err: any) {
      if (err.message === 'Timeout') {
        results.timeouts.push('find_optimal_slider_nft_poa_v2');
      } else {
        results.errors.push({ function: 'find_optimal_slider_nft_poa_v2', error: err.message });
      }
      results.functions_tested.push('find_optimal_slider_nft_poa_v2');
    }

    // Test 3: Check database connection limits
    try {
      console.log('🧪 Testing database connection status...');
      const { data: connectionData, error: connectionError } = await supabase
        .from('pg_stat_activity')
        .select('count(*)')
        .limit(1);
        
      if (connectionError) {
        results.errors.push({ function: 'connection_check', error: connectionError.message });
      } else {
        results.success.push({ function: 'connection_check', result: 'OK' });
      }
    } catch (err: any) {
      results.errors.push({ function: 'connection_check', error: err.message });
    }

    // Test 4: Check for function permissions
    try {
      console.log('🧪 Testing function permissions...');
      const { data: functionData, error: functionError } = await supabase
        .from('information_schema.routines')
        .select('routine_name, routine_type')
        .eq('routine_schema', 'public')
        .like('routine_name', '%optimal%')
        .limit(5);
        
      if (functionError) {
        results.errors.push({ function: 'function_permissions', error: functionError.message });
      } else {
        results.success.push({ function: 'function_permissions', result: functionData?.length || 0 });
      }
    } catch (err: any) {
      results.errors.push({ function: 'function_permissions', error: err.message });
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total_tested: results.functions_tested.length,
        errors: results.errors.length,
        timeouts: results.timeouts.length,
        successful: results.success.length
      }
    });

  } catch (error) {
    console.error('❌ Debug DB functions error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
