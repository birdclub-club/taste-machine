"use client"

import { useState } from 'react';
import { SimplifiedLicksPurchase } from './SimplifiedLicksPurchase';

interface QuickLicksButtonProps {
  /** Number of licks needed (for context-aware suggestions) */
  needed?: number;
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'minimal';
  /** Custom button text */
  label?: string;
  /** Callback when purchase completes */
  onPurchaseComplete?: (licksCount: number) => void;
  /** Additional CSS styles */
  style?: React.CSSProperties;
}

export function QuickLicksButton({ 
  needed, 
  variant = 'primary', 
  label,
  onPurchaseComplete,
  style = {}
}: QuickLicksButtonProps) {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Smart button text based on context
  const getButtonText = () => {
    if (label) return label;
    if (needed && needed > 0) {
      // Round up to next tier for display
      const suggestedAmount = needed <= 100 ? 100 : needed <= 500 ? 500 : 1000;
      return `Get ${suggestedAmount}+ Licks`;
    }
    return 'Get Licks';
  };

  // Button styles based on variant
  const getButtonStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: variant === 'minimal' ? '8px 12px' : '12px 16px',
      borderRadius: '8px',
      fontSize: variant === 'minimal' ? '14px' : '16px',
      fontWeight: 'bold',
      fontFamily: 'var(--font-family-mono)',
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
          color: 'var(--dynamic-bg-color)',
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
        onClick={() => setShowPurchaseModal(true)}
        style={getButtonStyles()}
        onMouseEnter={(e) => {
          if (variant === 'primary') {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (variant === 'primary') {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }
        }}
      >
        {getButtonText()}
      </button>

      <SimplifiedLicksPurchase
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onPurchaseComplete={(licksCount) => {
          onPurchaseComplete?.(licksCount);
          setShowPurchaseModal(false);
        }}
        suggestedAmount={needed}
      />
    </>
  );
}
