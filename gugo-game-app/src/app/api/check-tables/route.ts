/**
 * API endpoint to check what tables exist in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking database tables...');

    // Check if we can access information_schema
    const { data: tables, error } = await supabase
      .rpc('get_table_list'); // This might not work, let's try a different approach

    if (error) {
      console.log('💡 Trying alternative table check...');
      
      // Try to query each table we expect to exist
      const tableChecks = await Promise.allSettled([
        supabase.from('users').select('count').limit(1),
        supabase.from('nfts').select('count').limit(1),
        supabase.from('votes').select('count').limit(1),
        supabase.from('matchups').select('count').limit(1)
      ]);

      const tableStatus = {
        users: tableChecks[0].status === 'fulfilled',
        nfts: tableChecks[1].status === 'fulfilled', 
        votes: tableChecks[2].status === 'fulfilled',
        matchups: tableChecks[3].status === 'fulfilled'
      };

      console.log('📊 Table existence check:', tableStatus);

      return NextResponse.json({
        success: true,
        method: 'individual_checks',
        tables: tableStatus,
        missingTables: Object.entries(tableStatus)
          .filter(([_, exists]) => !exists)
          .map(([table, _]) => table)
      });
    }

    return NextResponse.json({
      success: true,
      method: 'rpc_call',
      tables
    });

  } catch (error) {
    console.error('❌ Error checking tables:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error 
      },
      { status: 500 }
    );
  }
}