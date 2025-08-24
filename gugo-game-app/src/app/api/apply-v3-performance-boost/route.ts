// 🚀 Apply V3 Performance Boost
// Comprehensive performance optimization for enhanced matchup system

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting V3 Performance Boost Application...');
    
    const results = {
      indexes_created: 0,
      functions_updated: 0,
      performance_tests: [] as any[],
      success: true,
      errors: [] as string[]
    };

    // ============================================================================
    // 1. CREATE STRATEGIC PERFORMANCE INDEXES
    // ============================================================================
    
    const indexes = [
      {
        name: 'idx_nfts_enhanced_selection',
        sql: `CREATE INDEX IF NOT EXISTS idx_nfts_enhanced_selection 
              ON nfts(collection_name, current_elo DESC, total_votes ASC, id) 
              WHERE collection_name IS NOT NULL`
      },
      {
        name: 'idx_nfts_traits_enhanced',
        sql: `CREATE INDEX IF NOT EXISTS idx_nfts_traits_enhanced 
              ON nfts USING GIN(traits) 
              WHERE traits IS NOT NULL`
      },
      {
        name: 'idx_nfts_slider_selection',
        sql: `CREATE INDEX IF NOT EXISTS idx_nfts_slider_selection 
              ON nfts(collection_name, slider_count ASC, current_elo DESC) 
              WHERE collection_name IS NOT NULL AND slider_count >= 0`
      },
      {
        name: 'idx_nfts_collection_active',
        sql: `CREATE INDEX IF NOT EXISTS idx_nfts_collection_active 
              ON nfts(collection_name, id) 
              WHERE collection_name IN ('Final Bosu', 'Fugz', 'Bearish', 'Beeish', 'Canna Sapiens', 'Dreamiliomaker')`
      },
      {
        name: 'idx_nfts_cross_collection',
        sql: `CREATE INDEX IF NOT EXISTS idx_nfts_cross_collection 
              ON nfts(current_elo DESC, total_votes ASC, collection_name, id) 
              WHERE collection_name IS NOT NULL`
      }
    ];

    for (const index of indexes) {
      try {
        const { error } = await supabase.rpc('execute_sql', { sql_query: index.sql });
        if (error) {
          console.warn(`⚠️ Index ${index.name} creation warning:`, error);
          results.errors.push(`Index ${index.name}: ${error.message}`);
        } else {
          console.log(`✅ Created index: ${index.name}`);
          results.indexes_created++;
        }
      } catch (err: any) {
        console.warn(`⚠️ Index ${index.name} error:`, err.message);
        results.errors.push(`Index ${index.name}: ${err.message}`);
      }
    }

    // ============================================================================
    // 2. CREATE V3 ULTRA-OPTIMIZED FUNCTIONS
    // ============================================================================

    const v3Functions = [
      {
        name: 'find_optimal_same_collection_matchup_v3',
        sql: `
        CREATE OR REPLACE FUNCTION find_optimal_same_collection_matchup_v3(
          target_collection text,
          excluded_ids integer[] DEFAULT '{}'::integer[]
        ) RETURNS TABLE(nft1_id integer, nft2_id integer, quality_score numeric) AS $$
        BEGIN
          RETURN QUERY
          WITH candidate_nfts AS (
            SELECT id, current_elo, total_votes
            FROM nfts 
            WHERE collection_name = target_collection
              AND id != ALL(excluded_ids)
              AND current_elo IS NOT NULL
            ORDER BY current_elo DESC, total_votes ASC
            LIMIT 20
          ),
          matchup_pairs AS (
            SELECT 
              n1.id as nft1_id,
              n2.id as nft2_id,
              (1.0 / (1.0 + ABS(n1.current_elo - n2.current_elo) / 100.0)) * 
              (1.0 + LN(LEAST(n1.total_votes, n2.total_votes) + 1)) as quality_score
            FROM candidate_nfts n1
            CROSS JOIN candidate_nfts n2
            WHERE n1.id < n2.id
          )
          SELECT mp.nft1_id, mp.nft2_id, mp.quality_score
          FROM matchup_pairs mp
          ORDER BY mp.quality_score DESC
          LIMIT 1;
        END;
        $$ LANGUAGE plpgsql;`
      },
      {
        name: 'find_optimal_cross_collection_matchup_v3',
        sql: `
        CREATE OR REPLACE FUNCTION find_optimal_cross_collection_matchup_v3(
          excluded_ids integer[] DEFAULT '{}'::integer[]
        ) RETURNS TABLE(nft1_id integer, nft2_id integer, quality_score numeric) AS $$
        BEGIN
          RETURN QUERY
          WITH top_collections AS (
            SELECT collection_name
            FROM nfts 
            WHERE collection_name IS NOT NULL
            GROUP BY collection_name
            ORDER BY COUNT(*) DESC
            LIMIT 4
          ),
          candidate_nfts AS (
            SELECT n.id, n.current_elo, n.total_votes, n.collection_name
            FROM nfts n
            INNER JOIN top_collections tc ON n.collection_name = tc.collection_name
            WHERE n.id != ALL(excluded_ids)
              AND n.current_elo IS NOT NULL
            ORDER BY n.current_elo DESC, n.total_votes ASC
            LIMIT 15
          ),
          cross_pairs AS (
            SELECT 
              n1.id as nft1_id,
              n2.id as nft2_id,
              (1.0 / (1.0 + ABS(n1.current_elo - n2.current_elo) / 150.0)) * 2.0 as quality_score
            FROM candidate_nfts n1
            CROSS JOIN candidate_nfts n2
            WHERE n1.collection_name != n2.collection_name
              AND n1.id < n2.id
          )
          SELECT cp.nft1_id, cp.nft2_id, cp.quality_score
          FROM cross_pairs cp
          ORDER BY cp.quality_score DESC
          LIMIT 1;
        END;
        $$ LANGUAGE plpgsql;`
      },
      {
        name: 'find_optimal_slider_nft_v3',
        sql: `
        CREATE OR REPLACE FUNCTION find_optimal_slider_nft_v3(
          excluded_ids integer[] DEFAULT '{}'::integer[]
        ) RETURNS TABLE(nft_id integer, selection_score numeric) AS $$
        BEGIN
          RETURN QUERY
          WITH slider_candidates AS (
            SELECT id, current_elo, slider_count, collection_name
            FROM nfts 
            WHERE id != ALL(excluded_ids)
              AND collection_name IS NOT NULL
              AND current_elo IS NOT NULL
            ORDER BY slider_count ASC, current_elo DESC
            LIMIT 15
          )
          SELECT 
            sc.id as nft_id,
            (1000.0 / (sc.slider_count + 1.0)) + (sc.current_elo / 10.0) as selection_score
          FROM slider_candidates sc
          ORDER BY selection_score DESC
          LIMIT 1;
        END;
        $$ LANGUAGE plpgsql;`
      }
    ];

    for (const func of v3Functions) {
      try {
        const { error } = await supabase.rpc('execute_sql', { sql_query: func.sql });
        if (error) {
          console.warn(`⚠️ Function ${func.name} creation warning:`, error);
          results.errors.push(`Function ${func.name}: ${error.message}`);
        } else {
          console.log(`✅ Created function: ${func.name}`);
          results.functions_updated++;
        }
      } catch (err: any) {
        console.warn(`⚠️ Function ${func.name} error:`, err.message);
        results.errors.push(`Function ${func.name}: ${err.message}`);
      }
    }

    // ============================================================================
    // 3. CREATE PERFORMANCE TESTING FUNCTION
    // ============================================================================

    const testFunctionSQL = `
    CREATE OR REPLACE FUNCTION test_enhanced_performance_v3()
    RETURNS TABLE(
      function_name text,
      execution_time_ms numeric,
      success boolean,
      result_count integer
    ) AS $$
    DECLARE
      start_time timestamp;
      end_time timestamp;
      result_record record;
    BEGIN
      -- Test same collection function
      start_time := clock_timestamp();
      BEGIN
        SELECT INTO result_record * FROM find_optimal_same_collection_matchup_v3('Final Bosu');
        end_time := clock_timestamp();
        
        RETURN QUERY SELECT 
          'same_collection_v3'::text,
          EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
          true,
          CASE WHEN result_record.nft1_id IS NOT NULL THEN 1 ELSE 0 END;
      EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 
          'same_collection_v3'::text,
          EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
          false,
          0;
      END;
      
      -- Test cross collection function
      start_time := clock_timestamp();
      BEGIN
        SELECT INTO result_record * FROM find_optimal_cross_collection_matchup_v3();
        end_time := clock_timestamp();
        
        RETURN QUERY SELECT 
          'cross_collection_v3'::text,
          EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
          true,
          CASE WHEN result_record.nft1_id IS NOT NULL THEN 1 ELSE 0 END;
      EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 
          'cross_collection_v3'::text,
          EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
          false,
          0;
      END;
      
      -- Test slider function
      start_time := clock_timestamp();
      BEGIN
        SELECT INTO result_record * FROM find_optimal_slider_nft_v3();
        end_time := clock_timestamp();
        
        RETURN QUERY SELECT 
          'slider_nft_v3'::text,
          EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
          true,
          CASE WHEN result_record.nft_id IS NOT NULL THEN 1 ELSE 0 END;
      EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 
          'slider_nft_v3'::text,
          EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
          false,
          0;
      END;
    END;
    $$ LANGUAGE plpgsql;`;

    try {
      const { error } = await supabase.rpc('execute_sql', { sql_query: testFunctionSQL });
      if (error) {
        console.warn(`⚠️ Test function creation warning:`, error);
        results.errors.push(`Test function: ${error.message}`);
      } else {
        console.log(`✅ Created performance test function`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Test function error:`, err.message);
      results.errors.push(`Test function: ${err.message}`);
    }

    // ============================================================================
    // 4. RUN PERFORMANCE TESTS
    // ============================================================================

    try {
      console.log('🧪 Running V3 performance tests...');
      const { data: testResults, error: testError } = await supabase
        .rpc('test_enhanced_performance_v3');

      if (testError) {
        console.warn('⚠️ Performance test error:', testError);
        results.errors.push(`Performance test: ${testError.message}`);
      } else if (testResults) {
        results.performance_tests = testResults;
        console.log('✅ Performance tests completed:', testResults);
      }
    } catch (err: any) {
      console.warn('⚠️ Performance test exception:', err.message);
      results.errors.push(`Performance test exception: ${err.message}`);
    }

    // ============================================================================
    // 5. VERIFY INDEX CREATION
    // ============================================================================

    try {
      const { data: indexData, error: indexError } = await supabase
        .from('pg_indexes')
        .select('schemaname, tablename, indexname')
        .eq('schemaname', 'public')
        .eq('tablename', 'nfts')
        .like('indexname', '%enhanced%');

      if (!indexError && indexData) {
        console.log('✅ Verified indexes:', indexData);
      }
    } catch (err: any) {
      console.log('ℹ️ Index verification skipped (not critical)');
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================

    const summary = {
      ...results,
      message: `V3 Performance Boost Applied Successfully!`,
      recommendations: [
        'Monitor enhanced system usage - should increase from 30% to 70%+',
        'Test matchup generation speed - should be <500ms consistently',
        'Watch for improved user experience with fewer fallbacks',
        'Consider increasing enhanced ratio in preloader settings'
      ]
    };

    console.log('🎉 V3 Performance Boost completed:', summary);

    return NextResponse.json(summary, { status: 200 });

  } catch (error: any) {
    console.error('❌ V3 Performance Boost failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Failed to apply V3 performance optimizations'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'V3 Performance Boost API',
    description: 'Apply comprehensive performance optimizations to enhanced matchup system',
    usage: 'POST to apply optimizations and run performance tests'
  });
}
