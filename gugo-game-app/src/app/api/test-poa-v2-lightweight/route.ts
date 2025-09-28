/**
 * 🧪 POA v2 Lightweight Test API
 * 
 * Lightweight test endpoint that avoids database timeouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { processVoteForPOAv2, VoteData } from '../../../lib/poa-v2-vote-processor';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action, nftAId, nftBId, userWallet } = await request.json();
    
    console.log('🧪 Testing POA v2 with lightweight approach...');
    
    // Temporarily override environment for testing
    const originalEnv = process.env.POA_V2_ENABLED;
    process.env.POA_V2_ENABLED = 'true';
    process.env.POA_V2_COMPUTATION = 'true';
    
    try {
      switch (action) {
        case 'test_specific_nfts':
          if (!nftAId || !nftBId || !userWallet) {
            return NextResponse.json({
              success: false,
              error: 'Missing required parameters: nftAId, nftBId, userWallet'
            }, { status: 400 });
          }
          return await testSpecificNFTs(nftAId, nftBId, userWallet);
          
        case 'test_from_sample':
          return await testFromSampleData();
          
        case 'validate_functions':
          return await validatePOAv2Functions();
          
        default:
          return NextResponse.json({
            success: false,
            error: 'Invalid action',
            availableActions: ['test_specific_nfts', 'test_from_sample', 'validate_functions']
          }, { status: 400 });
      }
    } finally {
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.POA_V2_ENABLED = originalEnv;
      } else {
        delete process.env.POA_V2_ENABLED;
      }
      delete process.env.POA_V2_COMPUTATION;
    }
    
  } catch (error) {
    console.error('❌ POA v2 lightweight test failed:', error);
    
    return NextResponse.json({
      success: false,
      phase: 'A2',
      error: 'POA v2 lightweight test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function testSpecificNFTs(nftAId: string, nftBId: string, userWallet: string) {
  try {
    // Get specific NFTs (fast query)
    const { data: nfts, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, elo_sigma, total_votes')
      .in('id', [nftAId, nftBId]);
    
    if (nftError || !nfts || nfts.length !== 2) {
      throw new Error(`Failed to get specific NFTs: ${nftError?.message}`);
    }
    
    // Verify user exists (fast query)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('wallet_address, slider_mean, reliability_score')
      .eq('wallet_address', userWallet)
      .single();
    
    if (userError || !user) {
      throw new Error(`Failed to get user: ${userError?.message}`);
    }
    
    const testVote: VoteData = {
      nft_a_id: nfts[0].id,
      nft_b_id: nfts[1].id,
      winner: 'a',
      user_wallet: userWallet,
      vote_type: 'regular',
      slider_value: 75,
      is_fire_vote: false,
    };
    
    console.log('🎯 Processing specific NFT test vote:', {
      nftA: `${nfts[0].name} (${nfts[0].elo_mean})`,
      nftB: `${nfts[1].name} (${nfts[1].elo_mean})`,
      user: userWallet.substring(0, 10) + '...',
    });
    
    // Process the vote
    const result = await processVoteForPOAv2(testVote);
    
    return NextResponse.json({
      success: result.success,
      phase: 'A2',
      message: 'POA v2 specific NFT test completed',
      data: {
        testVote: {
          nftA: { id: nfts[0].id, name: nfts[0].name, eloMean: nfts[0].elo_mean },
          nftB: { id: nfts[1].id, name: nfts[1].name, eloMean: nfts[1].elo_mean },
          user: userWallet.substring(0, 10) + '...',
          winner: testVote.winner,
          voteType: testVote.vote_type,
          sliderValue: testVote.slider_value,
        },
        result: {
          success: result.success,
          nftAUpdated: result.nft_a_updated,
          nftBUpdated: result.nft_b_updated,
          userUpdated: {
            sliderMean: result.user_updated.slider_mean,
            sliderStd: result.user_updated.slider_std,
            sliderCount: result.user_updated.slider_count,
            reliabilityScore: result.user_updated.reliability_score,
            reliabilityCount: result.user_updated.reliability_count,
          },
          poaV2Computed: result.poa_v2_computed,
          error: result.error,
        },
      }
    });
    
  } catch (error) {
    throw new Error(`Specific NFT test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testFromSampleData() {
  try {
    // Use the sample data we know exists from the schema test
    const sampleNFTs = [
      'ffc2a05e-0837-4abf-b118-cc6e58c808fb', // BEARISH #3269
      'f84cc2ee-a453-461f-9979-7a268c57d7f2'  // BEARISH #4043
    ];
    
    const sampleUser = '0x4F21E3d6C8B2A8b9F1234567890abcdef1234567'; // Sample wallet
    
    return await testSpecificNFTs(sampleNFTs[0], sampleNFTs[1], sampleUser);
    
  } catch (error) {
    throw new Error(`Sample data test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function validatePOAv2Functions() {
  try {
    // Test the POA v2 utility functions without database operations
    const { 
      updateEloBayesian, 
      updateUserStats, 
      normalizeSliderValue, 
      updateReliabilityScore, 
      calculateFireComponent, 
      computePOAv2 
    } = await import('../../../lib/poa-v2-utils');
    
    const tests = {
      eloUpdate: updateEloBayesian(1200, 350, 1250, 1, false),
      userStatsUpdate: updateUserStats({ 
        slider_mean: 60, 
        slider_std: 15, 
        slider_count: 10, 
        reliability_score: 1.0, 
        reliability_count: 5 
      }, 75),
      sliderNormalization: normalizeSliderValue(75, 60, 15),
      reliabilityUpdate: updateReliabilityScore(1.0, true, 0.2),
      fireComponent: calculateFireComponent(3.5),
      poaComputation: computePOAv2(1250, 200, 65, 45, 1.1),
    };
    
    return NextResponse.json({
      success: true,
      phase: 'A2',
      message: 'POA v2 function validation completed',
      data: {
        functionTests: tests,
        allFunctionsWorking: Object.values(tests).every(test => 
          test !== null && test !== undefined && typeof test === 'object'
        ),
        testSummary: {
          eloUpdateWorking: tests.eloUpdate.mean > 0,
          userStatsWorking: tests.userStatsUpdate.slider_count > 10,
          normalizationWorking: tests.sliderNormalization >= 0 && tests.sliderNormalization <= 100,
          reliabilityWorking: tests.reliabilityUpdate > 0,
          fireWorking: tests.fireComponent >= 0,
          poaWorking: tests.poaComputation.poa_v2 >= 0 && tests.poaComputation.poa_v2 <= 100,
        }
      }
    });
    
  } catch (error) {
    throw new Error(`Function validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

