import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 VERIFYING FUGZ FIX: Checking current database state...');
    
    const results = {
      timestamp: new Date().toISOString(),
      database_check: {},
      collection_status: {},
      potential_issues: [] as string[]
    };
    
    // 1. Check if any NFTs still have wrong collection names
    const fugzIpfsHash = 'bafybeigtz2vy5mewwum5ut4fcn5trzmufsz5jlsnfyxrsmvoxocurvqh4y';
    
    const { data: wronglyLabeled, error: wrongError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, image')
      .eq('collection_name', 'Final Bosu')
      .ilike('image', `%${fugzIpfsHash}%`)
      .limit(5);
    
    if (wrongError) {
      results.potential_issues.push(`Database query error: ${wrongError.message}`);
    } else {
      results.database_check = {
        final_bosu_with_fugz_hash: wronglyLabeled?.length || 0,
        examples: wronglyLabeled?.slice(0, 3) || []
      };
      
      if (wronglyLabeled && wronglyLabeled.length > 0) {
        results.potential_issues.push(`CRITICAL: ${wronglyLabeled.length} NFTs still have Final Bosu label with Fugz IPFS hash`);
      }
    }
    
    // 2. Check collection status
    const { data: collections, error: collError } = await supabase
      .from('collections')
      .select('name, is_active')
      .order('name');
    
    if (collError) {
      results.potential_issues.push(`Collection status error: ${collError.message}`);
    } else {
      results.collection_status = {
        total_collections: collections?.length || 0,
        active: collections?.filter(c => c.is_active).map(c => c.name) || [],
        inactive: collections?.filter(c => !c.is_active).map(c => c.name) || []
      };
      
      const fugzActive = collections?.find(c => c.name === 'Fugz')?.is_active;
      if (fugzActive) {
        results.potential_issues.push('CRITICAL: Fugz collection is marked as ACTIVE in database');
      }
    }
    
    // 3. Check for any Final Bosu NFTs with suspicious IPFS hashes
    const { data: finalBosuNFTs, error: fbError } = await supabase
      .from('nfts')
      .select('id, name, image, token_id')
      .eq('collection_name', 'Final Bosu')
      .limit(10);
    
    if (!fbError && finalBosuNFTs) {
      const suspiciousNFTs = finalBosuNFTs.filter(nft => 
        nft.image.includes(fugzIpfsHash)
      );
      
      if (suspiciousNFTs.length > 0) {
        results.potential_issues.push(`CRITICAL: ${suspiciousNFTs.length} Final Bosu NFTs still have Fugz IPFS hashes`);
      }
    }
    
    // 4. Summary
    const isFixed = results.potential_issues.length === 0;
    
    console.log(`🔍 Fugz fix verification: ${isFixed ? 'PASSED' : 'FAILED'}`);
    if (!isFixed) {
      console.log('❌ Issues found:', results.potential_issues);
    }
    
    return NextResponse.json({
      success: true,
      is_fixed: isFixed,
      summary: isFixed ? 'Database fix successful' : 'Issues still exist',
      ...results
    });
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

