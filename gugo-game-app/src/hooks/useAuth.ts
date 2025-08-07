"use client"

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getOrCreateUser, type User } from '../../lib/auth';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { address, isConnected, connector } = useAccount();

  const fetchUser = async (walletAddress: string) => {
    try {
      console.log('🔄 fetchUser called with address:', walletAddress);
      setLoading(true);
      setError(null);
      
      const userData = await getOrCreateUser(walletAddress, 'agw');
      
      if (userData) {
        setUser(userData);
        console.log('✅ User authenticated successfully:', userData.wallet_address);
      } else {
        console.error('❌ getOrCreateUser returned null');
        setError('Failed to create or fetch user');
      }
    } catch (err: any) {
      console.error('❌ Error in fetchUser:', err);
      
      // Check if it's a user cancellation (don't show error for normal user actions)
      if (
        err?.code === 4001 || // User rejected request
        err?.message?.toLowerCase().includes('user rejected') ||
        err?.message?.toLowerCase().includes('user denied') ||
        err?.message?.toLowerCase().includes('user cancelled')
      ) {
        console.log('👋 User cancelled wallet operation - clearing auth state');
        setUser(null);
        setError(null); // Don't show error for user cancellations
      } else {
        setError('Authentication error');
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (address) {
      await fetchUser(address);
    }
  };

  useEffect(() => {
    console.log('🔍 useAuth useEffect triggered:');
    console.log('  - isConnected:', isConnected);
    console.log('  - address:', address);
    console.log('  - connector:', connector?.name);
    
    // If we have an address AND a connector, treat as connected
    // This handles timing issues where isConnected might be false initially
    if (address && connector) {
      console.log('✅ Wallet connected (address + connector), fetching user...');
      fetchUser(address);
    } else if (isConnected && address) {
      console.log('✅ Wallet connected (isConnected + address), fetching user...');
      fetchUser(address);
    } else {
      console.log('❌ Wallet not connected, clearing user state');
      setUser(null);
      setLoading(false);
      setError(null);
    }
  }, [isConnected, address, connector]);

  return {
    user,
    loading,
    error,
    refreshUser
  };
}; 