/**
 * 🛒 Unified Purchase Flow - Streamlined Licks Purchase Experience
 * 
 * Replaces multiple overlapping purchase components with a single, 
 * context-aware purchase flow that adapts to user needs.
 */

"use client"

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSessionVotePurchase } from '@/hooks/useSessionVotePurchase';
import { useSessionKey } from '@/hooks/useSessionKey';

// ================================
// 📋 TYPES & INTERFACES
// ================================

interface UnifiedPurchaseFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete?: (licksCount: number) => void;
  
  // Context-aware props
  context?: 'insufficient' | 'general' | 'super-vote';
  requiredVotes?: number;
  suggestedAmount?: number;
  
  // Customization
  title?: string;
  description?: string;
  showQuickOptions?: boolean;
}

interface PurchaseOption {
  id: string;
  licks: number;
  priceUSD: number;
  label: string;
  popular?: boolean;
  quickAction?: boolean;
  description?: string;
}

// ================================
// 🎯 PURCHASE OPTIONS CONFIGURATION
// ================================

const QUICK_OPTIONS: PurchaseOption[] = [
  {
    id: 'quick-50',
    licks: 50,
    priceUSD: 1.00,
    label: '50 Licks',
    description: 'Perfect for a few more votes',
    quickAction: true
  },
  {
    id: 'quick-100',
    licks: 100,
    priceUSD: 2.00,
    label: '100 Licks',
    description: 'Great for extended voting',
    quickAction: true
  }
];

const STANDARD_OPTIONS: PurchaseOption[] = [
  {
    id: 'standard-100',
    licks: 100,
    priceUSD: 2.00,
    label: '100 Licks',
    description: 'Good for casual voting'
  },
  {
    id: 'standard-500',
    licks: 500,
    priceUSD: 10.00,
    label: '500 Licks',
    description: 'Best value for active users',
    popular: true
  },
  {
    id: 'standard-1000',
    licks: 1000,
    priceUSD: 20.00,
    label: '1000 Licks',
    description: 'For power users'
  }
];

// ================================
// 🛒 UNIFIED PURCHASE FLOW COMPONENT
// ================================

