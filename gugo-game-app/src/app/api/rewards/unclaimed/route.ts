/**
 * API endpoint for fetching unclaimed rewards for a wallet
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress parameter is required' },
        { status: 400 }
      );
    }

    console.log('📋 Fetching unclaimed rewards for:', walletAddress);

    // In a real implementation, this would query a database
    // For now, we'll return some mock unclaimed rewards for demo purposes
    const mockUnclaimedRewards = [
      {
        id: 'reward_1',
        walletAddress,
        reward: {
          rewardType: 1, // BIG_XP
          xpAmount: 30,
          votesAmount: 0,
          gugoAmount: 0,
          timestamp: Date.now() - 3600000 // 1 hour ago
        },
        claimed: false,
        sessionAuthorized: true,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'reward_2',
        walletAddress,
        reward: {
          rewardType: 6, // GUGO_TIER_2
          xpAmount: 15,
          votesAmount: 0,
          gugoAmount: 25,
          timestamp: Date.now() - 1800000 // 30 minutes ago
        },
        claimed: false,
        sessionAuthorized: true,
        createdAt: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: 'reward_3',
        walletAddress,
        reward: {
          rewardType: 3, // XP_VOTES_5
          xpAmount: 15,
          votesAmount: 5,
          gugoAmount: 0,
          timestamp: Date.now() - 900000 // 15 minutes ago
        },
        claimed: false,
        sessionAuthorized: true,
        createdAt: new Date(Date.now() - 900000).toISOString()
      }
    ];

    // Filter to only unclaimed rewards
    const unclaimedRewards = mockUnclaimedRewards.filter(r => !r.claimed);

    console.log('✅ Found unclaimed rewards:', {
      walletAddress,
      count: unclaimedRewards.length,
      totalXP: unclaimedRewards.reduce((sum, r) => sum + r.reward.xpAmount, 0),
      totalVotes: unclaimedRewards.reduce((sum, r) => sum + r.reward.votesAmount, 0),
      totalGUGO: unclaimedRewards.reduce((sum, r) => sum + r.reward.gugoAmount, 0)
    });

    return NextResponse.json(unclaimedRewards, { status: 200 });

  } catch (error) {
    console.error('❌ Error fetching unclaimed rewards:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function POST() {
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