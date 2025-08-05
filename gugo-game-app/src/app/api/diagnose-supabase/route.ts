/**
 * Comprehensive Supabase connection diagnostics
 * Let's figure out what's really wrong
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Running comprehensive Supabase diagnostics...');

    // Check environment variables
    const envCheck = {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'FOUND' : 'MISSING',
      SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'FOUND' : 'MISSING',
      urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL,
      keyValue: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'MISSING'
    };

    console.log('Environment check:', envCheck);

    // Test 1: Try creating Supabase client manually with explicit values
    console.log('🧪 Test 1: Manual Supabase client creation...');
    const { createClient } = await import('@supabase/supabase-js');
    
    const manualClient = createClient(
      'https://xcruwistwdmytlcbqbij.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcnV3aXN0d2RteXRsY2JxYmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNzIzNTAsImV4cCI6MjA0OTk0ODM1MH0.jI6Jqko-vUiJsLGrLy9C_M21fEHrEXQVBLs9zVD4Xe8'
    );

    const { data: manualData, error: manualError } = await manualClient
      .from('nfts')
      .select('count')
      .limit(1);

    console.log('Manual client test:', { data: manualData, error: manualError });

    // Test 2: Try the imported client
    console.log('🧪 Test 2: Imported Supabase client...');
    const { supabase } = await import('@lib/supabase');
    
    const { data: importedData, error: importedError } = await supabase
      .from('nfts')
      .select('count')
      .limit(1);

    console.log('Imported client test:', { data: importedData, error: importedError });

    // Test 3: Try a different table that might have different permissions
    console.log('🧪 Test 3: Try users table...');
    const { data: usersData, error: usersError } = await manualClient
      .from('users')
      .select('count')
      .limit(1);

    console.log('Users table test:', { data: usersData, error: usersError });

    return NextResponse.json({
      success: true,
      diagnostics: {
        environment: envCheck,
        tests: {
          manualClient: {
            success: !manualError,
            data: manualData,
            error: manualError
          },
          importedClient: {
            success: !importedError,
            data: importedData,
            error: importedError
          },
          usersTable: {
            success: !usersError,
            data: usersData,
            error: usersError
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in diagnostics:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Diagnostics failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}