export function UnifiedPurchaseFlow({
  isOpen,
  onClose,
  onPurchaseComplete,
  context = 'general',
  requiredVotes = 0,
  suggestedAmount,
  title,
  description,
  showQuickOptions = true
}: UnifiedPurchaseFlowProps) {
  
  // ================================
  // 🔄 STATE MANAGEMENT
  // ================================
  
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'options' | 'processing' | 'success'>('options');
  const [purchasedAmount, setPurchasedAmount] = useState(0);
  
  const { purchaseVotes, isPurchasing, purchaseError } = useSessionVotePurchase();
  const { isSessionActive, createSession } = useSessionKey();

  // ================================
  // 🎯 CONTEXT-AWARE CONFIGURATION
  // ================================
  
  const getContextConfig = useCallback(() => {
    switch (context) {
      case 'insufficient':
        return {
          title: title || 'Need More Licks',
          description: description || `You need ${requiredVotes} more Licks to continue voting`,
          primaryOptions: QUICK_OPTIONS,
          secondaryOptions: STANDARD_OPTIONS.slice(0, 2), // Limit options for simplicity
          showQuickActions: true,
          urgency: 'high'
        };
      
      case 'super-vote':
        return {
          title: title || 'Super Vote Requires Licks',
          description: description || `Super Vote (🔥) requires ${requiredVotes} Licks to use`,
          primaryOptions: QUICK_OPTIONS,
          secondaryOptions: STANDARD_OPTIONS,
          showQuickActions: true,
          urgency: 'medium'
        };
      
      case 'general':
      default:
        return {
          title: title || 'Get More Licks',
          description: description || 'Choose your Licks package to continue voting',
          primaryOptions: showQuickOptions ? QUICK_OPTIONS : [],
          secondaryOptions: STANDARD_OPTIONS,
          showQuickActions: showQuickOptions,
          urgency: 'low'
        };
    }
  }, [context, title, description, requiredVotes, showQuickOptions]);

  const config = getContextConfig();

  // ================================
  // 🔄 EFFECTS & INITIALIZATION
  // ================================
  
  // Auto-select appropriate option based on context
  useEffect(() => {
    if (isOpen && !selectedOption) {
      if (suggestedAmount) {
        // Find closest option to suggested amount
        const allOptions = [...config.primaryOptions, ...config.secondaryOptions];
        const closest = allOptions.reduce((prev, curr) => 
          Math.abs(curr.licks - suggestedAmount) < Math.abs(prev.licks - suggestedAmount) ? curr : prev
        );
        setSelectedOption(closest.id);
      } else if (config.primaryOptions.length > 0) {
        // Default to first primary option for quick actions
        setSelectedOption(config.primaryOptions[0].id);
      } else {
        // Default to popular option
        const popular = config.secondaryOptions.find(opt => opt.popular);
        setSelectedOption(popular?.id || config.secondaryOptions[0]?.id || '');
      }
    }
  }, [isOpen, suggestedAmount, config, selectedOption]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedOption('');
      setIsProcessing(false);
      setCurrentStep('options');
      setPurchasedAmount(0);
    }
  }, [isOpen]);

  // ================================
  // 🛒 PURCHASE LOGIC
  // ================================
  
  const handlePurchase = async (option: PurchaseOption) => {
    setIsProcessing(true);
    setCurrentStep('processing');
    
    try {
      // Auto-create session if needed for seamless experience
      if (!isSessionActive) {
        console.log('🔑 Creating session for seamless purchase...');
        const sessionCreated = await createSession();
        if (sessionCreated) {
          console.log('✅ Session created successfully');
          // Small delay to ensure state propagation
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`🛒 Purchasing ${option.licks} Licks for $${option.priceUSD.toFixed(2)}`);
      
      const result = await purchaseVotes(option.licks, 0.02, 'GUGO');
      
      if (result.success) {
        console.log('✅ Purchase successful!', result);
        setPurchasedAmount(option.licks);
        setCurrentStep('success');
        
        // Auto-close after success animation
        setTimeout(() => {
          onPurchaseComplete?.(option.licks);
          onClose();
        }, 2000);
      } else {
        console.error('❌ Purchase failed:', result.error);
        setCurrentStep('options');
      }
    } catch (error) {
      console.error('❌ Purchase error:', error);
      setCurrentStep('options');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickPurchase = (option: PurchaseOption) => {
    setSelectedOption(option.id);
    handlePurchase(option);
  };

  // ================================
  // 🎨 RENDER HELPERS
  // ================================
  
  const renderQuickActions = () => {
    if (!config.showQuickActions || config.primaryOptions.length === 0) return null;

    return (
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: config.urgency === 'high' 
          ? 'var(--dynamic-accent-color, var(--color-green))' 
          : 'rgba(0,0,0,0.05)',
        borderRadius: '12px',
        border: config.urgency === 'high' 
          ? '2px solid var(--dynamic-accent-color, var(--color-green))'
          : '1px solid rgba(0,0,0,0.1)'
      }}>
        <div style={{
          color: config.urgency === 'high' ? 'var(--color-white)' : 'var(--dynamic-text-color)',
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          ⚡ Quick & Easy
        </div>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          {config.primaryOptions.map(option => (
            <button
              key={option.id}
              onClick={() => handleQuickPurchase(option)}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: '14px 12px',
                background: config.urgency === 'high' ? 'var(--color-white)' : 'var(--dynamic-text-color)',
                color: config.urgency === 'high' 
                  ? 'var(--dynamic-accent-color, var(--color-green))' 
                  : 'var(--dynamic-bg-color)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.7 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              <div>{option.label}</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                ${option.priceUSD.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderStandardOptions = () => {
    if (config.secondaryOptions.length === 0) return null;

    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'var(--dynamic-text-color)',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          {config.showQuickActions ? 'More Options' : 'Choose Your Package'}
        </div>
        
        <div style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: config.secondaryOptions.length <= 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'
        }}>
          {config.secondaryOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              style={{
                padding: '16px 12px',
                border: selectedOption === option.id 
                  ? '3px solid var(--dynamic-accent-color, var(--color-green))'
                  : '2px solid rgba(0,0,0,0.2)',
                borderRadius: '12px',
                background: selectedOption === option.id 
                  ? 'rgba(var(--dynamic-accent-color-rgb, 0,128,0), 0.1)'
                  : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {option.popular && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '8px',
                  background: 'var(--dynamic-accent-color, var(--color-green))',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 'bold'
                }}>
                  POPULAR
                </div>
              )}
              
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'var(--dynamic-text-color)',
                marginBottom: '4px'
              }}>
                {option.label}
              </div>
              
              <div style={{
                fontSize: '16px',
                color: 'var(--dynamic-text-color)',
                fontWeight: 'bold',
                marginBottom: '4px'
              }}>
                ${option.priceUSD.toFixed(2)}
              </div>
              
              {option.description && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--dynamic-text-color)',
                  opacity: 0.7
                }}>
                  {option.description}
                </div>
              )}
            </button>
          ))}
        </div>
        
        {selectedOption && !config.primaryOptions.some(opt => opt.id === selectedOption) && (
          <button
            onClick={() => {
              const option = config.secondaryOptions.find(opt => opt.id === selectedOption);
              if (option) handlePurchase(option);
            }}
            disabled={isProcessing}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '16px',
              background: 'var(--dynamic-accent-color, var(--color-green))',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {isProcessing ? 'Processing...' : `Purchase ${config.secondaryOptions.find(opt => opt.id === selectedOption)?.label}`}
          </button>
        )}
      </div>
    );
  };

  const renderProcessingState = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(0,0,0,0.1)',
        borderTop: '4px solid var(--dynamic-accent-color, var(--color-green))',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px'
      }} />
      
      <h3 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: 'var(--dynamic-text-color)',
        margin: '0 0 8px 0'
      }}>
        Processing Purchase
      </h3>
      
      <p style={{
        fontSize: '16px',
        color: 'var(--dynamic-text-color)',
        opacity: 0.7,
        margin: 0
      }}>
        Please wait while we process your transaction...
      </p>
    </div>
  );

  const renderSuccessState = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{
        fontSize: '60px',
        marginBottom: '20px',
        animation: 'bounce 0.6s ease-in-out'
      }}>
        ✅
      </div>
      
      <h3 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: 'var(--dynamic-accent-color, var(--color-green))',
        margin: '0 0 8px 0'
      }}>
        Purchase Successful!
      </h3>
      
      <p style={{
        fontSize: '18px',
        color: 'var(--dynamic-text-color)',
        margin: '0 0 16px 0'
      }}>
        You received <strong>{purchasedAmount} Licks</strong>
      </p>
      
      <p style={{
        fontSize: '14px',
        color: 'var(--dynamic-text-color)',
        opacity: 0.7,
        margin: 0
      }}>
        Happy voting! 🎉
      </p>
    </div>
  );

  // ================================
  // 🎨 MAIN RENDER
  // ================================
  
  if (!isOpen) return null;

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
        onClick={currentStep === 'options' ? onClose : undefined}
      />
      
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--dynamic-bg-color, var(--color-white))',
        border: `3px solid var(--dynamic-accent-color, var(--color-green))`,
        borderRadius: '16px',
        padding: currentStep === 'options' ? '32px' : '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        zIndex: 1001,
        width: '90%',
        maxWidth: currentStep === 'options' ? '480px' : '400px',
        maxHeight: '90vh',
        overflowY: 'auto',
        fontFamily: 'var(--font-family-mono)'
      }}>
        
        {currentStep === 'options' && (
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: 'var(--dynamic-text-color)',
                WebkitMask: 'url(/lick-icon.png) no-repeat center/contain',
                mask: 'url(/lick-icon.png) no-repeat center/contain',
                margin: '0 auto 16px'
              }} />
              
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'var(--dynamic-text-color)',
                margin: '0 0 8px 0'
              }}>
                {config.title}
              </h2>
              
              <p style={{
                fontSize: '16px',
                color: 'var(--dynamic-text-color)',
                opacity: 0.8,
                margin: 0
              }}>
                {config.description}
              </p>
            </div>

            {/* Quick Actions */}
            {renderQuickActions()}

            {/* Standard Options */}
            {renderStandardOptions()}

            {/* Cancel Button */}
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px',
                  border: `2px solid var(--dynamic-text-color)`,
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--dynamic-text-color)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  opacity: 0.7,
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                Maybe Later
              </button>
            </div>
          </>
        )}

        {currentStep === 'processing' && renderProcessingState()}
        {currentStep === 'success' && renderSuccessState()}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
          40%, 43% { transform: translateY(-20px); }
          70% { transform: translateY(-10px); }
          90% { transform: translateY(-4px); }
        }
      `}</style>
    </>,
    document.body
  );
}

// ================================
// 🎯 CONVENIENCE HOOKS & COMPONENTS
// ================================

/**
 * Hook for managing unified purchase flow state
 */
export function useUnifiedPurchase() {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<'insufficient' | 'general' | 'super-vote'>('general');
  const [requiredVotes, setRequiredVotes] = useState(0);

  const openPurchaseFlow = useCallback((
    purchaseContext: 'insufficient' | 'general' | 'super-vote' = 'general',
    required: number = 0
  ) => {
    setContext(purchaseContext);
    setRequiredVotes(required);
    setIsOpen(true);
  }, []);

  const closePurchaseFlow = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    context,
    requiredVotes,
    openPurchaseFlow,
    closePurchaseFlow
  };
}

/**
 * Quick Licks Button using unified flow
 */
interface UnifiedQuickLicksButtonProps {
  needed?: number;
  variant?: 'primary' | 'secondary' | 'minimal';
  label?: string;
  onPurchaseComplete?: (licksCount: number) => void;
  style?: React.CSSProperties;
}

export function UnifiedQuickLicksButton({ 
  needed, 
  variant = 'primary', 
  label,
  onPurchaseComplete,
  style = {}
}: UnifiedQuickLicksButtonProps) {
  const { isOpen, openPurchaseFlow, closePurchaseFlow } = useUnifiedPurchase();

  const getButtonText = () => {
    if (label) return label;
    if (needed && needed > 0) {
      const suggestedAmount = needed <= 100 ? 100 : needed <= 500 ? 500 : 1000;
      return `Get ${suggestedAmount}+ Licks`;
    }
    return 'Get Licks';
  };

  const getButtonStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: variant === 'minimal' ? '8px 12px' : '12px 16px',
      borderRadius: '8px',
      fontSize: variant === 'minimal' ? '14px' : '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: 'none',
      ...style
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          background: 'var(--dynamic-accent-color, var(--color-green))',
          color: 'var(--color-white)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        };
      case 'secondary':
        return {
          ...baseStyles,
          background: 'transparent',
          color: 'var(--dynamic-text-color, var(--color-black))',
          border: `2px solid var(--dynamic-text-color, var(--color-black))`
        };
      case 'minimal':
        return {
          ...baseStyles,
          background: 'rgba(0,0,0,0.1)',
          color: 'var(--dynamic-text-color, var(--color-black))',
          border: `1px solid rgba(0,0,0,0.2)`
        };
      default:
        return baseStyles;
    }
  };

  return (
    <>
      <button
        onClick={() => openPurchaseFlow('general', needed)}
        style={getButtonStyles()}
      >
        {getButtonText()}
      </button>

      <UnifiedPurchaseFlow
        isOpen={isOpen}
        onClose={closePurchaseFlow}
        onPurchaseComplete={onPurchaseComplete}
        context="general"
        suggestedAmount={needed}
        showQuickOptions={true}
      />
    </>
  );
}
