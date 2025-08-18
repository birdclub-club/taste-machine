/**
 * API endpoint to debug RLS status on NFTs table
 * Based on user's excellent RLS debugging suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging RLS status on NFTs table...');

    // Check RLS status on NFTs table (using user's suggested query)
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('debug_rls_status');

    if (rlsError) {
      console.log('⚠️ RPC call failed, trying direct approach...');
    }

    // Try to check current user/session status
    console.log('👤 Checking current auth status...');
    const { data: user, error: userError } = await supabase.auth.getUser();
    
    console.log('Auth check result:', { 
      user: user?.user?.id || 'No user', 
      error: userError?.message || 'No error' 
    });

    // Try a simple count with detailed error info
    console.log('📊 Testing NFTs table access...');
    const { count, error: countError, status, statusText } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true });

    console.log('NFTs access result:', {
      count,
      error: countError,
      status,
      statusText,
      errorCode: countError?.code,
      errorDetails: countError?.details,
      errorHint: countError?.hint
    });

    // Compare with users table (which works)
    console.log('👥 Testing users table access for comparison...');
    const { count: userCount, error: userCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log('Users access result:', {
      count: userCount,
      error: userCountError
    });

    return NextResponse.json({
      success: true,
      debug: {
        authStatus: {
          hasUser: !!user?.user,
          userId: user?.user?.id || null,
          error: userError?.message || null
        },
        nftsTable: {
          accessible: !countError,
          count: count || 0,
          error: countError,
          errorCode: countError?.code,
          errorDetails: countError?.details
        },
        usersTable: {
          accessible: !userCountError,
          count: userCount || 0,
          error: userCountError
        },
        comparison: {
          usersWork: !userCountError,
          nftsWork: !countError,
          issueConfirmed: !userCountError && !!countError
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in RLS debug:', error);
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