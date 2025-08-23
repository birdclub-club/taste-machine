"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSessionVotePurchase } from '@/hooks/useSessionVotePurchase';
import { useSessionKey } from '@/hooks/useSessionKey';

interface LicksPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete?: (licksCount: number) => void;
}

interface PurchaseOption {
  id: string;
  licks: number;
  label: string;
  isPopular?: boolean;
}

export function LicksPurchaseModal({ isOpen, onClose, onPurchaseComplete }: LicksPurchaseModalProps) {
  const [selectedOption, setSelectedOption] = useState<string>('100');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [showPriceInETH, setShowPriceInETH] = useState(false);

  const { purchaseVotes, isPurchasing, purchaseError } = useSessionVotePurchase();
  const { 
    isSessionActive 
  } = useSessionKey();

  // Purchase options
  const purchaseOptions: PurchaseOption[] = [
    { id: '10', licks: 10, label: '10' },
    { id: '50', licks: 50, label: '50' },
    { id: '100', licks: 100, label: '100', isPopular: true },
    { id: '500', licks: 500, label: '500' },
    { id: 'custom', licks: 0, label: 'Custom' }
  ];

  // Pricing constants
  const PRICE_PER_LICK_USD = 0.02; // $0.02 per lick
  const GUGO_PRICE_USD = 0.005; // $0.005 per GUGO (real market rate - 500 Licks = 2,000 GUGO)
  const ETH_PRICE_USD = 3000; // $3000 per ETH (approximate market rate)

  // Calculate costs
  const calculateCosts = (lickCount: number) => {
    const costUSD = lickCount * PRICE_PER_LICK_USD;
    const costGUGO = costUSD / GUGO_PRICE_USD;
    const costETHRaw = costUSD / ETH_PRICE_USD;
    // Round ETH to 6 decimal places for display and ensure minimum value
    const costETH = Math.max(costETHRaw, 0.000001);
    return { costUSD, costGUGO, costETH };
  };

  // Get the number of licks for current selection
  const getCurrentLickCount = (): number => {
    if (isCustom) {
      const customCount = parseInt(customAmount);
      return isNaN(customCount) ? 0 : customCount;
    }
    const option = purchaseOptions.find(opt => opt.id === selectedOption);
    return option?.licks || 0;
  };

  const currentLickCount = getCurrentLickCount();
  const { costUSD, costGUGO, costETH } = calculateCosts(currentLickCount);

  // Handle option selection
  const handleOptionSelect = (optionId: string) => {
    if (optionId === 'custom') {
      setIsCustom(true);
      setSelectedOption(optionId);
    } else {
      setIsCustom(false);
      setSelectedOption(optionId);
      setCustomAmount('');
    }
  };

  // Handle custom amount change
  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setCustomAmount(numericValue);
  };

  // Handle purchase
  const handlePurchase = async () => {
    const lickCount = getCurrentLickCount();
    
    if (lickCount < 10) {
      return; // Minimum 10 licks
    }

    try {
      const paymentMethod = showPriceInETH ? 'ETH' : 'GUGO';
      const costDisplay = showPriceInETH ? `${costETH.toFixed(6)} ETH` : `${costGUGO.toFixed(2)} GUGO`;
      
      console.log(`🛒 Purchasing ${lickCount} Licks for ${costDisplay}`);
      
      const result = await purchaseVotes(lickCount, PRICE_PER_LICK_USD, paymentMethod);
      
      if (result.success) {
        console.log('✅ Purchase successful!', result);
        onPurchaseComplete?.(lickCount);
        onClose();
      } else {
        console.error('❌ Purchase failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Purchase error:', error);
    }
  };

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedOption('100');
      setIsCustom(false);
      setCustomAmount('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isValidPurchase = currentLickCount >= 10;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: 'var(--space-4)',
      paddingTop: '80px',
      isolation: 'isolate'
    }}>
      <div style={{
        background: 'var(--dynamic-bg-color, var(--color-black))',
        border: '1px solid var(--dynamic-text-color, #444)',
        borderRadius: 'var(--border-radius)',
        padding: 'var(--space-4)',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            <img
              src="/lick-icon.png"
              alt="Licks"
              style={{
                width: '32px',
                height: '32px'
              }}
            />
            <h2 style={{
              color: 'var(--dynamic-text-color, var(--color-white))',
              fontSize: 'var(--font-size-lg)',
              fontWeight: '600',
              margin: 0,
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
            }}>
              Buy Licks
            </h2>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-grey-400)',
              fontSize: 'var(--font-size-xl)',
              cursor: 'pointer',
              padding: 'var(--space-2)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Price Toggle */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
          gap: 'var(--space-2)'
        }}>
          <div style={{
            display: 'flex',
            background: 'var(--dynamic-bg-color)',
            border: '1px solid #444',
            borderRadius: 'var(--border-radius)',
            padding: '2px'
          }}>
            <button
              onClick={() => setShowPriceInETH(false)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                background: !showPriceInETH ? '#444' : 'transparent',
                color: 'var(--dynamic-text-color, var(--color-white))',
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              GUGO
            </button>
            <button
              onClick={() => setShowPriceInETH(true)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                background: showPriceInETH ? '#444' : 'transparent',
                color: 'var(--dynamic-text-color, var(--color-white))',
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ETH
            </button>
          </div>
          
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: '#999999',
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            {showPriceInETH ? 'Pay with testnet ETH' : 'Pay with GUGO tokens'}
          </div>
        </div>

        {/* Purchase Options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)'
        }}>
          {purchaseOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleOptionSelect(option.id)}
              disabled={isPurchasing}
              style={{
                position: 'relative',
                padding: 'var(--space-2)',
                background: selectedOption === option.id ? 'var(--dynamic-accent-color, #333)' : 'transparent',
                color: 'var(--dynamic-text-color, var(--color-white))',
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                border: selectedOption === option.id ? '1px solid var(--dynamic-text-color, #666)' : '1px solid var(--dynamic-text-color, #444)',
                borderRadius: 'var(--border-radius)',
                cursor: isPurchasing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center',
                fontWeight: '500',
                opacity: isPurchasing ? 0.6 : 1,
                fontSize: 'var(--font-size-sm)'
              }}
              onMouseEnter={(e) => {
                if (!isPurchasing && selectedOption !== option.id) {
                  e.currentTarget.style.borderColor = '#666';
                  e.currentTarget.style.background = '#2a2a2a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPurchasing && selectedOption !== option.id) {
                  e.currentTarget.style.borderColor = '#444';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {option.isPopular && (
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#666',
                  color: 'var(--dynamic-text-color, var(--color-white))',
                  textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                  fontSize: '8px',
                  fontWeight: '600',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Popular
                </div>
              )}
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                marginBottom: 'var(--space-1)'
              }}>
                {option.id === 'custom' ? (
                  <img
                    src="/lick-icon.png"
                    alt="Custom"
                    style={{
                      width: '18px',
                      height: '18px'
                    }}
                  />
                ) : (
                  <>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>{option.licks}</span>
                    <img
                      src="/lick-icon.png"
                      alt="Licks"
                      style={{
                        width: '18px',
                        height: '18px'
                      }}
                    />
                  </>
                )}
              </div>
              
              <div style={{
                fontSize: '10px',
                opacity: 0.7,
                lineHeight: '1.2'
              }}>
                {option.id === 'custom' ? 'Custom' : 
                 showPriceInETH 
                   ? `${calculateCosts(option.licks).costETH.toFixed(6)} ETH`
                   : `${calculateCosts(option.licks).costGUGO.toLocaleString()} GUGO`}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Amount Input */}
        {isCustom && (
          <div style={{
            marginBottom: 'var(--space-4)'
          }}>
            <label style={{
              display: 'block',
              color: 'var(--dynamic-text-color, var(--color-white))',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              marginBottom: 'var(--space-2)'
            }}>
              Custom Amount (minimum 10 Licks)
            </label>
            
            <input
              type="text"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              placeholder="Enter amount..."
              disabled={isPurchasing}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--dynamic-bg-color)',
                border: '2px solid #444',
                borderRadius: 'var(--border-radius)',
                color: 'var(--dynamic-text-color, var(--color-white))',
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#666';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#444';
              }}
            />
          </div>
        )}

        {/* Cost Summary */}
        {currentLickCount > 0 && (
          <div style={{
            background: 'var(--dynamic-bg-color)',
            border: '1px solid #333',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)'
              }}>
                <span style={{ color: 'var(--dynamic-text-color, var(--color-white))', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)', fontSize: 'var(--font-size-base)', fontWeight: '600' }}>
                  {currentLickCount} Licks
                </span>
                <img
                  src="/lick-icon.png"
                  alt="Licks"
                  style={{
                    width: '20px',
                    height: '20px'
                  }}
                />
              </div>
              <span style={{ color: 'var(--dynamic-text-color, var(--color-white))', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)', fontSize: 'var(--font-size-base)', fontWeight: '600' }}>
                {showPriceInETH 
                  ? `${costETH.toFixed(6)} ETH` 
                  : `${costGUGO.toLocaleString()} GUGO`}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--color-grey-400)',
              fontSize: 'var(--font-size-xs)'
            }}>
              <span>${PRICE_PER_LICK_USD.toFixed(2)} per Lick</span>
              <span>${costUSD.toFixed(2)} USD equivalent</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {purchaseError && (
          <div style={{
            background: '#2a1a1a',
            border: '1px solid #dc2626',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            color: '#dc2626',
            fontSize: 'var(--font-size-sm)'
          }}>
            ❌ {purchaseError}
          </div>
        )}

        {/* Warning for invalid amounts */}
        {currentLickCount > 0 && currentLickCount < 10 && (
          <div style={{
            background: '#2a1f1a',
            border: '1px solid #f59e0b',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            color: '#f59e0b',
            fontSize: 'var(--font-size-sm)'
          }}>
            ⚠️ Minimum purchase is 10 Licks
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)'
        }}>
          <button
            onClick={onClose}
            disabled={isPurchasing}
            style={{
              flex: 1,
              padding: 'var(--space-2)',
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: 'var(--border-radius)',
              color: 'var(--dynamic-text-color, var(--color-white))',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '500',
              cursor: isPurchasing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isPurchasing ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handlePurchase}
            disabled={isPurchasing || !isValidPurchase}
            style={{
              flex: 2,
              padding: 'var(--space-2)',
              background: isValidPurchase && !isPurchasing ? '#666' : '#444',
              border: '1px solid transparent',
              borderRadius: 'var(--border-radius)',
              color: 'var(--dynamic-text-color, var(--color-white))',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              cursor: isValidPurchase && !isPurchasing ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            {isPurchasing ? 'Purchasing...' : `BUY ${currentLickCount} LICKS`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}