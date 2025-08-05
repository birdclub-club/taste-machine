// 🎁 Prize Break Hook with Queue Refill and Smart Contract Integration
// Manages prize breaks, smart contract reward claims, and background queue refilling

import { useState, useEffect } from 'react';
import { refillDuringPrizeBreak, RefillResult } from '@lib/queue-refill';
import { useSmartContractPrizeBreak, getRewardDescription, getRewardEmoji } from './useSmartContractPrizeBreak';
import { PrizeBreakReward } from '@/lib/constants';

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
}

export function usePrizeBreak() {
  const { claimPrizeBreak, checkPrizeBreakEligibility, isClaimingPrizeBreak } = useSmartContractPrizeBreak();
  
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
    isClaimingReward: false
  });

  // Start a prize break with smart contract integration
  const startPrizeBreak = async (voteCount: number) => {
    const startTime = Date.now();
    
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
      isClaimingReward: true // Start claiming immediately
    });

    console.log(`🎁 Prize break started after ${voteCount} votes - claiming rewards from smart contract...`);

    try {
      // Check if user is eligible for prize break
      const isEligible = await checkPrizeBreakEligibility();
      
      if (isEligible) {
        console.log('✅ User is eligible for prize break, claiming rewards...');
        
        // Claim the actual reward from smart contract
        const reward = await claimPrizeBreak();
        
        if (reward) {
          const description = getRewardDescription(reward);
          const emoji = getRewardEmoji(reward);
          
          console.log(`🎁 Prize break reward claimed:`, { reward, description, emoji });
          
          // Show the reward directly with smooth transition
          setPrizeBreakState(prev => ({
            ...prev,
            reward,
            rewardDescription: description,
            rewardEmoji: emoji,
            isClaimingReward: false
          }));

          // Animations will be triggered when user clicks "Claim Reward" button
          console.log(`🎁 Reward stored: ${reward.xpAmount} XP, ${reward.gugoAmount} GUGO, ${reward.licksAmount} Licks`);
        } else {
          console.warn('⚠️ No reward received from smart contract');
          setPrizeBreakState(prev => ({
            ...prev,
            isClaimingReward: false
          }));
        }
      } else {
        console.log('ℹ️ User not eligible for prize break on smart contract');
        setPrizeBreakState(prev => ({
          ...prev,
          isClaimingReward: false
        }));
      }
    } catch (error) {
      console.error('❌ Error claiming prize break reward:', error);
      setPrizeBreakState(prev => ({
        ...prev,
        isClaimingReward: false
      }));
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
      rewardEmoji: null
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
    getCurrentDuration,
    clearRewardState
  };
}