"use client"

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuth } from '../hooks/useAuth';
import { canClaimFreeVotes, claimFreeVotes } from '../../lib/auth';
import { useState } from 'react';

export default function RainbowWalletConnect() {
  const { address, isConnected } = useAccount();
  const { user, loading, error, refreshUser } = useAuth();
  const [claiming, setClaiming] = useState(false);

  const handleClaimFreeVotes = async () => {
    if (!user || !address) return;
    
    setClaiming(true);
    try {
      const success = await claimFreeVotes(address);
      if (success) {
        await refreshUser();
        console.log('Free votes claimed successfully!');
      } else {
        console.error('Failed to claim free votes');
      }
    } catch (error) {
      console.error('Error claiming free votes:', error);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400">❌ Authentication Error: {error}</p>
        <button
          onClick={refreshUser}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Connected state with user profile
  if (isConnected && address && user) {
    const canClaim = canClaimFreeVotes(user);
    
    return (
      <div className="flex flex-col gap-4 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              <div>
                <p className="text-green-700 dark:text-green-300 font-semibold">Welcome to Taste Machine!</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </div>
            </div>
            <ConnectButton showBalance={false} />
          </div>
          
          {/* User Stats */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-white dark:bg-gray-700 p-3 rounded border">
              <p className="text-sm text-gray-500 dark:text-gray-400">XP</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{user.xp}</p>
            </div>
            <div className="bg-white dark:bg-gray-700 p-3 rounded border">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Votes</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{user.total_votes}</p>
            </div>
          </div>

          {/* Free Votes Claim */}
          {canClaim && (
            <button
              onClick={handleClaimFreeVotes}
              disabled={claiming}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-semibold disabled:opacity-50"
            >
              {claiming ? '⏳ Claiming...' : '🎁 Claim Daily Free Votes'}
            </button>
          )}
          
          {!canClaim && user.last_free_vote_claim && (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
              ⏰ Next free votes available in {Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - new Date(user.last_free_vote_claim).getTime())) / (1000 * 60 * 60))} hours
            </div>
          )}

          {/* Connection Status */}
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅ Wallet Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅ Abstract Chain: Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅ User Profile: Synced</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not connected state
  return (
    <div className="flex flex-col gap-4 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Ready to Play?</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Connect your wallet to start voting on NFT aesthetics!
        </p>
      </div>
      
      {/* RainbowKit Connect Button */}
      <div className="flex justify-center">
        <ConnectButton 
          label="Connect Wallet"
          showBalance={false}
          chainStatus="icon"
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
        />
      </div>
      
      <p className="text-xs text-gray-500 text-center">
        Support for Abstract Global Wallet, MetaMask & more
      </p>
    </div>
  );
} 