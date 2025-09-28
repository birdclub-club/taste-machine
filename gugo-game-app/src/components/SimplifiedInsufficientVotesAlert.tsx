"use client"

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { QuickLicksButton } from './QuickLicksButton';
import { useSessionVotePurchase } from '@/hooks/useSessionVotePurchase';
import { useSessionKey } from '@/hooks/useSessionKey';

interface SimplifiedInsufficientVotesAlertProps {
  isOpen: boolean;
  requiredVotes: number;
  onClose: () => void;
  onPurchaseComplete?: (licksCount: number) => void;
}

export function SimplifiedInsufficientVotesAlert({ 
  isOpen, 
  requiredVotes, 
  onClose, 
  onPurchaseComplete 
}: SimplifiedInsufficientVotesAlertProps) {
  const [isQuickPurchasing, setIsQuickPurchasing] = useState(false);
  const { purchaseVotes } = useSessionVotePurchase();
  const { isSessionActive, createSession } = useSessionKey();

  if (!isOpen) return null;

  // Calculate suggested purchase amount (round up to next tier)
  const suggestedAmount = requiredVotes <= 100 ? 100 : 
                         requiredVotes <= 500 ? 500 : 1000;

  // Quick purchase handler for 50 Licks @ $1 USD
  const handleQuickPurchase = async () => {
    setIsQuickPurchasing(true);
    
    try {
      // Auto-create session if needed for seamless experience
      if (!isSessionActive) {
        console.log('🔑 Creating session for quick purchase...');
        await createSession();
      }

      console.log('⚡ Quick purchasing 50 Licks for $1 USD');
      
      const result = await purchaseVotes(50, 0.02, 'GUGO'); // 50 licks at $0.02 each = $1.00
      
      if (result.success) {
        console.log('✅ Quick purchase successful!', result);
        onPurchaseComplete?.(50);
        onClose();
      } else {
        console.error('❌ Quick purchase failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Quick purchase error:', error);
    } finally {
      setIsQuickPurchasing(false);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />
      
      {/* Alert Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--dynamic-bg-color, var(--color-white))',
        border: `3px solid var(--dynamic-accent-color, var(--color-green))`,
        borderRadius: '16px',
        padding: '32px',
        boxShadow: `0 20px 60px rgba(0,0,0,0.4)`,
        zIndex: 1001,
        width: '90%',
        maxWidth: '380px',
        textAlign: 'center',
        fontFamily: 'var(--font-family-mono)'
      }}>
        
        {/* Centered Licks Icon */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: 'var(--dynamic-text-color, var(--color-black))',
            WebkitMask: 'url(/lick-icon.png) no-repeat center/contain',
            mask: 'url(/lick-icon.png) no-repeat center/contain'
          }} />
        </div>
        
        {/* Message */}
        <h3 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: 'var(--dynamic-text-color, var(--color-black))',
          margin: '0 0 8px 0'
        }}>
          Need More Licks
        </h3>
        
        <p style={{
          fontSize: '16px',
          color: 'var(--dynamic-text-color, var(--color-black))',
          margin: '0 0 20px 0',
          opacity: 0.8
        }}>
          You need more Licks to continue earning XP
        </p>

        {/* Quick Add 50 - Prominent Option */}
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          background: 'var(--dynamic-accent-color, var(--color-green))',
          borderRadius: '12px',
          border: '2px solid var(--dynamic-accent-color, var(--color-green))'
        }}>
          <div style={{
            color: 'var(--color-white)',
            fontSize: '14px',
            marginBottom: '8px',
            fontWeight: 'bold'
          }}>
            ⚡ Quick & Easy
          </div>
          <button
            onClick={handleQuickPurchase}
            disabled={isQuickPurchasing}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--dynamic-bg-color, var(--color-white))',
              color: 'var(--dynamic-text-color, var(--color-black))',
              border: `2px solid var(--dynamic-text-color, var(--color-black))`,
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              fontFamily: 'inherit',
              cursor: isQuickPurchasing ? 'not-allowed' : 'pointer',
              opacity: isQuickPurchasing ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {isQuickPurchasing ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(128,128,128,0.3)',
                  borderTop: '2px solid var(--dynamic-text-color, var(--color-black))',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Processing...
              </span>
            ) : (
              'Quick Add 50 Licks - $1 USD'
            )}
          </button>
        </div>

        {/* Alternative Options */}
        <div style={{
          display: 'flex',
          justifyContent: 'center'
        }}>
          <QuickLicksButton
            needed={suggestedAmount}
            variant="secondary"
            label="More Licks Options"
            onPurchaseComplete={(licksCount) => {
              onPurchaseComplete?.(licksCount);
              onClose();
            }}
            style={{
              padding: '12px 20px',
              fontSize: '14px'
            }}
          />
        </div>


      </div>

      {/* Add CSS animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>,
    document.body
  );
}
