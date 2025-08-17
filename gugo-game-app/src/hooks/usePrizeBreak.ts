// 🎁 Prize Break Hook with Queue Refill and Smart Contract Integration
// Manages prize breaks, smart contract reward claims, and background queue refilling

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { refillDuringPrizeBreak, RefillResult } from '@lib/queue-refill';
import { useSmartContractPrizeBreak, getRewardDescription, getRewardEmoji } from './useSmartContractPrizeBreak';
import { PrizeBreakReward, RewardType } from '@/lib/constants';

export interface PrizeBreakState {
  isActive: boolean;
  startTime: number | null;
  duration: number;
  voteCount: number;
  refillResult: RefillResult | null;
  refillInProgress: boolean;
  reward: PrizeBreakReward | null; // Add actual reward data
  rewardDescription: string | null; // Human-readable reward description
  rewardEmoji: string | null; // Emoji for the reward
  isClaimingReward: boolean; // Whether we're currently claiming from smart contract
  selectedDuckImage: any; // Store the selected duck image for this prize break
}

// 🦆 Get appropriate duck image based on reward type
const getDuckImageForReward = (reward: any) => {
  console.log('🦆 getDuckImageForReward called with reward:', reward);
  
  if (!reward) {
    console.log('🦆 No reward provided, returning null');
    return null;
  }
  
  // GUGO prizes get random GUGO duck
  if (reward.gugoAmount > 0) {
    const gugoDucks = [
      "/GUGO-Duck-with-bag.png",
      "/GUGO-Duck-Burning-Bags.png"
    ];
    const randomDuck = gugoDucks[Math.floor(Math.random() * gugoDucks.length)];
    console.log('🔥 GUGO reward detected, returning random GUGO duck:', randomDuck);
    return {
      src: randomDuck,
      alt: "GUGO Duck",
      filter: 'drop-shadow(0 0 20px rgba(255, 107, 53, 0.6)) drop-shadow(0 0 40px rgba(255, 140, 0, 0.4)) drop-shadow(0 0 60px rgba(255, 165, 0, 0.2))',
      animation: 'fire-pulse-subtle 3s ease-in-out infinite'
    };
  }
  
  // Non-GUGO prizes get random art duck
  const artDucks = [
    "/GUGO-Duck-Holding-NFTs.png",
    "/GOGO-duck-at-easel-01.png",
    "/GUGO-Duck-Stealing-Art.png"
  ];
  const randomDuck = artDucks[Math.floor(Math.random() * artDucks.length)];
  console.log('🎨 Non-GUGO reward detected, returning random art duck:', randomDuck);
  return {
    src: randomDuck,
    alt: "Art Duck",
    filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.4))',
    animation: 'gentle-pulse 2s ease-in-out infinite'
  };
};

