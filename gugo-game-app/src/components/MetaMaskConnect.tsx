"use client"

import { useState } from 'react';
import { connectMetamask, isMetamaskInstalled } from '../../lib/wallet';
import { getOrCreateUser, type User } from '../../lib/auth';

interface MetaMaskConnectProps {
  onUserCreated: (user: User) => void;
  onError: (error: string) => void;
}

export default function MetaMaskConnect({ onUserCreated, onError }: MetaMaskConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnectMetaMask = async () => {
    setConnecting(true);
    try {
      // Check if MetaMask is installed
      if (!isMetamaskInstalled()) {
        throw new Error('MetaMask is not installed. Please install MetaMask from metamask.io');
      }

      // Connect to MetaMask and setup Abstract chain
      const walletInfo = await connectMetamask();
      
      if (!walletInfo) {
        throw new Error('Failed to connect to MetaMask');
      }

      console.log('MetaMask connected:', walletInfo.address);

      // Create or get user in our system
      const user = await getOrCreateUser(walletInfo.address, 'metamask');
      
      if (!user) {
        throw new Error('Failed to create user profile');
      }

      setConnected(true);
      onUserCreated(user);
      
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      onError(error.message || 'Failed to connect MetaMask');
    } finally {
      setConnecting(false);
    }
  };

  const openMetaMaskWebsite = () => {
    window.open('https://metamask.io/download/', '_blank');
  };

  if (!isMetamaskInstalled()) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <div className="text-center">
          <div className="text-4xl mb-3">🦊</div>
          <h3 className="text-lg font-semibold mb-2">MetaMask Required</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            MetaMask is required to use this wallet option. It's a secure way to connect to Abstract Chain.
          </p>
        </div>
        <button
          onClick={openMetaMaskWebsite}
          className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
        >
          📱 Install MetaMask
        </button>
        <p className="text-xs text-gray-500 text-center">
          After installing, refresh this page to connect
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="text-center">
        <div className="text-4xl mb-3">🦊</div>
        <h3 className="text-lg font-semibold mb-2">Connect with MetaMask</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Connect your MetaMask wallet to Abstract Chain and start playing!
        </p>
      </div>
      
      <button
        onClick={handleConnectMetaMask}
        disabled={connecting || connected}
        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-blue-600 text-white rounded-lg hover:from-orange-600 hover:to-blue-700 transition-all duration-200 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {connecting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Connecting MetaMask...
          </span>
        ) : connected ? (
          '✅ Connected!'
        ) : (
          '🔗 Connect MetaMask'
        )}
      </button>

      <div className="text-xs text-gray-500 space-y-1">
        <p>• MetaMask will prompt you to add Abstract Chain</p>
        <p>• Make sure to approve the network addition</p>
        <p>• Your wallet will be automatically set up for the game</p>
      </div>
    </div>
  );
} 