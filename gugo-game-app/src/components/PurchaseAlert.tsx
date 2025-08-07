import React from 'react';

interface PurchaseAlertProps {
  requiredVotes: number;
  onPurchase: () => void;
  onClose: () => void;
}

export default function PurchaseAlert({ requiredVotes, onPurchase, onClose }: PurchaseAlertProps) {
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'var(--color-white)',
      border: '2px solid var(--color-black)',
      borderRadius: 'var(--border-radius)',
      padding: 'var(--space-6)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: 1000,
      width: '90%',
      maxWidth: '400px',
      textAlign: 'center'
    }}>
      {/* Fire emoji header */}
      <div style={{
        fontSize: '3rem',
        marginBottom: 'var(--space-4)'
      }}>
        🔥
      </div>
      
      {/* Alert message */}
      <h3 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: '900',
        color: 'var(--color-black)',
        marginBottom: 'var(--space-2)',
        letterSpacing: '-0.02em'
      }}>
        Need More Votes!
      </h3>
      
      <p style={{
        fontSize: 'var(--font-size-md)',
        color: 'var(--color-grey-700)',
        marginBottom: 'var(--space-6)',
        lineHeight: 1.5
      }}>
        You need at least <strong>{requiredVotes} votes</strong> to use Super Vote.
        <br />
        Regular votes cost $0.04 each.
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
            background: 'var(--color-green)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-3) var(--space-6)',
            fontSize: 'var(--font-size-md)',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 16px rgba(0, 211, 149, 0.3)'
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLElement;
            target.style.transform = 'translateY(-2px)';
            target.style.boxShadow = '0 6px 24px rgba(0, 211, 149, 0.4)';
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLElement;
            target.style.transform = 'translateY(0)';
            target.style.boxShadow = '0 4px 16px rgba(0, 211, 149, 0.3)';
          }}
        >
          💳 Purchase Votes
        </button>
        
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            color: 'var(--color-grey-600)',
            border: '1px solid var(--color-grey-300)',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-3) var(--space-6)',
            fontSize: 'var(--font-size-md)',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLElement;
            target.style.borderColor = 'var(--color-grey-500)';
            target.style.color = 'var(--color-grey-800)';
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLElement;
            target.style.borderColor = 'var(--color-grey-300)';
            target.style.color = 'var(--color-grey-600)';
          }}
        >
          Maybe Later
        </button>
      </div>
      
      {/* Background overlay to close on click outside */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: -1
        }}
      />
    </div>
  );
}