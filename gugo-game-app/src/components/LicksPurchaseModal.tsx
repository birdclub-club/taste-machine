"use client"

import { useState, useEffect } from 'react';
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
  console.log('🛒 [FINAL] LicksPurchaseModal render - isOpen:', isOpen, 'at timestamp:', Date.now());
  console.log('🛒 [FINAL] LicksPurchaseModal props:', { isOpen, onClose: !!onClose, onPurchaseComplete: !!onPurchaseComplete });
  const [selectedOption, setSelectedOption] = useState<string>('50');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [showSessionSuggestion, setShowSessionSuggestion] = useState(false);
  const { purchaseVotes, isPurchasing, purchaseError } = useSessionVotePurchase();
  const { 
    sessionStatus, 
    createSession, 
    isCreatingSession, 
    isSessionActive 
  } = useSessionKey();

  // Purchase options
  const purchaseOptions: PurchaseOption[] = [
    { id: '10', licks: 10, label: '10' },
    { id: '50', licks: 50, label: '50', isPopular: true },
    { id: '100', licks: 100, label: '100' },
    { id: '500', licks: 500, label: '500' },
    { id: 'custom', licks: 0, label: 'Custom' }
  ];

  // Pricing constants
  const PRICE_PER_LICK_USD = 0.02; // $0.02 per lick
  const GUGO_PRICE_USD = 0.005; // $0.005 per GUGO (real market rate - 500 Licks = 2,000 GUGO)

  // Calculate costs
  const calculateCosts = (lickCount: number) => {
    const costUSD = lickCount * PRICE_PER_LICK_USD;
    const costGUGO = costUSD / GUGO_PRICE_USD;
    return { costUSD, costGUGO };
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
  const { costUSD, costGUGO } = calculateCosts(currentLickCount);

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
      console.log(`🛒 Purchasing ${lickCount} Licks for ${costGUGO.toFixed(2)} GUGO`);
      
      const result = await purchaseVotes(lickCount, PRICE_PER_LICK_USD);
      
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

  // Reset on close and check session status on open
  useEffect(() => {
    if (!isOpen) {
      setSelectedOption('50');
      setIsCustom(false);
      setCustomAmount('');
      setShowSessionSuggestion(false);
    } else {
      // Check if user has session when modal opens
      const hasSession = sessionStatus?.hasActiveSession && !sessionStatus?.isExpired;
      setShowSessionSuggestion(!hasSession);
    }
  }, [isOpen, sessionStatus]);

  if (!isOpen) {
    console.log('🛒 [FINAL] Modal not rendering because isOpen is false');
    return null;
  }
  
  console.log('🛒 [FINAL] Modal IS rendering because isOpen is true!');

  const isValidPurchase = currentLickCount >= 10;

  return (
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
      zIndex: 1000,
      padding: 'var(--space-4)'
    }}>
      <div style={{
        background: 'var(--color-black)',
        border: '2px solid var(--color-green)',
        borderRadius: 'var(--border-radius)',
        padding: 'var(--space-6)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)'
        }}>
          <h2 style={{
            color: 'var(--color-green)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: '800',
            margin: 0
          }}>
            🎁 Buy Licks
          </h2>
          
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

        {/* Session Suggestion */}
        {showSessionSuggestion && (
          <div style={{
            background: 'linear-gradient(135deg, #1a3d1a 0%, #2a1f1a 100%)',
            border: '1px solid var(--color-green)',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-3)'
            }}>
              <span style={{ fontSize: '1.5rem' }}>💫</span>
              <div>
                <h3 style={{
                  color: 'var(--color-green)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '700',
                  margin: '0 0 var(--space-1) 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Want Seamless Purchasing?
                </h3>
                <p style={{
                  color: 'var(--color-white)',
                  fontSize: 'var(--font-size-xs)',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  Create a secure session to buy Licks instantly without signing each transaction.
                </p>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center'
            }}>
              <button
                onClick={async () => {
                  try {
                    setShowSessionSuggestion(false);
                    const success = await createSession();
                    if (success) {
                      console.log('✅ Session created from purchase modal');
                    }
                  } catch (error) {
                    console.error('❌ Error creating session from modal:', error);
                    setShowSessionSuggestion(true); // Show again on error
                  }
                }}
                disabled={isCreatingSession}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-green)',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: isCreatingSession ? 'not-allowed' : 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '600',
                  color: 'var(--color-black)',
                  transition: 'all 0.2s ease',
                  opacity: isCreatingSession ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)'
                }}
              >
                {isCreatingSession && (
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid var(--color-black)',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                )}
                {isCreatingSession ? 'Creating...' : 'Create Session'}
              </button>
              
              <button
                onClick={() => setShowSessionSuggestion(false)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'transparent',
                  border: '1px solid #444',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-grey-400)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-white)';
                  e.currentTarget.style.borderColor = '#666';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-400)';
                  e.currentTarget.style.borderColor = '#444';
                }}
              >
                Continue with Signatures
              </button>
            </div>
            
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-grey-500)',
              marginTop: 'var(--space-2)',
              lineHeight: '1.3'
            }}>
              💡 You can still purchase, but will need to sign each transaction
            </div>
          </div>
        )}

        {/* Purchase Options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)'
        }}>
          {purchaseOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleOptionSelect(option.id)}
              disabled={isPurchasing}
              style={{
                position: 'relative',
                padding: 'var(--space-4) var(--space-3)',
                background: selectedOption === option.id ? 'var(--color-green)' : 'transparent',
                color: selectedOption === option.id ? 'var(--color-black)' : 'var(--color-white)',
                border: selectedOption === option.id ? '2px solid var(--color-green)' : '2px solid #444',
                borderRadius: 'var(--border-radius)',
                cursor: isPurchasing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center',
                fontWeight: '600',
                opacity: isPurchasing ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!isPurchasing && selectedOption !== option.id) {
                  e.currentTarget.style.borderColor = 'var(--color-green)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPurchasing && selectedOption !== option.id) {
                  e.currentTarget.style.borderColor = '#444';
                }
              }}
            >
              {option.isPopular && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--color-green)',
                  color: 'var(--color-black)',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Popular
                </div>
              )}
              
              <div style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '700',
                marginBottom: 'var(--space-1)'
              }}>
                {option.id === 'custom' ? '✏️' : `${option.licks} 👅`}
              </div>
              
              <div style={{
                fontSize: 'var(--font-size-xs)',
                opacity: 0.8
              }}>
                {option.id === 'custom' ? 'Custom' : 
                 `${calculateCosts(option.licks).costGUGO.toLocaleString()} GUGO`}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Amount Input */}
        {isCustom && (
          <div style={{
            marginBottom: 'var(--space-5)'
          }}>
            <label style={{
              display: 'block',
              color: 'var(--color-white)',
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
                background: '#2a2a2a',
                border: '2px solid #444',
                borderRadius: 'var(--border-radius)',
                color: 'var(--color-white)',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-green)';
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
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-2)'
            }}>
              <span style={{ color: 'var(--color-white)', fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
                {currentLickCount} Licks 👅
              </span>
              <span style={{ color: 'var(--color-green)', fontSize: 'var(--font-size-lg)', fontWeight: '700' }}>
                {costGUGO.toLocaleString()} GUGO
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--color-grey-400)',
              fontSize: 'var(--font-size-sm)'
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
          gap: 'var(--space-3)'
        }}>
          <button
            onClick={onClose}
            disabled={isPurchasing}
            style={{
              flex: 1,
              padding: 'var(--space-3)',
              background: 'transparent',
              border: '2px solid #444',
              borderRadius: 'var(--border-radius)',
              color: 'var(--color-white)',
              fontSize: 'var(--font-size-base)',
              fontWeight: '600',
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
              padding: 'var(--space-3)',
              background: isValidPurchase && !isPurchasing ? 'var(--color-green)' : '#444',
              border: '2px solid transparent',
              borderRadius: 'var(--border-radius)',
              color: isValidPurchase && !isPurchasing ? 'var(--color-black)' : 'var(--color-grey-400)',
              fontSize: 'var(--font-size-base)',
              fontWeight: '700',
              cursor: isValidPurchase && !isPurchasing ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {isPurchasing ? 'Purchasing...' : `Buy ${currentLickCount} Licks`}
          </button>
        </div>
      </div>
    </div>
  );
}