// Generate a reward locally (same logic as smart contract)
const generatePrizeBreakReward = (address: string): PrizeBreakReward => {
  // Check if this is the user's first prize break
  const firstPrizeBreakKey = `firstPrizeBreak_${address}`;
  const hasClaimedFirstPrizeBreak = localStorage.getItem(firstPrizeBreakKey) === 'true';
  
  let rewardType: RewardType;
  let xpAmount = 0;
  let votesAmount = 0;
  let gugoAmount = 0;
  let licksAmount = 0;

  if (!hasClaimedFirstPrizeBreak) {
    // First-time user gets welcome licks
    rewardType = RewardType.WELCOME_LICKS;
    licksAmount = 50;
    console.log('🎁 First prize break - awarding welcome licks!');
  } else {
    // Generate random reward based on same logic as smart contract
    const randomSeed = Math.floor(Math.random() * 100);
    console.log('🎲 Prize roll:', randomSeed);

    if (randomSeed < 10) {
      // 10% - Base XP (+10 XP)
      rewardType = RewardType.BASE_XP;
      xpAmount = 10;
    } else if (randomSeed < 20) {
      // 10% - Big XP (+20 XP)
      rewardType = RewardType.BIG_XP;
      xpAmount = 20;
    } else if (randomSeed < 30) {
      // 10% - XP + Votes (+10 XP + 10 Votes)
      rewardType = RewardType.XP_VOTES_10;
      xpAmount = 10;
      votesAmount = 10;
    } else if (randomSeed < 40) {
      // 10% - XP + More Votes (+5 XP + 20 Votes)
      rewardType = RewardType.XP_VOTES_5;
      xpAmount = 5;
      votesAmount = 20;
    } else if (randomSeed < 45) {
      // 5% - Votes Only (+30 Votes)
      rewardType = RewardType.VOTE_BONUS;
      votesAmount = 30;
    } else if (randomSeed < 70) {
      // 25% - GUGO Tier 1 (600 GUGO)
      rewardType = RewardType.GUGO_TIER_1;
      gugoAmount = 600;
    } else if (randomSeed < 85) {
      // 15% - GUGO Tier 2 (1500 GUGO)
      rewardType = RewardType.GUGO_TIER_2;
      gugoAmount = 1500;
    } else if (randomSeed < 93) {
      // 8% - GUGO Tier 3 (3000 GUGO)
      rewardType = RewardType.GUGO_TIER_3;
      gugoAmount = 3000;
    } else if (randomSeed < 97) {
      // 4% - GUGO Tier 4 (5000 GUGO)
      rewardType = RewardType.GUGO_TIER_4;
      gugoAmount = 5000;
    } else if (randomSeed < 99) {
      // 2% - GUGO Tier 5 (10000 GUGO)
      rewardType = RewardType.GUGO_TIER_5;
      gugoAmount = 10000;
    } else {
      // 1% - GUGO Tier 6 (25000 GUGO)
      rewardType = RewardType.GUGO_TIER_6;
      gugoAmount = 25000;
    }
  }

  return {
    rewardType,
    xpAmount,
    votesAmount,
    gugoAmount,
    licksAmount,
    timestamp: Date.now()
  };
};

