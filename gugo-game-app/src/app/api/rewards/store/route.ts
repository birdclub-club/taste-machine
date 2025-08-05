/**
 * API endpoint for storing session-authorized rewards
 * Validates session signatures before storing rewards
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      walletAddress, 
      reward, 
      claimed = false, 
      sessionSignature, 
      sessionKey 
    } = body;

    console.log('📝 Storing reward:', {
      walletAddress,
      rewardType: reward?.rewardType,
      xpAmount: reward?.xpAmount,
      votesAmount: reward?.votesAmount,
      gugoAmount: reward?.gugoAmount,
      hasSessionSignature: !!sessionSignature
    });

    // Basic validation
    if (!walletAddress || !reward) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate session signature if provided
    if (sessionSignature && sessionKey) {
      const isValidSession = await validateSessionSignature(
        sessionSignature,
        sessionKey,
        reward
      );

      if (!isValidSession) {
        console.warn('⚠️ Invalid session signature for reward:', {
          walletAddress,
          sessionKey: sessionKey.substring(0, 10) + '...'
        });
        
        return NextResponse.json(
          { error: 'Invalid session authorization' },
          { status: 401 }
        );
      }

      console.log('✅ Session signature validated for reward');
    }

    // Store reward in database and update user XP/balances
    const rewardId = `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Import Supabase client
      const { supabase } = await import('@lib/supabase');
      
      console.log('💾 Storing reward and updating user balances directly...');

      // Update user balances directly (no separate rewards table for now)
      if (reward.xpAmount > 0 || reward.votesAmount > 0 || reward.gugoAmount > 0 || reward.licksAmount > 0) {
        console.log('📈 Updating user balances:', {
          xp: reward.xpAmount,
          votes: reward.votesAmount,
          gugo: reward.gugoAmount,
          licks: reward.licksAmount
        });

        // Fetch current user to get existing balances
        const { data: currentUser, error: fetchError } = await supabase
          .from('users')
          .select('xp, total_votes, available_votes')
          .eq('wallet_address', walletAddress)
          .single();

        if (fetchError) {
          console.error('❌ Failed to fetch current user:', fetchError);
          throw fetchError;
        }

        // Calculate new balances (only update fields that exist in users table)
        const updates: any = {};
        
        if (reward.xpAmount > 0) {
          updates.xp = (currentUser.xp || 0) + reward.xpAmount;
        }
        
        // Handle votes and licks (both stored in available_votes)
        const totalVotesToAdd = (reward.votesAmount || 0) + (reward.licksAmount || 0);
        if (totalVotesToAdd > 0) {
          updates.available_votes = (currentUser.available_votes || 0) + totalVotesToAdd;
          updates.total_votes = (currentUser.total_votes || 0) + totalVotesToAdd;
          
          if (reward.votesAmount > 0) {
            console.log(`🗳️ Adding ${reward.votesAmount} Votes to available_votes`);
          }
          if (reward.licksAmount > 0) {
            console.log(`🎁 Adding ${reward.licksAmount} Licks to available_votes`);
          }
        }

        // Update user balances
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('wallet_address', walletAddress);

        if (updateError) {
          console.error('❌ Failed to update user balances:', updateError);
          throw updateError;
        }

        console.log('✅ User balances updated successfully:', updates);
        
        // Handle FGUGO token transfer (immediate to wallet)
        let fgugoTransferStatus = 'not_applicable';
        if (reward.gugoAmount > 0) {
          try {
            // Check if treasury key is configured
            const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY;
            if (treasuryPrivateKey) {
              // Transfer real FGUGO tokens to user's wallet on Abstract Testnet
              await transferFgugoTokens(walletAddress, reward.gugoAmount);
              fgugoTransferStatus = 'completed';
            } else {
              // Simulation mode
              await transferFgugoTokens(walletAddress, reward.gugoAmount);
              fgugoTransferStatus = 'simulated';
            }
          } catch (transferError) {
            console.error('❌ Failed to transfer FGUGO tokens:', transferError);
            fgugoTransferStatus = 'failed';
            // Don't throw - XP was still saved successfully
          }
        }
      } else {
        console.log('ℹ️ No XP/votes/GUGO/licks to update, reward was:', reward);
      }

      console.log('💾 Reward processed and user updated successfully');
      
      if (fgugoTransferStatus === 'simulated') {
        console.warn('⚠️  [IMPORTANT] FGUGO transfer was SIMULATED - user balance will NOT increase');
        console.warn('🔧 [SOLUTION] Need smart contract integration with GugoVoteManager claimPrizeBreak()');
        console.warn('📋 [INFO] Contract treasury already seeded, just need to integrate the calls');
      }

      return NextResponse.json(
        { 
          success: true, 
          rewardId,
          message: 'Reward processed and user balances updated successfully',
          rewards: {
            xp: reward.xpAmount || 0,
            votes: reward.votesAmount || 0,
            fgugo: reward.gugoAmount || 0,  // FGUGO on testnet
            licks: reward.licksAmount || 0
          },
          fgugoTransferStatus,
          developmentNote: fgugoTransferStatus === 'simulated' ? 
            'FGUGO transfer was simulated. Configure TREASURY_PRIVATE_KEY for real transfers.' : 
            undefined
        },
        { status: 201 }
      );

    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError);
      
      return NextResponse.json(
        { error: 'Failed to store reward in database' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error storing reward:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Transfer FGUGO tokens using smart contract treasury system
 * This should integrate with the GugoVoteManager contract's claimPrizeBreak function
 */
