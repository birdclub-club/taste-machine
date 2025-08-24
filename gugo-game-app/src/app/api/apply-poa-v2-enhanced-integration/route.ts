// 🧮 Apply POA v2 Enhanced Matchup Integration
// Integrate POA v2 scores with enhanced matchup system for superior quality

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧮 Starting POA v2 Enhanced Matchup Integration...');
    
    const results = {
      poa_v2_functions_created: 0,
      indexes_created: 0,
      coverage_analysis: null as any,
      performance_tests: [] as any[],
      dirty_nfts_status: null as any,
      success: true,
      errors: [] as string[]
    };

    // ============================================================================
    // 1. CREATE POA V2 AWARE ENHANCED FUNCTIONS
    // ============================================================================
    
    const poaV2Functions = [
      {
        name: 'find_optimal_same_collection_matchup_poa_v2',
        description: 'Same collection matchup with POA v2 integration'
      },
      {
        name: 'find_optimal_cross_collection_matchup_poa_v2', 
        description: 'Cross collection matchup with POA v2 awareness'
      },
      {
        name: 'find_optimal_slider_nft_poa_v2',
        description: 'Slider selection with POA v2 and dirty flag consideration'
      },
      {
        name: 'test_poa_v2_enhanced_performance',
        description: 'Performance testing for POA v2 enhanced functions'
      },
      {
        name: 'analyze_poa_v2_coverage',
        description: 'POA v2 coverage analysis across collections'
      }
    ];

    // Note: Functions are created via the migration file
    // Here we just verify they exist and test them

    for (const func of poaV2Functions) {
      try {
        // Test if function exists by calling it (with error handling)
        if (func.name.includes('test_') || func.name.includes('analyze_')) {
          const { data, error } = await supabase.rpc(func.name);
          if (!error) {
            console.log(`✅ Verified function: ${func.name}`);
            results.poa_v2_functions_created++;
          } else {
            console.warn(`⚠️ Function ${func.name} test failed:`, error);
            results.errors.push(`Function ${func.name}: ${error.message}`);
          }
        } else {
          // For matchup functions, just check if they exist in the database
          const { data, error } = await supabase
            .from('pg_proc')
            .select('proname')
            .eq('proname', func.name)
            .single();
            
          if (data || !error) {
            console.log(`✅ Function exists: ${func.name}`);
            results.poa_v2_functions_created++;
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ Function ${func.name} verification error:`, err.message);
        results.errors.push(`Function ${func.name}: ${err.message}`);
      }
    }

    // ============================================================================
    // 2. RUN POA V2 COVERAGE ANALYSIS
    // ============================================================================

    try {
      console.log('📊 Analyzing POA v2 coverage...');
      const { data: coverageData, error: coverageError } = await supabase
        .rpc('analyze_poa_v2_coverage');

      if (coverageError) {
        console.warn('⚠️ Coverage analysis error:', coverageError);
        results.errors.push(`Coverage analysis: ${coverageError.message}`);
      } else if (coverageData) {
        results.coverage_analysis = coverageData;
        console.log('✅ POA v2 coverage analysis completed:', coverageData);
      }
    } catch (err: any) {
      console.warn('⚠️ Coverage analysis exception:', err.message);
      results.errors.push(`Coverage analysis exception: ${err.message}`);
    }

    // ============================================================================
    // 3. TEST POA V2 ENHANCED PERFORMANCE
    // ============================================================================

    try {
      console.log('🧪 Testing POA v2 enhanced performance...');
      const { data: performanceResults, error: performanceError } = await supabase
        .rpc('test_poa_v2_enhanced_performance');

      if (performanceError) {
        console.warn('⚠️ Performance test error:', performanceError);
        results.errors.push(`Performance test: ${performanceError.message}`);
      } else if (performanceResults) {
        results.performance_tests = performanceResults;
        console.log('✅ POA v2 performance tests completed:', performanceResults);
      }
    } catch (err: any) {
      console.warn('⚠️ Performance test exception:', err.message);
      results.errors.push(`Performance test exception: ${err.message}`);
    }

    // ============================================================================
    // 4. CHECK DIRTY NFTS STATUS
    // ============================================================================

    try {
      console.log('🔍 Checking dirty NFTs status...');
      const { data: dirtyStatus, error: dirtyError } = await supabase
        .from('dirty_nfts')
        .select('*')
        .limit(1);

      if (!dirtyError) {
        // Get dirty NFTs count and status
        const { count } = await supabase
          .from('dirty_nfts')
          .select('*', { count: 'exact', head: true });

        results.dirty_nfts_status = {
          total_dirty: count || 0,
          table_accessible: true
        };
        console.log(`✅ Dirty NFTs status: ${count || 0} NFTs need recomputation`);
      } else {
        results.dirty_nfts_status = {
          total_dirty: 0,
          table_accessible: false,
          error: dirtyError.message
        };
        console.warn('⚠️ Dirty NFTs table access error:', dirtyError);
      }
    } catch (err: any) {
      results.dirty_nfts_status = {
        total_dirty: 0,
        table_accessible: false,
        error: err.message
      };
      console.warn('⚠️ Dirty NFTs check exception:', err.message);
    }

    // ============================================================================
    // 5. GENERATE INTEGRATION RECOMMENDATIONS
    // ============================================================================

    const recommendations = [];

    // Check POA v2 coverage
    if (results.coverage_analysis && Array.isArray(results.coverage_analysis)) {
      const totalCollections = results.coverage_analysis.length;
      const collectionsWithPOA = results.coverage_analysis.filter(c => c.poa_v2_percent > 0).length;
      
      if (collectionsWithPOA === 0) {
        recommendations.push('🚨 No POA v2 scores found - run POA v2 computation first');
        recommendations.push('💡 Use /api/compute-poa-v2 to generate initial scores');
      } else if (collectionsWithPOA < totalCollections) {
        recommendations.push(`📊 POA v2 coverage: ${collectionsWithPOA}/${totalCollections} collections`);
        recommendations.push('🔄 Consider running POA v2 computation for remaining collections');
      } else {
        recommendations.push('✅ Good POA v2 coverage across all collections');
        recommendations.push('🚀 Enhanced matchups can now use sophisticated POA v2 scoring');
      }
    }

    // Check performance results
    if (results.performance_tests && results.performance_tests.length > 0) {
      const avgExecutionTime = results.performance_tests.reduce((sum, test) => 
        sum + parseFloat(test.execution_time_ms), 0) / results.performance_tests.length;
      
      if (avgExecutionTime < 300) {
        recommendations.push('⚡ Excellent performance - ready for production use');
      } else if (avgExecutionTime < 500) {
        recommendations.push('👍 Good performance - suitable for enhanced matchups');
      } else {
        recommendations.push('⚠️ Performance needs optimization - consider database tuning');
      }
    }

    // Check dirty NFTs
    if (results.dirty_nfts_status?.total_dirty > 0) {
      recommendations.push(`🔄 ${results.dirty_nfts_status.total_dirty} NFTs need POA recomputation`);
      recommendations.push('💡 Run batch POA v2 computation to update dirty NFTs');
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================

    const summary = {
      ...results,
      recommendations,
      integration_status: results.poa_v2_functions_created >= 3 ? 'SUCCESS' : 'PARTIAL',
      next_steps: [
        'Update enhanced matchup integration to use POA v2 functions',
        'Monitor enhanced system usage with POA v2 integration',
        'Run POA v2 computation for any missing collections',
        'Test matchup quality improvements with POA v2 scoring'
      ]
    };

    console.log('🎉 POA v2 Enhanced Integration completed:', summary);

    return NextResponse.json(summary, { status: 200 });

  } catch (error: any) {
    console.error('❌ POA v2 Enhanced Integration failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Failed to apply POA v2 enhanced matchup integration'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Quick status check of POA v2 integration
    const { data: coverageData } = await supabase.rpc('analyze_poa_v2_coverage');
    const { count: dirtyCount } = await supabase
      .from('dirty_nfts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      message: 'POA v2 Enhanced Matchup Integration Status',
      poa_v2_coverage: coverageData || [],
      dirty_nfts_count: dirtyCount || 0,
      usage: 'POST to apply POA v2 enhanced matchup integration',
      benefits: [
        'Uses sophisticated POA v2 scores instead of basic Elo',
        'Considers confidence levels for better matchup quality',
        'Avoids dirty NFTs when possible (prefers fresh scores)',
        'Prioritizes NFTs with POA v2 scores over legacy Elo'
      ]
    });
  } catch (error: any) {
    return NextResponse.json({
      message: 'POA v2 Enhanced Matchup Integration API',
      error: error.message,
      status: 'Functions may not be installed yet'
    });
  }
}
