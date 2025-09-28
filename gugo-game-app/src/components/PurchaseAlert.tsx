import React from 'react';
import { createPortal } from 'react-dom';

interface PurchaseAlertProps {
  requiredVotes: number;
  onPurchase: () => void;
  onClose: () => void;
}

export default function PurchaseAlert({ requiredVotes, onPurchase, onClose }: PurchaseAlertProps) {
  // Don't render on server side
  if (typeof window === 'undefined') {
    return null;
  }

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
      
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--dynamic-bg-color, var(--color-white))',
        border: `2px solid var(--dynamic-text-color, var(--color-black))`,
        borderRadius: 'var(--border-radius)',
        padding: 'var(--space-6)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px var(--dynamic-text-color, var(--color-black))`,
        zIndex: 1001,
        width: '90%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {/* Licks icon header */}
        <div style={{
          fontSize: '3rem',
          marginBottom: 'var(--space-4)',
          filter: `drop-shadow(0 0 8px var(--dynamic-text-color, var(--color-black)))`
        }}>
          <img 
            src="/lick-icon.png" 
            alt="Licks" 
            style={{ 
              width: '48px', 
              height: '48px',
              // Dynamic color filter based on text color
              filter: 'brightness(0) saturate(100%)',
              // Use CSS mask to apply dynamic color
              WebkitMask: 'url(/lick-icon.png) no-repeat center',
              mask: 'url(/lick-icon.png) no-repeat center',
              backgroundColor: 'var(--dynamic-text-color, var(--color-black))'
            }} 
          />
        </div>
        
        {/* Alert message */}
        <h3 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: '900',
          color: 'var(--dynamic-text-color, var(--color-black))',
          marginBottom: 'var(--space-2)',
          letterSpacing: '-0.02em',
          textShadow: `0 0 12px var(--dynamic-text-color, var(--color-black))`,
          background: `linear-gradient(45deg, var(--dynamic-text-color, var(--color-black)), var(--dynamic-text-color, var(--color-black)))`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          animation: 'shine 2s ease-in-out infinite'
        }}>
          Need More Licks!
        </h3>
        
        <p style={{
          fontSize: 'var(--font-size-md)',
          color: 'var(--dynamic-text-color, var(--color-grey-700))',
          marginBottom: 'var(--space-6)',
          lineHeight: 1.5,
          opacity: 0.8
        }}>
          You need at least <strong style={{ color: 'var(--dynamic-text-color, var(--color-black))' }}>{requiredVotes} Licks</strong> to use {requiredVotes > 1 ? 'Super Vote' : 'this feature'}.
          <br />
          <span style={{ fontSize: 'var(--font-size-sm)', opacity: 0.7 }}>
            Licks start at $0.04 each
          </span>
        </p>
        
        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'center'
        }}>
          {/* Purchase button */}
          <button
            onClick={onPurchase}
            style={{
              background: 'var(--dynamic-text-color, var(--color-black))',
              color: 'var(--dynamic-bg-color, var(--color-white))',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--space-3) var(--space-5)',
              fontSize: 'var(--font-size-md)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '-0.01em',
              boxShadow: `0 4px 12px rgba(0,0,0,0.2), 0 0 0 1px var(--dynamic-text-color, var(--color-black))`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 6px 16px rgba(0,0,0,0.3), 0 0 0 1px var(--dynamic-text-color, var(--color-black))`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.2), 0 0 0 1px var(--dynamic-text-color, var(--color-black))`;
            }}
          >
            Buy Licks
          </button>
          
          {/* Cancel button */}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--dynamic-text-color, var(--color-grey-600))',
              border: `1px solid var(--dynamic-text-color, var(--color-grey-300))`,
              borderRadius: 'var(--border-radius)',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--font-size-md)',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '-0.01em',
              opacity: 0.8
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}