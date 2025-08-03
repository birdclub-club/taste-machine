// 🎁 Prize Break Hook with Queue Refill
// Manages prize breaks and background queue refilling

import { useState, useEffect } from 'react';
import { refillDuringPrizeBreak, RefillResult } from '@lib/queue-refill';

export interface PrizeBreakState {
  isActive: boolean;
  startTime: number | null;
  duration: number;
  voteCount: number;
  refillResult: RefillResult | null;
  refillInProgress: boolean;
}

export function usePrizeBreak() {
  const [prizeBreakState, setPrizeBreakState] = useState<PrizeBreakState>({
    isActive: false,
    startTime: null,
    duration: 0,
    voteCount: 0,
    refillResult: null,
    refillInProgress: false
  });

  // Start a prize break
  const startPrizeBreak = async (voteCount: number) => {
    const startTime = Date.now();
    
    setPrizeBreakState({
      isActive: true,
      startTime,
      duration: 0,
      voteCount,
      refillResult: null,
      refillInProgress: false
    });

    console.log(`🎁 Prize break started after ${voteCount} votes`);
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
        refillInProgress: false
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

  return {
    prizeBreakState: {
      ...prizeBreakState,
      duration: prizeBreakState.isActive ? getCurrentDuration() : prizeBreakState.duration
    },
    startPrizeBreak,
    endPrizeBreak,
    getCurrentDuration
  };
}