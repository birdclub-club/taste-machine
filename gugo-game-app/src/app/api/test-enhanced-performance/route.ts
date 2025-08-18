/**
 * 🚀 Enhanced System Performance Testing API
 * Tests the optimized V2 functions and measures performance improvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Testing enhanced system performance...');

    const startTime = Date.now();
    
    // Test the new performance testing function
    const { data: performanceResults, error: perfError } = await supabase
      .rpc('test_enhanced_performance');

    if (perfError) {
      console.error('❌ Performance test function error:', perfError);
      return NextResponse.json({
        success: false,
        error: 'Performance test function failed',
        details: perfError.message
      }, { status: 500 });
    }

    const totalTestTime = Date.now() - startTime;

    // Test individual functions with timing
    const individualTests = [];

    // Test same collection V2
    try {
      const sameCollStart = Date.now();
      const { data: sameCollData, error: sameCollError } = await supabase
        .rpc('find_optimal_same_collection_matchup_v2', { 
          target_collection: null, 
          max_candidates: 5 
        });
      const sameCollTime = Date.now() - sameCollStart;
      
      individualTests.push({
        function: 'same_collection_v2',
        executionTime: sameCollTime,
        resultCount: sameCollData?.length || 0,
        success: !sameCollError,
        error: sameCollError?.message || null
      });
    } catch (error) {
      individualTests.push({
        function: 'same_collection_v2',
        executionTime: -1,
        resultCount: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test cross collection V2
    try {
      const crossCollStart = Date.now();
      const { data: crossCollData, error: crossCollError } = await supabase
        .rpc('find_optimal_cross_collection_matchup_v2', { max_candidates: 5 });
      const crossCollTime = Date.now() - crossCollStart;
      
      individualTests.push({
        function: 'cross_collection_v2',
        executionTime: crossCollTime,
        resultCount: crossCollData?.length || 0,
        success: !crossCollError,
        error: crossCollError?.message || null
      });
    } catch (error) {
      individualTests.push({
        function: 'cross_collection_v2',
        executionTime: -1,
        resultCount: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test slider V2
    try {
      const sliderStart = Date.now();
      const { data: sliderData, error: sliderError } = await supabase
        .rpc('find_optimal_slider_nft_v2', { max_candidates: 5 });
      const sliderTime = Date.now() - sliderStart;
      
      individualTests.push({
        function: 'slider_nft_v2',
        executionTime: sliderTime,
        resultCount: sliderData?.length || 0,
        success: !sliderError,
        error: sliderError?.message || null
      });
    } catch (error) {
      individualTests.push({
        function: 'slider_nft_v2',
        executionTime: -1,
        resultCount: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Calculate performance metrics
    const successfulTests = individualTests.filter(t => t.success);
    const averageExecutionTime = successfulTests.length > 0 
      ? successfulTests.reduce((sum, t) => sum + t.executionTime, 0) / successfulTests.length 
      : 0;

    const performanceGrade = averageExecutionTime < 300 ? 'EXCELLENT' :
                           averageExecutionTime < 500 ? 'GOOD' :
                           averageExecutionTime < 800 ? 'FAIR' : 'NEEDS_IMPROVEMENT';

    // Performance targets
    const targets = {
      same_collection: 300, // ms
      cross_collection: 300, // ms
      slider_nft: 200, // ms
      overall_success_rate: 70 // %
    };

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      totalTestTime,
      performanceResults: performanceResults || [],
      individualTests,
      metrics: {
        averageExecutionTime: Math.round(averageExecutionTime),
        successRate: Math.round((successfulTests.length / individualTests.length) * 100),
        performanceGrade,
        targetsAchieved: {
          averageSpeed: averageExecutionTime <= 300,
          allFunctionsWorking: successfulTests.length === individualTests.length,
          recommendedUsage: averageExecutionTime <= 500 ? '70%' : '50%'
        }
      },
      targets,
      recommendations: generateRecommendations(individualTests, averageExecutionTime)
    };

    console.log('🎯 Performance Test Results:');
    console.log(`   Average Execution Time: ${Math.round(averageExecutionTime)}ms`);
    console.log(`   Success Rate: ${result.metrics.successRate}%`);
    console.log(`   Performance Grade: ${performanceGrade}`);
    console.log(`   Recommended Enhanced Usage: ${result.metrics.targetsAchieved.recommendedUsage}`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Performance test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Performance test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function generateRecommendations(tests: any[], avgTime: number): string[] {
  const recommendations = [];

  if (avgTime > 500) {
    recommendations.push('Consider running the database migration to add performance indexes');
  }

  if (avgTime > 800) {
    recommendations.push('Database queries are slow - check if indexes are properly created');
    recommendations.push('Consider reducing max_candidates parameter for faster execution');
  }

  const failedTests = tests.filter(t => !t.success);
  if (failedTests.length > 0) {
    recommendations.push(`${failedTests.length} function(s) failed - check database function deployment`);
  }

  if (avgTime <= 300) {
    recommendations.push('Excellent performance! Consider increasing enhanced ratio to 70%');
  } else if (avgTime <= 500) {
    recommendations.push('Good performance! Enhanced ratio of 50-60% recommended');
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! Monitor in production for optimal settings');
  }

  return recommendations;
}
