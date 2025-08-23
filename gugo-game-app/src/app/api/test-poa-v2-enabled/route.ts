/**
 * 🧪 POA v2 Enabled Test API
 * 
 * Test endpoint that temporarily enables POA v2 for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { processVoteForPOAv2, VoteData } from '../../../lib/poa-v2-vote-processor';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    console.log('🧪 Testing POA v2 with forced enablement...');
    
    // Temporarily override environment for testing
    const originalEnv = process.env.POA_V2_ENABLED;
    process.env.POA_V2_ENABLED = 'true';
    process.env.POA_V2_COMPUTATION = 'true';
    
    try {
      switch (action) {
        case 'test_with_real_data':
          return await testWithRealData();
          
        case 'get_sample_data':
          return await getSampleData();
          
        default:
          return NextResponse.json({
            success: false,
            error: 'Invalid action',
            availableActions: ['test_with_real_data', 'get_sample_data']
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
    console.error('❌ POA v2 enabled test failed:', error);
    
    return NextResponse.json({
      success: false,
      phase: 'A2',
      error: 'POA v2 enabled test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function testWithRealData() {
  try {
    // Get two random NFTs for testing
    const { data: nfts, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, elo_sigma, total_votes')
      .not('elo_mean', 'is', null)
      .order('total_votes', { ascending: false })
      .limit(2);
    
    if (nftError || !nfts || nfts.length < 2) {
      throw new Error(`Failed to get test NFTs: ${nftError?.message}`);
    }
    
    // Get a real user for testing
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('wallet_address, slider_mean, reliability_score')
      .not('wallet_address', 'is', null)
      .limit(1);
    
    if (userError || !users || users.length === 0) {
      throw new Error(`Failed to get test user: ${userError?.message}`);
    }
    
    const testVote: VoteData = {
      nft_a_id: nfts[0].id,
      nft_b_id: nfts[1].id,
      winner: 'a',
      user_wallet: users[0].wallet_address,
      vote_type: 'regular',
      slider_value: 75,
      is_fire_vote: false,
    };
    
    console.log('🎯 Processing test vote with POA v2 enabled:', {
      nftA: `${nfts[0].name} (${nfts[0].elo_mean})`,
      nftB: `${nfts[1].name} (${nfts[1].elo_mean})`,
      user: users[0].wallet_address.substring(0, 10) + '...',
    });
    
    // Process the vote
    const result = await processVoteForPOAv2(testVote);
    
    return NextResponse.json({
      success: result.success,
      phase: 'A2',
      message: 'POA v2 vote processing test with forced enablement completed',
      data: {
        testVote: {
          nftA: { id: nfts[0].id, name: nfts[0].name, eloMean: nfts[0].elo_mean },
          nftB: { id: nfts[1].id, name: nfts[1].name, eloMean: nfts[1].elo_mean },
          user: users[0].wallet_address.substring(0, 10) + '...',
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
        environmentOverride: {
          POA_V2_ENABLED: 'true (forced)',
          POA_V2_COMPUTATION: 'true (forced)',
        },
      }
    });
    
  } catch (error) {
    throw new Error(`Real data test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getSampleData() {
  try {
    // Get sample NFTs
    const { data: nfts, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, elo_sigma, total_votes, poa_v2')
      .not('elo_mean', 'is', null)
      .order('total_votes', { ascending: false })
      .limit(10);
    
    if (nftError) {
      throw new Error(`Failed to get sample NFTs: ${nftError.message}`);
    }
    
    // Get sample users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('wallet_address, slider_mean, slider_std, slider_count, reliability_score, reliability_count')
      .not('wallet_address', 'is', null)
      .limit(5);
    
    if (userError) {
      throw new Error(`Failed to get sample users: ${userError.message}`);
    }
    
    // Get system status
    const { data: systemStatus, error: statusError } = await supabase
      .rpc('get_poa_v2_system_status');
    
    return NextResponse.json({
      success: true,
      phase: 'A2',
      message: 'Sample data retrieved with POA v2 forced enabled',
      data: {
        nfts: nfts?.map(nft => ({
          id: nft.id,
          name: nft.name,
          collection: nft.collection_name,
          eloMean: nft.elo_mean,
          eloSigma: nft.elo_sigma,
          totalVotes: nft.total_votes,
          poaV2: nft.poa_v2,
        })) || [],
        users: users?.map(user => ({
          wallet: user.wallet_address?.substring(0, 10) + '...',
          sliderMean: user.slider_mean,
          sliderStd: user.slider_std,
          sliderCount: user.slider_count,
          reliabilityScore: user.reliability_score,
          reliabilityCount: user.reliability_count,
        })) || [],
        systemStatus: systemStatus?.[0] || null,
        environmentOverride: {
          POA_V2_ENABLED: 'true (forced)',
          POA_V2_COMPUTATION: 'true (forced)',
        },
      }
    });
    
  } catch (error) {
    throw new Error(`Sample data retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

