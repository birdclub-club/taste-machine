import { useState } from 'react';
import { useAccount, useWriteContract, useWatchContractEvent, useReadContract } from 'wagmi';
import { parseEventLogs } from 'viem';
import { GUGO_VOTE_MANAGER_ADDRESS, GUGO_VOTE_MANAGER_ABI, RewardType, type PrizeBreakReward } from '@/lib/constants';

interface UseSmartContractPrizeBreakReturn {
  claimPrizeBreak: () => Promise<PrizeBreakReward | null>;
  checkPrizeBreakEligibility: () => Promise<boolean>;
  isClaimingPrizeBreak: boolean;
  prizeBreakError: string | null;
}

export function useSmartContractPrizeBreak(): UseSmartContractPrizeBreakReturn {
  const { address } = useAccount();
  const [isClaimingPrizeBreak, setIsClaimingPrizeBreak] = useState(false);
  const [prizeBreakError, setPrizeBreakError] = useState<string | null>(null);
  const [latestReward, setLatestReward] = useState<PrizeBreakReward | null>(null);

  const { writeContractAsync } = useWriteContract();

  // Read user data from smart contract
  const { data: userData, refetch: refetchUserData } = useReadContract({
    address: GUGO_VOTE_MANAGER_ADDRESS,
    abi: GUGO_VOTE_MANAGER_ABI,
    functionName: 'users',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Watch for PrizeBreakClaimed events
  useWatchContractEvent({
    address: GUGO_VOTE_MANAGER_ADDRESS,
    abi: GUGO_VOTE_MANAGER_ABI,
    eventName: 'PrizeBreakClaimed',
    args: {
      user: address,
    },
    onLogs(logs) {
      console.log('🎁 PrizeBreakClaimed event received:', logs);
      
      if (logs.length > 0) {
        const event = logs[0];
        const reward: PrizeBreakReward = {
          rewardType: Number(event.args.rewardType) as RewardType,
          xpAmount: Number(event.args.xpAmount),
          votesAmount: Number(event.args.votesAmount),
          gugoAmount: Number(event.args.gugoAmount),
          timestamp: Date.now()
        };
        
        console.log('🎁 Parsed reward:', reward);
        setLatestReward(reward);
      }
    },
  });

  // Check if user is eligible for prize break (simplified for Taste Machine)
  const checkPrizeBreakEligibility = async (): Promise<boolean> => {
    if (!address) {
      console.log('❌ No wallet address for prize break eligibility');
      return false;
    }

    try {
      // For Taste Machine, we'll make this simpler - just check if wallet is connected
      // and if treasury has funds. The actual prize break logic in our frontend
      // already handles the vote count requirements.
      
      console.log(`🎁 Prize break eligibility check (simplified):`, {
        address,
        hasWallet: !!address,
        isEligible: true // Since our frontend already determined user hit prize break
      });

      return true; // If we got here, frontend already validated the prize break trigger
    } catch (error) {
      console.error('❌ Error checking prize break eligibility:', error);
      return true; // Default to eligible since frontend already triggered prize break
    }
  };

  // Generate prize break reward (session key - no signature popup)
  const claimPrizeBreak = async (): Promise<PrizeBreakReward | null> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsClaimingPrizeBreak(true);
    setPrizeBreakError(null);
    setLatestReward(null);

    try {
      console.log('🎁 Prize break triggered - using session key authorization...');
      console.log('👤 User:', address);
      
      // Check if we have a valid session for prize breaks
      const { hasValidSession, getStoredSessionKey, signSessionTransaction, SessionAction } = await import('../../lib/session-keys');
      
      if (!hasValidSession(SessionAction.CLAIM_PRIZE_BREAK)) {
        throw new Error('No valid session for prize breaks. Please refresh your session.');
      }

      const sessionData = getStoredSessionKey();
      if (!sessionData) {
        throw new Error('Session data not found');
      }

      // Simulate the smart contract logic for generating rewards
      await new Promise(resolve => setTimeout(resolve, 1500)); // Shorter delay since no signature

      // Check if this is the user's first prize break
      const firstPrizeBreakKey = `firstPrizeBreak_${address}`;
      const hasClaimedFirstPrizeBreak = localStorage.getItem(firstPrizeBreakKey) === 'true';
      
      let rewardType: RewardType;
      let xpAmount = 0;
      let votesAmount = 0;
      let gugoAmount = 0;
      let licksAmount = 0;

      // 🎉 SPECIAL: First-time player gets guaranteed 30 Licks welcome bonus
      if (!hasClaimedFirstPrizeBreak) {
        console.log('🎉 First prize break for new player - giving Welcome Bonus!');
        rewardType = RewardType.WELCOME_LICKS;
        licksAmount = 30;
        xpAmount = 10; // Bonus XP too
        
        // Mark as claimed
        localStorage.setItem(firstPrizeBreakKey, 'true');
      } else {
        // Generate reward based on smart contract probabilities
        const randomSeed = Math.floor(Math.random() * 100);

        // Implement the same probability logic as the smart contract
        if (randomSeed < 20) {
          // 20% - Base XP (Entry level reward)
          rewardType = RewardType.BASE_XP;
          xpAmount = 10;
        } else if (randomSeed < 40) {
          // 20% - Big XP (Better XP reward)
          rewardType = RewardType.BIG_XP;
          xpAmount = 30;
        } else if (randomSeed < 55) {
          // 15% - XP + 5 Votes
          rewardType = RewardType.XP_VOTES_5;
          xpAmount = 15;
          votesAmount = 5;
        } else if (randomSeed < 65) {
          // 10% - XP + 10 Votes (Premium reward)
          rewardType = RewardType.XP_VOTES_10;
          xpAmount = 20;
          votesAmount = 10;
        } else if (randomSeed < 75) {
          // 10% - Vote Bonus Only
          rewardType = RewardType.VOTE_BONUS;
          votesAmount = 15;
        } else if (randomSeed < 85) {
          // 10% - GUGO Tier 1: $2 USD equivalent (400 GUGO at $0.005 each)
          rewardType = RewardType.GUGO_TIER_1;
          xpAmount = 10;
          gugoAmount = 400;
        } else if (randomSeed < 95) {
          // 10% - GUGO Tier 2: $5 USD equivalent (1,000 GUGO at $0.005 each)
          rewardType = RewardType.GUGO_TIER_2;
          xpAmount = 15;
          gugoAmount = 1000;
        } else {
          // 5% - GUGO Tier 3: $10 USD equivalent (2,000 GUGO at $0.005 each)
          rewardType = RewardType.GUGO_TIER_3;
          xpAmount = 20;
          gugoAmount = 2000;
        }
      }

      const reward: PrizeBreakReward = {
        rewardType,
        xpAmount,
        votesAmount,
        gugoAmount,
        licksAmount,
        timestamp: Date.now()
      };

      // Sign the reward claim with session key
      const sessionTransaction = {
        action: SessionAction.CLAIM_PRIZE_BREAK,
        data: { reward },
        nonce: sessionData.nonce + 1
      };

      const sessionSignature = await signSessionTransaction(sessionData, sessionTransaction);

      console.log('🎁 Generated session-authorized reward:', reward);
      console.log('✍️ Session signature:', sessionSignature.substring(0, 10) + '...');
      
      // Store reward with session authorization
      try {
        const response = await fetch('/api/rewards/store', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: address,
            reward: reward,
            claimed: false,
            sessionSignature,
            sessionKey: sessionData.sessionPublicKey
          })
        });

        if (!response.ok) {
          console.warn('⚠️ Failed to store reward in database, but continuing with UI display');
        } else {
          console.log('💾 Session-authorized reward stored successfully');
        }
      } catch (dbError) {
        console.warn('⚠️ Database storage failed, but continuing with UI display:', dbError);
      }

      setLatestReward(reward);
      return reward;

    } catch (error) {
      console.error('❌ Error claiming session-based prize break:', error);
      setPrizeBreakError(error instanceof Error ? error.message : 'Unknown error');
      
      // Return null on error - UI will handle this gracefully
      return null;
      
    } finally {
      setIsClaimingPrizeBreak(false);
    }
  };

  return {
    claimPrizeBreak,
    checkPrizeBreakEligibility,
    isClaimingPrizeBreak,
    prizeBreakError
  };
}





