import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🧮 Testing CAI schema setup...');

    // Test 1: Check if collection_management table exists and has CAI columns
    let columns: any[] = [];
    let columnsError = null;
    try {
      const { data, error } = await supabase
        .from('collection_management')
        .select('cai_score, cai_confidence, cai_cohesion, cai_coverage, cai_updated_at, cai_components, cai_explanation')
        .limit(0);
      
      if (!error) {
        columns = [
          { column_name: 'cai_score', status: 'exists' },
          { column_name: 'cai_confidence', status: 'exists' },
          { column_name: 'cai_cohesion', status: 'exists' },
          { column_name: 'cai_coverage', status: 'exists' },
          { column_name: 'cai_updated_at', status: 'exists' },
          { column_name: 'cai_components', status: 'exists' },
          { column_name: 'cai_explanation', status: 'exists' },
        ];
      } else {
        columnsError = error;
      }
    } catch (error) {
      columnsError = error;
    }

    // Test 2: Check if CAI tables exist
    let tables = [];
    let tablesError = null;
    
    // Test cai_history table
    try {
      const { data, error } = await supabase
        .from('cai_history')
        .select('id')
        .limit(0);
      
      if (!error) {
        tables.push({ table_name: 'cai_history', status: 'exists' });
      }
    } catch (error) {
      // Table doesn't exist
    }
    
    // Test cai_computation_queue table
    try {
      const { data, error } = await supabase
        .from('cai_computation_queue')
        .select('id')
        .limit(0);
      
      if (!error) {
        tables.push({ table_name: 'cai_computation_queue', status: 'exists' });
      }
    } catch (error) {
      // Table doesn't exist
    }

    // Test 3: Skip index check for now (requires admin access)
    const indexes: any[] = [];
    const indexesError = null;

    // Test 4: Skip function check for now (requires admin access)
    const functions: any[] = [];
    const functionsError = null;

    // Test 5: Test CAI system status function
    let systemStatus = null;
    try {
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_cai_system_status');

      if (statusError) {
        console.warn('⚠️ CAI system status function failed:', statusError);
      } else {
        systemStatus = statusData;
      }
    } catch (error) {
      console.warn('⚠️ CAI system status function not available:', error);
    }

    // Test 6: Test CAI data validation function
    let validationResults = null;
    try {
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_cai_data');

      if (validationError) {
        console.warn('⚠️ CAI validation function failed:', validationError);
      } else {
        validationResults = validationData;
      }
    } catch (error) {
      console.warn('⚠️ CAI validation function not available:', error);
    }

    // Test 7: Count active collections for CAI readiness
    const { data: collectionCount, error: countError } = await supabase
      .from('collection_management')
      .select('collection_name, active')
      .eq('active', true);

    if (countError) {
      console.error('❌ Failed to count active collections:', countError);
    }

    console.log('✅ CAI schema test completed');

    return NextResponse.json({
      success: true,
      phase: 'B1',
      message: 'CAI schema test completed',
      data: {
        cai_columns: {
          count: columns?.length || 0,
          columns: columns || [],
        },
        cai_tables: {
          count: tables?.length || 0,
          tables: tables || [],
        },
        cai_indexes: {
          count: indexes?.length || 0,
          indexes: indexes || [],
        },
        cai_functions: {
          count: functions?.length || 0,
          functions: functions || [],
        },
        system_status: systemStatus,
        validation_results: validationResults,
        active_collections: {
          count: collectionCount?.length || 0,
          ready_for_cai: collectionCount?.length || 0,
        },
        schema_readiness: {
          columns_ready: (columns?.length || 0) >= 6, // Should have 6+ CAI columns
          tables_ready: (tables?.length || 0) >= 2,   // Should have 2 CAI tables
          indexes_ready: (indexes?.length || 0) >= 4, // Should have 4+ CAI indexes
          functions_ready: (functions?.length || 0) >= 2, // Should have 2 CAI functions
        },
      },
    });

  } catch (error) {
    console.error('❌ CAI schema test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
