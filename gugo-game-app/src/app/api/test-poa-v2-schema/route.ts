/**
 * 🧪 POA v2 Schema Test API
 * 
 * Test endpoint to verify Phase A1 database schema changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing POA v2 Phase A1 Schema Changes...');
    
    // Test 1: Check NFT table columns
    const { data: nftColumns, error: nftError } = await supabase
      .from('nfts')
      .select('id, elo_mean, elo_sigma, poa_v2, poa_v2_updated_at, poa_v2_components, poa_v2_confidence, poa_v2_explanation')
      .limit(1);
    
    if (nftError) {
      throw new Error(`NFT columns test failed: ${nftError.message}`);
    }
    
    // Test 2: Check User table columns
    const { data: userColumns, error: userError } = await supabase
      .from('users')
      .select('id, slider_mean, slider_std, slider_count, slider_m2, reliability_score, reliability_count, reliability_updated_at')
      .limit(1);
    
    if (userError) {
      throw new Error(`User columns test failed: ${userError.message}`);
    }
    
    // Test 3: Check helper functions
    const { data: systemStatus, error: statusError } = await supabase
      .rpc('get_poa_v2_system_status');
    
    if (statusError) {
      throw new Error(`System status function failed: ${statusError.message}`);
    }
    
    // Test 4: Check data validation function
    const { data: validationResults, error: validationError } = await supabase
      .rpc('validate_poa_v2_data');
    
    if (validationError) {
      throw new Error(`Data validation function failed: ${validationError.message}`);
    }
    
    // Test 5: Sample data queries
    const { data: sampleNFTs, error: sampleError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, elo_sigma, poa_v2, current_elo, total_votes')
      .not('elo_mean', 'is', null)
      .order('elo_mean', { ascending: false })
      .limit(5);
    
    if (sampleError) {
      throw new Error(`Sample NFT query failed: ${sampleError.message}`);
    }
    
    const { data: sampleUsers, error: userSampleError } = await supabase
      .from('users')
      .select('id, wallet_address, slider_mean, slider_std, slider_count, reliability_score, reliability_count')
      .not('slider_mean', 'is', null)
      .limit(5);
    
    if (userSampleError) {
      throw new Error(`Sample user query failed: ${userSampleError.message}`);
    }
    
    // Analyze results
    const testResults = {
      nftColumnsExist: nftColumns !== null,
      userColumnsExist: userColumns !== null,
      helperFunctionsWork: systemStatus !== null && validationResults !== null,
      sampleDataAccessible: sampleNFTs !== null && sampleUsers !== null,
    };
    
    const allTestsPassed = Object.values(testResults).every(test => test === true);
    
    // Count validation issues
    const validationIssues = validationResults?.filter((result: any) => result.status === 'FAIL') || [];
    
    console.log('✅ POA v2 Phase A1 Schema Test Results:', {
      testResults,
      allPassed: allTestsPassed,
      validationIssues: validationIssues.length,
    });
    
    return NextResponse.json({
      success: true,
      phase: 'A1',
      message: 'POA v2 schema test completed',
      data: {
        testResults,
        allTestsPassed,
        systemStatus: systemStatus?.[0] || null,
        validationResults: validationResults || [],
        validationIssues,
        sampleData: {
          nfts: sampleNFTs?.map(nft => ({
            id: nft.id,
            name: nft.name,
            collection: nft.collection_name,
            eloMean: nft.elo_mean,
            eloSigma: nft.elo_sigma,
            poaV2: nft.poa_v2,
            currentElo: nft.current_elo,
            totalVotes: nft.total_votes,
          })) || [],
          users: sampleUsers?.map(user => ({
            id: user.id,
            wallet: user.wallet_address?.substring(0, 10) + '...',
            sliderMean: user.slider_mean,
            sliderStd: user.slider_std,
            sliderCount: user.slider_count,
            reliabilityScore: user.reliability_score,
            reliabilityCount: user.reliability_count,
          })) || [],
        },
        schemaInfo: {
          nftColumnsAdded: [
            'elo_mean', 'elo_sigma', 'poa_v2', 'poa_v2_updated_at',
            'poa_v2_components', 'poa_v2_confidence', 'poa_v2_explanation'
          ],
          userColumnsAdded: [
            'slider_mean', 'slider_std', 'slider_count', 'slider_m2',
            'reliability_score', 'reliability_count', 'reliability_updated_at'
          ],
          indexesCreated: [
            'idx_nfts_poa_v2', 'idx_nfts_poa_v2_confidence',
            'idx_nfts_elo_bayesian', 'idx_users_reliability', 'idx_users_slider_stats'
          ],
          functionsCreated: [
            'get_poa_v2_system_status', 'validate_poa_v2_data'
          ],
        },
      }
    });
    
  } catch (error) {
    console.error('❌ POA v2 Phase A1 schema test failed:', error);
    
    return NextResponse.json({
      success: false,
      phase: 'A1',
      error: 'POA v2 schema test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