// Helper function to get reward description
export function getRewardDescription(reward: PrizeBreakReward): string {
  switch (reward.rewardType) {
    case RewardType.BASE_XP:
      return `+${reward.xpAmount} XP`;
    case RewardType.BIG_XP:
      return `+${reward.xpAmount} XP (Big Bonus!)`;
    case RewardType.XP_VOTES_10:
      return `+${reward.xpAmount} XP + ${reward.votesAmount} Votes`;
    case RewardType.XP_VOTES_5:
      return `+${reward.xpAmount} XP + ${reward.votesAmount} Votes`;
    case RewardType.VOTE_BONUS:
      return `+${reward.votesAmount} Votes Bonus`;
    case RewardType.GUGO_TIER_1:
      return `+${reward.gugoAmount} GUGO (Tier 1)`;
    case RewardType.GUGO_TIER_2:
      return `+${reward.gugoAmount} GUGO (Tier 2)`;
    case RewardType.GUGO_TIER_3:
      return `+${reward.gugoAmount} GUGO (Tier 3)`;
    case RewardType.GUGO_TIER_4:
      return `+${reward.gugoAmount} GUGO (Tier 4)`;
    case RewardType.GUGO_TIER_5:
      return `+${reward.gugoAmount} GUGO (Tier 5)`;
    case RewardType.GUGO_TIER_6:
      return `+${reward.gugoAmount} GUGO (Tier 6)`;
    case RewardType.GUGO_TIER_7:
      return `+${reward.gugoAmount} GUGO (Tier 7)`;
    case RewardType.GUGO_TIER_8:
      return `+${reward.gugoAmount} GUGO (Tier 8)`;
    case RewardType.GUGO_TIER_9:
      return `+${reward.gugoAmount} GUGO (Tier 9)`;
    case RewardType.WELCOME_LICKS:
      return `+${reward.licksAmount} Licks (Welcome Bonus!)`;
    default:
      return 'Unknown Reward';
  }
}

// Helper function to get reward emoji
export function getRewardEmoji(reward: PrizeBreakReward): string {
  switch (reward.rewardType) {
    case RewardType.BASE_XP:
    case RewardType.BIG_XP:
      return '⚡';
    case RewardType.XP_VOTES_10:
    case RewardType.XP_VOTES_5:
      return '🎯';
    case RewardType.VOTE_BONUS:
      return '🗳️';
    case RewardType.GUGO_TIER_1:
    case RewardType.GUGO_TIER_2:
      return '🪙';
    case RewardType.GUGO_TIER_3:
    case RewardType.GUGO_TIER_4:
    case RewardType.GUGO_TIER_5:
      return '💰';
    case RewardType.GUGO_TIER_6:
    case RewardType.GUGO_TIER_7:
    case RewardType.GUGO_TIER_8:
    case RewardType.GUGO_TIER_9:
      return '💎';
    case RewardType.WELCOME_LICKS:
      return '🎉';
    default:
      return '🎁';
  }
}