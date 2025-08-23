/**
 * 🕐 POA v2 Scheduler Admin API
 * 
 * Manage trigger-based + hourly batch computation system
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  shouldTriggerComputation,
  processTrigger,
  runHourlyBatch,
  simulateTrigger,
  getSchedulerConfig 
} from '../../../../lib/poa-v2-scheduler';
import { supabase } from '../../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    switch (action) {
      case 'status':
        return await getSchedulerStatus();
        
      case 'config':
        return NextResponse.json({
          success: true,
          data: getSchedulerConfig()
        });
        
      case 'batch_candidates':
        return await getBatchCandidates();
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['status', 'config', 'batch_candidates']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ POA v2 scheduler GET failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get scheduler data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, nftId, triggerType, batchSize } = await request.json();
    
    console.log('🕐 POA v2 Scheduler API called:', { action, nftId, triggerType });
    
    switch (action) {
      case 'test_trigger':
        return await testTrigger(nftId, triggerType);
        
      case 'run_batch':
        return await runBatchNow(batchSize);
        
      case 'simulate_trigger':
        return await testSimulateTrigger(nftId, triggerType);
        
      case 'check_trigger_conditions':
        return await checkTriggerConditions(nftId);
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['test_trigger', 'run_batch', 'simulate_trigger', 'check_trigger_conditions']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ POA v2 scheduler POST failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process scheduler action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getSchedulerStatus() {
  try {
    // Get current system statistics
    const { data: stats } = await supabase.rpc('get_poa_v2_system_status');
    
    // Get recent computation activity (last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentComputations } = await supabase
      .from('nfts')
      .select('id, name, collection_name, poa_v2, poa_v2_updated_at')
      .not('poa_v2_updated_at', 'is', null)
      .gte('poa_v2_updated_at', twentyFourHoursAgo)
      .order('poa_v2_updated_at', { ascending: false })
      .limit(10);
    
    // Get NFTs ready for triggers
    const { data: triggerCandidates } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes')
      .is('poa_v2', null)
      .gte('total_votes', 5) // High-priority candidates
      .order('total_votes', { ascending: false })
      .limit(20);
    
    const config = getSchedulerConfig();
    
    return NextResponse.json({
      success: true,
      data: {
        systemStatus: stats?.[0] || null,
        schedulerConfig: config,
        recentActivity: {
          computationsLast24h: recentComputations?.length || 0,
          recentComputations: recentComputations || [],
        },
        triggerCandidates: {
          highPriority: triggerCandidates?.length || 0,
          candidates: triggerCandidates || [],
        },
        nextBatch: {
          estimatedTime: config.status.nextBatchEstimate,
          intervalMinutes: config.batch.intervalMinutes,
        },
      }
    });
    
  } catch (error) {
    throw new Error(`Failed to get scheduler status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getBatchCandidates() {
  try {
    // Get NFTs that would be processed in the next batch
    
    // New NFTs (no POA v2 score)
    const { data: newNFTs } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, elo_mean')
      .is('poa_v2', null)
      .not('elo_mean', 'is', null)
      .gte('total_votes', 1)
      .order('total_votes', { ascending: false })
      .limit(15);
    
    // Old NFTs (POA v2 score >24h old)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: oldNFTs } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, poa_v2, poa_v2_updated_at')
      .not('poa_v2', 'is', null)
      .lt('poa_v2_updated_at', twentyFourHoursAgo)
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      success: true,
      data: {
        newNFTs: newNFTs || [],
        oldNFTs: oldNFTs || [],
        summary: {
          newCount: newNFTs?.length || 0,
          oldCount: oldNFTs?.length || 0,
          totalCandidates: (newNFTs?.length || 0) + (oldNFTs?.length || 0),
        }
      }
    });
    
  } catch (error) {
    throw new Error(`Failed to get batch candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testTrigger(nftId: string, triggerType: 'new_vote' | 'milestone' | 'fire_vote' | 'super_vote') {
  try {
    if (!nftId) {
      throw new Error('NFT ID is required');
    }
    
    // Get NFT info
    const { data: nft } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes')
      .eq('id', nftId)
      .single();
    
    if (!nft) {
      throw new Error('NFT not found');
    }
    
    console.log(`🎯 Testing trigger for ${nft.name} (${nft.total_votes} votes)`);
    
    // Process the trigger
    const priority = triggerType === 'super_vote' || triggerType === 'fire_vote' ? 'high' : 'medium';
    const result = await processTrigger(nftId, triggerType, priority);
    
    return NextResponse.json({
      success: true,
      data: {
        nft: {
          id: nft.id,
          name: nft.name,
          collection: nft.collection_name,
          totalVotes: nft.total_votes,
        },
        trigger: {
          type: triggerType,
          priority,
        },
        result,
      }
    });
    
  } catch (error) {
    throw new Error(`Trigger test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function runBatchNow(customBatchSize?: number) {
  try {
    console.log('🕐 Running manual batch computation...');
    
    // Temporarily enable POA v2 for batch processing
    const originalEnv = process.env.POA_V2_ENABLED;
    process.env.POA_V2_ENABLED = 'true';
    process.env.POA_V2_COMPUTATION = 'true';
    
    try {
      const result = await runHourlyBatch();
      
      return NextResponse.json({
        success: result.success,
        data: {
          batchResult: result,
          customBatchSize,
          timestamp: new Date().toISOString(),
        }
      });
      
    } finally {
      // Restore environment
      if (originalEnv !== undefined) {
        process.env.POA_V2_ENABLED = originalEnv;
      } else {
        delete process.env.POA_V2_ENABLED;
      }
      delete process.env.POA_V2_COMPUTATION;
    }
    
  } catch (error) {
    throw new Error(`Batch execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testSimulateTrigger(nftId: string, triggerType: 'milestone' | 'super' | 'fire') {
  try {
    if (!nftId) {
      throw new Error('NFT ID is required');
    }
    
    // Temporarily enable POA v2
    const originalEnv = process.env.POA_V2_ENABLED;
    process.env.POA_V2_ENABLED = 'true';
    process.env.POA_V2_COMPUTATION = 'true';
    
    try {
      const result = await simulateTrigger(nftId, triggerType);
      
      return NextResponse.json({
        success: true,
        data: {
          nftId,
          triggerType,
          simulation: result,
        }
      });
      
    } finally {
      // Restore environment
      if (originalEnv !== undefined) {
        process.env.POA_V2_ENABLED = originalEnv;
      } else {
        delete process.env.POA_V2_ENABLED;
      }
      delete process.env.POA_V2_COMPUTATION;
    }
    
  } catch (error) {
    throw new Error(`Trigger simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function checkTriggerConditions(nftId: string) {
  try {
    if (!nftId) {
      throw new Error('NFT ID is required');
    }
    
    // Get NFT data
    const { data: nft } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, poa_v2')
      .eq('id', nftId)
      .single();
    
    if (!nft) {
      throw new Error('NFT not found');
    }
    
    // Check different trigger conditions
    const conditions = {
      regularVote: await shouldTriggerComputation(nftId, 'regular', nft.total_votes),
      superVote: await shouldTriggerComputation(nftId, 'super', nft.total_votes),
      fireVote: await shouldTriggerComputation(nftId, 'fire', nft.total_votes),
    };
    
    return NextResponse.json({
      success: true,
      data: {
        nft: {
          id: nft.id,
          name: nft.name,
          collection: nft.collection_name,
          totalVotes: nft.total_votes,
          hasPOAv2: nft.poa_v2 !== null,
        },
        triggerConditions: conditions,
        summary: {
          wouldTriggerOnRegular: conditions.regularVote.shouldCompute,
          wouldTriggerOnSuper: conditions.superVote.shouldCompute,
          wouldTriggerOnFire: conditions.fireVote.shouldCompute,
        }
      }
    });
    
  } catch (error) {
    throw new Error(`Trigger condition check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