export function usePrizeBreak() {
  const { claimPrizeBreak, checkPrizeBreakEligibility, isClaimingPrizeBreak } = useSmartContractPrizeBreak();
  const { address } = useAccount();
  
  const [prizeBreakState, setPrizeBreakState] = useState<PrizeBreakState>({
    isActive: false,
    startTime: null,
    duration: 0,
    voteCount: 0,
    refillResult: null,
    refillInProgress: false,
    reward: null,
    rewardDescription: null,
    rewardEmoji: null,
    isClaimingReward: false,
    selectedDuckImage: null
  });

  // Start a prize break with smart contract integration
  const startPrizeBreak = async (voteCount: number) => {
    const startTime = Date.now();
    
    // Check if we have a valid session first
    const { hasValidSession, SessionAction } = await import('../../lib/session-keys');
    const hasSession = hasValidSession(SessionAction.CLAIM_PRIZE_BREAK);
    
    setPrizeBreakState({
      isActive: true,
      startTime,
      duration: 0,
      voteCount,
      refillResult: null,
      refillInProgress: false,
      reward: null,
      rewardDescription: null,
      rewardEmoji: null,
      isClaimingReward: hasSession // Only start claiming if we have a session
    });

    console.log(`🎁 Prize break started after ${voteCount} votes${hasSession ? ' - claiming rewards from smart contract...' : ' - waiting for session to claim rewards...'}`);

    // 🚀 PERFORMANCE BOOST: Trigger aggressive preloading during prize break
    console.log('🚀 Prize break: Triggering aggressive image preloading...');
    try {
      // Import preloader dynamically to avoid circular dependencies
      const { votingPreloader } = await import('@lib/preloader');
      
      // Force preloader to refill stack during prize break downtime
      setTimeout(() => {
        console.log('⚡ Prize break: Starting background preload...');
        votingPreloader.forceRefillStack();
      }, 100); // Start immediately but don't block prize animation
    } catch (error) {
      console.warn('⚠️ Prize break preloading failed:', error);
    }

    // Safety timeout to prevent getting stuck in "It's Happening" state
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Prize break claiming timeout - forcing exit from "It\'s Happening" state');
      setPrizeBreakState(prev => ({
        ...prev,
        isClaimingReward: false,
        reward: {
          rewardType: 0,
          xpAmount: 10,
          votesAmount: 0,
          gugoAmount: 0,
          licksAmount: 0,
          timestamp: Date.now()
        },
        rewardDescription: 'Basic Reward',
        rewardEmoji: '⭐'
      }));
    }, 10000); // 10 second timeout

    try {
      // Only proceed with claiming if we have a session
      if (hasSession) {
        // Check if user is eligible for prize break
        const isEligible = await checkPrizeBreakEligibility();
        
        if (isEligible) {
          console.log('✅ User is eligible for prize break, claiming rewards...');
          
          // Claim the actual reward from smart contract
          const reward = await claimPrizeBreak();
        
        if (reward) {
          clearTimeout(timeoutId); // Clear timeout on success
          const description = getRewardDescription(reward);
          const emoji = getRewardEmoji(reward);
          
          console.log(`🎁 Prize break reward claimed:`, { reward, description, emoji });
          
          // Show the reward directly with smooth transition
          const duckImage = getDuckImageForReward(reward);
          setPrizeBreakState(prev => ({
            ...prev,
            reward,
            rewardDescription: description,
            rewardEmoji: emoji,
            isClaimingReward: false,
            selectedDuckImage: duckImage
          }));

          // Animations will be triggered when user clicks "Claim Reward" button
          console.log(`🎁 Reward stored: ${reward.xpAmount} XP, ${reward.gugoAmount} GUGO, ${reward.licksAmount} Licks`);
        } else {
          clearTimeout(timeoutId); // Clear timeout on no reward
          console.warn('⚠️ No reward received from smart contract');
          setPrizeBreakState(prev => ({
            ...prev,
            isClaimingReward: false
          }));
        }
        } else {
          clearTimeout(timeoutId); // Clear timeout on ineligible
          console.log('ℹ️ User not eligible for prize break on smart contract');
          setPrizeBreakState(prev => ({
            ...prev,
            isClaimingReward: false
          }));
        }
      } else {
        // No session - generate real reward but don't claim yet
        clearTimeout(timeoutId);
        console.log('⚠️ No session available - generating reward for display but not claiming');
        
        if (!address) {
          console.error('❌ No wallet address available for reward generation');
          return;
        }
        
        // Generate the actual reward that will be claimed when session is created
        const reward = generatePrizeBreakReward(address);
        const description = getRewardDescription(reward);
        const emoji = getRewardEmoji(reward);
        
        console.log(`🎁 Generated reward for display:`, { reward, description, emoji });
        
        const duckImage = getDuckImageForReward(reward);
        setPrizeBreakState(prev => ({
          ...prev,
          isClaimingReward: false,
          reward,
          rewardDescription: description,
          rewardEmoji: emoji,
          selectedDuckImage: duckImage
        }));
      }
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error
      console.error('❌ Error claiming prize break reward:', error);
      setPrizeBreakState(prev => ({
        ...prev,
        isClaimingReward: false
      }));
    }
  };

  // Manually claim prize break (called when user clicks button)
  const claimCurrentPrizeBreak = async () => {
    if (!prizeBreakState.isActive || !prizeBreakState.reward || !address) return;
    
    console.log('🎁 Manual prize claiming - using existing reward without calling smart contract again');
    
    try {
      console.log('🎁 Manually claiming prize break with existing reward...');
      
      // Use the existing reward that was generated when the prize break started
      const existingReward = prizeBreakState.reward;
      
      // Mark first prize break as claimed if this is the first one
      if (existingReward.rewardType === RewardType.WELCOME_LICKS) {
        const firstPrizeBreakKey = `firstPrizeBreak_${address}`;
        localStorage.setItem(firstPrizeBreakKey, 'true');
        console.log('🎁 First prize break claimed - marked in localStorage');
      }
      
      // Don't call claimPrizeBreak() again - we already have the reward from the initial claim
      // The smart contract was already called during startPrizeBreak()
      console.log(`🎁 Using existing reward from initial claim:`, existingReward);
      
      return existingReward;
    } catch (error) {
      console.error('❌ Error claiming prize break reward:', error);
      throw error;
    }
  };

  // End prize break and trigger queue refill
  const endPrizeBreak = async () => {
    if (!prizeBreakState.isActive || !prizeBreakState.startTime) {
      return;
    }

    const breakDuration = Date.now() - prizeBreakState.startTime;
    
    setPrizeBreakState(prev => ({
      ...prev,
      duration: breakDuration,
      refillInProgress: true
    }));

    console.log(`🔄 Prize break ending, starting queue refill (break lasted ${breakDuration}ms)`);

    try {
      // Refill queue based on break duration and user engagement
      const refillResult = await refillDuringPrizeBreak(
        prizeBreakState.voteCount,
        prizeBreakState.startTime
      );

      console.log(`✅ Queue refill complete: +${refillResult.added.total} matchups`);

      setPrizeBreakState(prev => ({
        ...prev,
        isActive: false,
        refillResult,
        refillInProgress: false,
        // Keep reward data so it can be displayed until user dismisses
      }));

      return refillResult;
    } catch (error) {
      console.error('❌ Queue refill failed during prize break:', error);
      
      setPrizeBreakState(prev => ({
        ...prev,
        isActive: false,
        refillInProgress: false
      }));
    }
  };

  // Auto-refill for long breaks
  useEffect(() => {
    if (!prizeBreakState.isActive || !prizeBreakState.startTime) {
      return;
    }

    // If user spends more than 30 seconds on prize break, start refilling
    const longBreakTimer = setTimeout(() => {
      if (prizeBreakState.isActive && !prizeBreakState.refillInProgress) {
        console.log('🔄 Long prize break detected, starting background refill');
        
        setPrizeBreakState(prev => ({
          ...prev,
          refillInProgress: true
        }));

        refillDuringPrizeBreak(prizeBreakState.voteCount, prizeBreakState.startTime!)
          .then(result => {
            console.log(`✅ Background refill complete: +${result.added.total} matchups`);
            setPrizeBreakState(prev => ({
              ...prev,
              refillResult: result,
              refillInProgress: false
            }));
          })
          .catch(error => {
            console.error('❌ Background refill failed:', error);
            setPrizeBreakState(prev => ({
              ...prev,
              refillInProgress: false
            }));
          });
      }
    }, 30000); // 30 seconds

    return () => clearTimeout(longBreakTimer);
  }, [prizeBreakState.isActive, prizeBreakState.startTime, prizeBreakState.refillInProgress]);

  // Calculate current break duration
  const getCurrentDuration = () => {
    if (!prizeBreakState.startTime) return 0;
    return Date.now() - prizeBreakState.startTime;
  };

  // Clear reward state (when user dismisses prize break)
  const clearRewardState = () => {
    setPrizeBreakState(prev => ({
      ...prev,
      reward: null,
      rewardDescription: null,
      rewardEmoji: null,
      selectedDuckImage: null
    }));
  };

  // Immediately close prize break modal (for instant UI feedback)
  const closePrizeBreakModal = () => {
    setPrizeBreakState(prev => ({
      ...prev,
      isActive: false,
      reward: null,
      rewardDescription: null,
      rewardEmoji: null,
      selectedDuckImage: null
    }));
  };

  return {
    prizeBreakState: {
      ...prizeBreakState,
      duration: prizeBreakState.isActive ? getCurrentDuration() : prizeBreakState.duration,
      isClaimingReward: isClaimingPrizeBreak || prizeBreakState.isClaimingReward
    },
    startPrizeBreak,
    endPrizeBreak,
    claimCurrentPrizeBreak,
    getCurrentDuration,
    clearRewardState,
    closePrizeBreakModal
  };
}