"use client"

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { checkGameEligibility, type GameEligibility } from '../../lib/token';

interface UseTokenBalanceReturn {
  eligibility: GameEligibility | null;
  loading: boolean;
  error: string | null;
  canPlayGame: boolean;
  refreshBalance: () => Promise<void>;
}

export const useTokenBalance = (): UseTokenBalanceReturn => {
  const [eligibility, setEligibility] = useState<GameEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();

  const fetchGameEligibility = async (walletAddress: string) => {
    try {
      console.log('🔄 Checking game eligibility with dynamic pricing...');
      setLoading(true);
      setError(null);
      
      // Check eligibility with dynamic pricing (no parameters needed)
      const eligibilityResult = await checkGameEligibility(walletAddress);
      
      setEligibility(eligibilityResult);
      console.log('✅ Game eligibility checked:', eligibilityResult.canPlay);
      console.log('📝 Reason:', eligibilityResult.eligibilityReason);
      console.log('💰 Current requirements:', eligibilityResult.minimumRequirements);
      
    } catch (err) {
      console.error('❌ Error checking game eligibility:', err);
      setError('Error checking game eligibility');
      setEligibility(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (address && isConnected) {
      await fetchGameEligibility(address);
    }
  };

  useEffect(() => {
    console.log('🔍 useTokenBalance useEffect triggered:');
    console.log('  - isConnected:', isConnected);
    console.log('  - address:', address);
    
    if (isConnected && address) {
      console.log('✅ Wallet connected, checking game eligibility with dynamic pricing...');
      fetchGameEligibility(address);
    } else {
      console.log('❌ Wallet not connected, clearing eligibility state');
      setEligibility(null);
      setLoading(false);
      setError(null);
    }
  }, [isConnected, address]);

  return {
    eligibility,
    loading,
    error,
    canPlayGame: eligibility?.canPlay || false,
    refreshBalance
  };
}; 