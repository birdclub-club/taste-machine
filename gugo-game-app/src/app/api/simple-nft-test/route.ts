/**
 * API endpoint to test simple NFT queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing simple NFT queries...');

    // Test 1: Basic select with limit
    console.log('📋 Test 1: Basic select...');
    const { data: basicData, error: basicError } = await supabase
      .from('nfts')
      .select('id, name')
      .limit(1);

    console.log('Basic select result:', { data: basicData, error: basicError });

    // Test 2: Try to insert a simple test record
    console.log('📝 Test 2: Simple insert...');
    const testNFT = {
      token_id: 'test-' + Date.now(),
      name: 'Test NFT',
      description: 'Test description', 
      image: 'https://example.com/test.jpg',
      collection_name: 'Test Collection',
      contract_address: '0x1234567890123456789012345678901234567890'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('nfts')
      .insert([testNFT])
      .select();

    console.log('Insert result:', { data: insertData, error: insertError });

    return NextResponse.json({
      success: true,
      tests: {
        basicSelect: {
          success: !basicError,
          data: basicData,
          error: basicError
        },
        simpleInsert: {
          success: !insertError,
          data: insertData,
          error: insertError
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in simple NFT test:', error);
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