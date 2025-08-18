"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSessionVotePurchase } from '@/hooks/useSessionVotePurchase';
import { useSessionKey } from '@/hooks/useSessionKey';
import { getCurrentPrices, PriceData } from '@lib/token';

interface SimplifiedLicksPurchaseProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete?: (licksCount: number) => void;
  suggestedAmount?: number; // Pre-fill based on context (e.g., insufficient votes)
}

// 🎯 Simplified purchase options - focus on most common use cases
const QUICK_OPTIONS = [
  { licks: 100, label: '100 Licks', popular: false, price: '$2.00' },
  { licks: 500, label: '500 Licks', popular: true, price: '$10.00' },
  { licks: 1000, label: '1000 Licks', popular: false, price: '$20.00' }
];

export function SimplifiedLicksPurchase({ 
  isOpen, 
  onClose, 
  onPurchaseComplete,
  suggestedAmount 
}: SimplifiedLicksPurchaseProps) {
  const [selectedLicks, setSelectedLicks] = useState(500); // Default to popular option
  const [isProcessing, setIsProcessing] = useState(false);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  
  const { purchaseVotes, isPurchasing, purchaseError } = useSessionVotePurchase();
  const { isSessionActive, createSession } = useSessionKey();

  // Fetch price data when modal opens
  useEffect(() => {
    if (isOpen) {
      getCurrentPrices().then(setPriceData).catch(console.error);
    }
  }, [isOpen]);

  // Set suggested amount on open
  useEffect(() => {
    if (isOpen && suggestedAmount) {
      // Find closest option or use suggested amount
      const options = [
        { licks: 100 },
        { licks: 500 },
        { licks: 1000 }
      ];
      const closestOption = options.reduce((prev, curr) => 
        Math.abs(curr.licks - suggestedAmount) < Math.abs(prev.licks - suggestedAmount) ? curr : prev
      );
      setSelectedLicks(closestOption.licks);
    }
  }, [isOpen, suggestedAmount]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedLicks(500); // Reset to popular option
      setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate USD price based on real GUGO rate
  const getUSDPrice = (licks: number): string => {
    if (!priceData) return '$-- USD';
    const costUSD = licks * 0.02; // $0.02 per lick
    return `$${Math.round(costUSD)} USD`;
  };
  
  // Dynamic options with real USD pricing
  const dynamicOptions = [
    { licks: 100, label: '100 Licks', popular: false, price: getUSDPrice(100) },
    { licks: 500, label: '500 Licks', popular: true, price: getUSDPrice(500) },
    { licks: 1000, label: '1000 Licks', popular: false, price: getUSDPrice(1000) }
  ];

  const selectedOption = dynamicOptions.find(opt => opt.licks === selectedLicks) || dynamicOptions[1];
  const costUSD = selectedLicks * 0.02; // $0.02 per lick
  const costGUGO = priceData ? costUSD / priceData.gugoUsd : costUSD / 0.005; // Use real GUGO price or fallback

  const handlePurchase = async () => {
    setIsProcessing(true);
    
    try {
      // Auto-create session if needed (seamless experience)
      if (!isSessionActive) {
        console.log('🔑 Creating session for seamless purchase...');
        const sessionCreated = await createSession();
        if (sessionCreated) {
          console.log('✅ Session created successfully! UI should now show green indicator.');
          // Small delay to ensure state propagation
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          console.log('⚠️ Session creation failed, continuing with signature-based purchase');
        }
      }

      console.log(`🛒 Purchasing ${selectedLicks} Licks for ${costGUGO.toFixed(0)} GUGO`);
      
      const result = await purchaseVotes(selectedLicks, 0.02, 'GUGO');
      
      if (result.success) {
        console.log('✅ Purchase successful!', result);
        onPurchaseComplete?.(selectedLicks);
        onClose();
      } else {
        console.error('❌ Purchase failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Purchase error:', error);
    } finally {
      setIsProcessing(false);
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
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          backdropFilter: 'blur(8px)'
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--dynamic-bg-color, var(--color-white))',
        border: `3px solid var(--dynamic-text-color, var(--color-black))`,
        borderRadius: '16px',
        padding: '32px',
        boxShadow: `0 20px 60px rgba(0,0,0,0.4)`,
        zIndex: 1001,
        width: '90%',
        maxWidth: '420px',
        textAlign: 'center',
        fontFamily: 'var(--font-family-mono)'
      }}>
        
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
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
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'var(--dynamic-text-color, var(--color-black))',
            margin: 0,
            marginBottom: '8px'
          }}>
            Get More Licks
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--dynamic-text-color, var(--color-black))',
            opacity: 0.7,
            margin: 0
          }}>
            Choose your amount and purchase instantly
          </p>
        </div>

        {/* Quick Options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {dynamicOptions.map((option) => (
            <button
              key={option.licks}
              onClick={() => setSelectedLicks(option.licks)}
              style={{
                position: 'relative',
                padding: '16px 8px',
                border: selectedLicks === option.licks 
                  ? `3px solid var(--dynamic-accent-color, var(--color-green))` 
                  : `2px solid var(--dynamic-text-color, var(--color-black))`,
                borderRadius: '12px',
                background: selectedLicks === option.licks 
                  ? 'var(--dynamic-accent-color, var(--color-green))' 
                  : 'transparent',
                color: selectedLicks === option.licks 
                  ? 'var(--color-white)' 
                  : 'var(--dynamic-text-color, var(--color-black))',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '14px',
                fontWeight: 'bold',
                fontFamily: 'inherit'
              }}
            >
              {option.popular && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--dynamic-accent-color, var(--color-green))',
                  color: 'var(--color-white)',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontWeight: 'bold'
                }}>
                  POPULAR
                </div>
              )}
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                {option.licks}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                {option.price}
              </div>
            </button>
          ))}
        </div>

        {/* Purchase Summary */}
        <div style={{
          background: 'var(--dynamic-text-color, var(--color-black))',
          color: 'var(--dynamic-bg-color, var(--color-white))',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Amount:</span>
            <span style={{ fontWeight: 'bold' }}>{selectedLicks} Licks</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Cost:</span>
            <span style={{ fontWeight: 'bold' }}>{costGUGO.toFixed(0)} GUGO</span>
          </div>
          <div style={{ 
            borderTop: '1px solid rgba(255,255,255,0.2)', 
            paddingTop: '8px',
            fontSize: '12px',
            opacity: 0.7
          }}>
            {isSessionActive ? 'Instant purchase (no signatures)' : 'Requires wallet signature'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              flex: 1,
              padding: '16px',
              border: `2px solid var(--dynamic-text-color, var(--color-black))`,
              borderRadius: '12px',
              background: 'transparent',
              color: 'var(--dynamic-text-color, var(--color-black))',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              fontFamily: 'inherit',
              opacity: isProcessing ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handlePurchase}
            disabled={isProcessing || selectedLicks < 100}
            style={{
              flex: 2,
              padding: '16px',
              border: 'none',
              borderRadius: '12px',
              background: isProcessing 
                ? 'var(--color-grey-400)' 
                : 'var(--dynamic-accent-color, var(--color-green))',
              color: 'var(--color-white)',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
          >
            {isProcessing ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Processing...
              </span>
            ) : (
              `Purchase ${selectedLicks} Licks`
            )}
          </button>
        </div>

        {/* Error Display */}
        {purchaseError && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '8px',
            color: 'red',
            fontSize: '14px'
          }}>
            {purchaseError}
          </div>
        )}
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
