// 🧪 Test V3 Enhanced Performance
// Comprehensive testing of V3 optimized enhanced matchup functions

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  try {
    console.log('🧪 Testing V3 Enhanced Performance...');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[],
      summary: {
        total_tests: 0,
        successful_tests: 0,
        average_execution_time: 0,
        performance_grade: 'UNKNOWN'
      },
      recommendations: [] as string[]
    };

    // ============================================================================
    // 1. TEST V3 FUNCTIONS INDIVIDUALLY
    // ============================================================================

    const testFunctions = [
      {
        name: 'Same Collection V3',
        rpc: 'find_optimal_same_collection_matchup_v3',
        params: { target_collection: 'Final Bosu', excluded_ids: [] }
      },
      {
        name: 'Cross Collection V3', 
        rpc: 'find_optimal_cross_collection_matchup_v3',
        params: { excluded_ids: [] }
      },
      {
        name: 'Slider Selection V3',
        rpc: 'find_optimal_slider_nft_v3', 
        params: { excluded_ids: [] }
      }
    ];

    for (const test of testFunctions) {
      const startTime = Date.now();
      
      try {
        const { data, error } = await supabase
          .rpc(test.rpc, test.params)
          .single();
          
        const executionTime = Date.now() - startTime;
        
        const testResult = {
          function_name: test.name,
          rpc_name: test.rpc,
          execution_time_ms: executionTime,
          success: !error && data,
          error_message: error?.message || null,
          result_data: data || null,
          performance_rating: executionTime < 300 ? 'EXCELLENT' : 
                             executionTime < 500 ? 'GOOD' : 
                             executionTime < 1000 ? 'FAIR' : 'NEEDS_IMPROVEMENT'
        };
        
        results.tests.push(testResult);
        results.summary.total_tests++;
        
        if (testResult.success) {
          results.summary.successful_tests++;
        }
        
        console.log(`${testResult.success ? '✅' : '❌'} ${test.name}: ${executionTime}ms`);
        
      } catch (err: any) {
        const executionTime = Date.now() - startTime;
        
        results.tests.push({
          function_name: test.name,
          rpc_name: test.rpc,
          execution_time_ms: executionTime,
          success: false,
          error_message: err.message,
          result_data: null,
          performance_rating: 'ERROR'
        });
        
        results.summary.total_tests++;
        console.error(`❌ ${test.name} failed:`, err.message);
      }
    }

    // ============================================================================
    // 2. RUN COMPREHENSIVE PERFORMANCE TEST FUNCTION
    // ============================================================================

    try {
      console.log('🚀 Running comprehensive V3 performance test...');
      
      const { data: comprehensiveResults, error: comprehensiveError } = await supabase
        .rpc('test_enhanced_performance_v3');

      if (comprehensiveError) {
        console.warn('⚠️ Comprehensive test error:', comprehensiveError);
        results.tests.push({
          function_name: 'Comprehensive Test',
          rpc_name: 'test_enhanced_performance_v3',
          execution_time_ms: 0,
          success: false,
          error_message: comprehensiveError.message,
          result_data: null,
          performance_rating: 'ERROR'
        });
      } else if (comprehensiveResults) {
        console.log('✅ Comprehensive test results:', comprehensiveResults);
        
        // Add comprehensive results to tests array
        comprehensiveResults.forEach((result: any) => {
          results.tests.push({
            function_name: `Comprehensive ${result.function_name}`,
            rpc_name: result.function_name,
            execution_time_ms: parseFloat(result.execution_time_ms),
            success: result.success && result.result_count > 0,
            error_message: null,
            result_data: result,
            performance_rating: result.execution_time_ms < 300 ? 'EXCELLENT' : 
                               result.execution_time_ms < 500 ? 'GOOD' : 
                               result.execution_time_ms < 1000 ? 'FAIR' : 'NEEDS_IMPROVEMENT'
          });
          
          results.summary.total_tests++;
          if (result.success && result.result_count > 0) {
            results.summary.successful_tests++;
          }
        });
      }
    } catch (err: any) {
      console.warn('⚠️ Comprehensive test exception:', err.message);
    }

    // ============================================================================
    // 3. CALCULATE PERFORMANCE METRICS
    // ============================================================================

    if (results.tests.length > 0) {
      const successfulTests = results.tests.filter(t => t.success);
      const totalExecutionTime = successfulTests.reduce((sum, test) => sum + test.execution_time_ms, 0);
      
      results.summary.average_execution_time = successfulTests.length > 0 ? 
        Math.round(totalExecutionTime / successfulTests.length) : 0;
      
      const successRate = (results.summary.successful_tests / results.summary.total_tests) * 100;
      const avgTime = results.summary.average_execution_time;
      
      if (successRate >= 90 && avgTime < 300) {
        results.summary.performance_grade = 'EXCELLENT';
      } else if (successRate >= 80 && avgTime < 500) {
        results.summary.performance_grade = 'GOOD';
      } else if (successRate >= 70 && avgTime < 1000) {
        results.summary.performance_grade = 'FAIR';
      } else {
        results.summary.performance_grade = 'NEEDS_IMPROVEMENT';
      }
    }

    // ============================================================================
    // 4. GENERATE RECOMMENDATIONS
    // ============================================================================

    const avgTime = results.summary.average_execution_time;
    const successRate = (results.summary.successful_tests / results.summary.total_tests) * 100;

    if (results.summary.performance_grade === 'EXCELLENT') {
      results.recommendations.push('🎉 Performance is excellent! Consider increasing enhanced ratio to 70%+');
      results.recommendations.push('✅ V3 functions are performing optimally - ready for production');
    } else if (results.summary.performance_grade === 'GOOD') {
      results.recommendations.push('👍 Good performance - can increase enhanced ratio to 50-60%');
      results.recommendations.push('🔧 Monitor for any timeout issues during peak usage');
    } else if (results.summary.performance_grade === 'FAIR') {
      results.recommendations.push('⚠️ Performance needs improvement - keep enhanced ratio at 30-40%');
      results.recommendations.push('🔍 Consider additional database optimizations');
    } else {
      results.recommendations.push('❌ Performance issues detected - investigate database queries');
      results.recommendations.push('🛠️ May need to revert to V2 functions or add more indexes');
    }

    if (avgTime > 500) {
      results.recommendations.push('🐌 Slow execution times detected - check database load and indexes');
    }

    if (successRate < 90) {
      results.recommendations.push('🚨 Low success rate - check for database connectivity issues');
    }

    // ============================================================================
    // 5. CHECK CURRENT ENHANCED SYSTEM STATUS
    // ============================================================================

    try {
      const { data: systemStatus } = await supabase
        .from('nfts')
        .select('collection_name')
        .limit(1);

      if (systemStatus) {
        results.recommendations.push('✅ Database connectivity confirmed');
      }
    } catch (err) {
      results.recommendations.push('⚠️ Database connectivity issue detected');
    }

    console.log('🎯 V3 Performance Test Summary:', results.summary);

    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    console.error('❌ V3 Performance test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Failed to test V3 enhanced performance'
    }, { status: 500 });
  }
}

export async function POST() {
  // Run the same test but also attempt to apply optimizations if needed
  const testResults = await GET();
  
  // If performance is poor, could trigger automatic optimization here
  // For now, just return test results
  return testResults;
}
