"use client"

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';

const ABSTRACT_TESTNET_CHAIN_ID = 11124;

export default function NetworkStatus() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (isConnected && chainId !== ABSTRACT_TESTNET_CHAIN_ID) {
      setIsWrongNetwork(true);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chainId]);

  const handleSwitchNetwork = async () => {
    try {
      setSwitching(true);
      await switchChain({ chainId: ABSTRACT_TESTNET_CHAIN_ID });
    } catch (error) {
      console.error('Failed to switch network:', error);
    } finally {
      setSwitching(false);
    }
  };

  if (!isConnected || !isWrongNetwork) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '70px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#ff6b6b',
      color: 'white',
      padding: 'var(--space-3) var(--space-4)',
      borderRadius: 'var(--border-radius)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      maxWidth: '90vw',
      fontSize: 'var(--font-size-sm)'
    }}>
      <span>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', marginBottom: '2px' }}>
          Wrong Network
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
          Switch to Abstract Testnet to view balances
        </div>
      </div>
      <button
        onClick={handleSwitchNetwork}
        disabled={switching}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--border-radius-sm)',
          cursor: switching ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-xs)',
          fontWeight: '600',
          transition: 'all var(--transition-base)'
        }}
        onMouseEnter={(e) => {
          if (!switching) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!switching) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }
        }}
      >
        {switching ? 'Switching...' : 'Switch Network'}
      </button>
    </div>
  );
}