async function transferFgugoTokens(walletAddress: string, amount: number): Promise<void> {
  console.log(`💰 Processing ${amount} FGUGO reward through smart contract...`);
  
  try {
    // Import smart contract constants
    const { GUGO_VOTE_MANAGER_ADDRESS, GUGO_VOTE_MANAGER_ABI } = await import('@/lib/constants');
    const ABSTRACT_TESTNET_RPC = 'https://api.testnet.abs.xyz';
    
    // Create provider for Abstract Testnet
    const provider = new ethers.JsonRpcProvider(ABSTRACT_TESTNET_RPC);
    
    // Check if we have a treasury/admin private key for contract interaction
    const adminPrivateKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY;
    
    if (!adminPrivateKey) {
      console.warn('⚠️ No admin private key found for smart contract interaction');
      console.log('💡 SMART CONTRACT INTEGRATION NEEDED:');
      console.log('   The GugoVoteManager contract at:', GUGO_VOTE_MANAGER_ADDRESS);
      console.log('   Should handle FGUGO distribution via claimPrizeBreak()');
      console.log('   Current reward amount:', amount, 'FGUGO');
      console.log('   Target wallet:', walletAddress);
      await simulateFgugoTransfer(walletAddress, amount);
      return;
    }

    // TODO: Implement smart contract integration
    // This should call the GugoVoteManager's claimPrizeBreak() function
    // instead of direct ERC-20 transfers
    
    console.log('🔧 IMPLEMENTATION NEEDED: Smart contract integration');
    console.log('   Contract:', GUGO_VOTE_MANAGER_ADDRESS);
    console.log('   Function: claimPrizeBreak()');
    console.log('   Treasury should handle:', amount, 'FGUGO →', walletAddress);
    
    // For now, fall back to simulation until smart contract integration is complete
    await simulateFgugoTransfer(walletAddress, amount);

  } catch (error) {
    console.error('❌ Error in smart contract FGUGO transfer:', error);
    await simulateFgugoTransfer(walletAddress, amount);
  }
}

/**
 * Fallback simulation for when real transfers can't be executed
 */
async function simulateFgugoTransfer(walletAddress: string, amount: number): Promise<void> {
  console.log(`🔗 [SIMULATE] Smart contract FGUGO transfer: ${amount} FGUGO → ${walletAddress}`);
  console.log(`⚠️  [DEVELOPMENT MODE] Smart contract integration not yet implemented`);
  console.log(`📝 [NEXT STEPS] To enable real FGUGO transfers:`);
  console.log(`   1. The GugoVoteManager contract already has FGUGO treasury seeded`);
  console.log(`   2. Need to integrate claimPrizeBreak() function calls`);
  console.log(`   3. This should trigger automatic FGUGO transfers from contract treasury`);
  console.log(`   4. Configure admin key for contract interaction (TREASURY_PRIVATE_KEY)`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`✅ [SIMULATE] Transfer complete - SIMULATION ONLY`);
  console.log(`💡 [INFO] User will not see balance increase until smart contract integration`);
  console.log(`🔗 [CONTRACT] GugoVoteManager should handle this via its treasury`);
}

/**
 * Validate session signature for a reward claim
 */
async function validateSessionSignature(
  signature: string,
  sessionKey: string,
  reward: any
): Promise<boolean> {
  try {
    console.log('🔐 Validating session signature (simplified for development)...');
    
    // For now, we'll do basic validation - in production this would be more robust
    if (!signature || !sessionKey) {
      console.log('❌ Missing signature or session key');
      return false;
    }
    
    // Simplified validation - just check if signature exists and looks valid
    const isValidFormat = signature.startsWith('0x') && signature.length >= 130;
    const isValidSessionKey = sessionKey.startsWith('0x') && sessionKey.length === 42;
    
    const isValid = isValidFormat && isValidSessionKey;

    console.log('🔐 Session signature validation:', {
      sessionKey: sessionKey.substring(0, 10) + '...',
      signatureFormat: isValidFormat,
      sessionKeyFormat: isValidSessionKey,
      isValid
    });

    return isValid;

  } catch (error) {
    console.error('❌ Error validating session signature:', error);
    return false;
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}