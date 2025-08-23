import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Test various system components for performance
    const tests = {
      basic_response: Date.now() - startTime,
      async_duplicate_check: 0,
      database_connection: 0,
      total_time: 0
    };

    // Test async duplicate prevention
    const dupStart = Date.now();
    try {
      const { asyncDuplicatePrevention } = await import('../../../lib/async-duplicate-prevention');
      const isDup = await asyncDuplicatePrevention.checkPairFast('test1', 'test2');
      tests.async_duplicate_check = Date.now() - dupStart;
    } catch (error) {
      tests.async_duplicate_check = -1; // Error
    }

    // Test database connection speed
    const dbStart = Date.now();
    try {
      const { supabase } = await import('../../../../lib/supabase');
      const { data } = await supabase.from('nfts').select('id').limit(1);
      tests.database_connection = Date.now() - dbStart;
    } catch (error) {
      tests.database_connection = -1; // Error
    }

    tests.total_time = Date.now() - startTime;

    // Performance assessment
    let performance_status = 'EXCELLENT';
    let recommendations = [];

    if (tests.total_time > 1000) {
      performance_status = 'POOR';
      recommendations.push('Total response time > 1s - investigate server issues');
    } else if (tests.total_time > 500) {
      performance_status = 'FAIR';
      recommendations.push('Response time > 500ms - optimize queries');
    } else if (tests.total_time > 200) {
      performance_status = 'GOOD';
      recommendations.push('Response time acceptable but could be improved');
    }

    if (tests.database_connection > 300) {
      recommendations.push('Database connection slow - check Supabase performance');
    }

    if (tests.async_duplicate_check > 100) {
      recommendations.push('Duplicate checking slow - optimize cache system');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      performance: {
        status: performance_status,
        total_time_ms: tests.total_time,
        breakdown: tests
      },
      recommendations: recommendations.length > 0 ? recommendations : [
        'System performance is optimal',
        'All components responding within acceptable limits'
      ],
      thresholds: {
        excellent: '< 200ms total',
        good: '< 500ms total', 
        fair: '< 1000ms total',
        poor: '> 1000ms total'
      }
    });

  } catch (error) {
    console.error('❌ Performance test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      performance: {
        status: 'ERROR',
        total_time_ms: -1
      }
    });
  }
}

