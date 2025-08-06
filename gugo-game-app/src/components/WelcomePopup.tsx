"use client"

import React from 'react';

interface WelcomePopupProps {
  isOpen: boolean;
  onAccept: () => void;
}

export default function WelcomePopup({ isOpen, onAccept }: WelcomePopupProps) {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)', // More transparent to see background
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 'var(--space-4)',
        backdropFilter: 'blur(4px)' // Less blur to see loading behind
      }}
      onClick={(e) => {
        // Prevent auto-closing when clicking outside
        e.stopPropagation();
      }}
    >
      <div 
        style={{
          background: 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)', // Medium-dark gradient for readability
          borderRadius: 'var(--border-radius-lg)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
          border: '2px solid var(--accent-color)',
          position: 'relative',
          overflow: 'hidden' // For halftone dots
        }}
        onClick={(e) => {
          // Prevent clicks inside modal from closing it
          e.stopPropagation();
        }}
      >
        {/* Halftone dots around edges */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          bottom: '10px',
          pointerEvents: 'none',
          background: `
            radial-gradient(circle at 20px 20px, var(--accent-color) 2px, transparent 2px),
            radial-gradient(circle at 40px 35px, rgba(0,0,0,0.15) 1.5px, transparent 1.5px),
            radial-gradient(circle at 15px 50px, var(--accent-color) 1px, transparent 1px),
            radial-gradient(circle at 35px 15px, rgba(0,0,0,0.1) 1px, transparent 1px),
            radial-gradient(circle at calc(100% - 20px) 20px, var(--accent-color) 2px, transparent 2px),
            radial-gradient(circle at calc(100% - 40px) 35px, rgba(0,0,0,0.15) 1.5px, transparent 1.5px),
            radial-gradient(circle at calc(100% - 15px) 50px, var(--accent-color) 1px, transparent 1px),
            radial-gradient(circle at calc(100% - 35px) 15px, rgba(0,0,0,0.1) 1px, transparent 1px),
            radial-gradient(circle at 20px calc(100% - 20px), var(--accent-color) 2px, transparent 2px),
            radial-gradient(circle at 40px calc(100% - 35px), rgba(0,0,0,0.15) 1.5px, transparent 1.5px),
            radial-gradient(circle at 15px calc(100% - 50px), var(--accent-color) 1px, transparent 1px),
            radial-gradient(circle at 35px calc(100% - 15px), rgba(0,0,0,0.1) 1px, transparent 1px),
            radial-gradient(circle at calc(100% - 20px) calc(100% - 20px), var(--accent-color) 2px, transparent 2px),
            radial-gradient(circle at calc(100% - 40px) calc(100% - 35px), rgba(0,0,0,0.15) 1.5px, transparent 1.5px),
            radial-gradient(circle at calc(100% - 15px) calc(100% - 50px), var(--accent-color) 1px, transparent 1px),
            radial-gradient(circle at calc(100% - 35px) calc(100% - 15px), rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px, 60px 60px, 60px 60px, 60px 60px',
          opacity: 0.6,
          borderRadius: 'var(--border-radius-lg)'
        }} />

        {/* GOGO Duck Image - Back on Top */}
        <div style={{ 
          marginBottom: 'var(--space-4)',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <img 
            src="/GOGO-duck-at-easel-01.png" 
            alt="GOGO Duck at Easel"
            style={{
              width: '180px', // Keep the larger size
              height: 'auto',
              borderRadius: 'var(--border-radius)',
              filter: 'drop-shadow(0 6px 20px rgba(255, 255, 255, 0.2))' // White glow effect
            }}
          />
        </div>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-5)', position: 'relative', zIndex: 1 }}>
          <h1 style={{ 
            color: '#ffffff', // White text for dark background
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            marginBottom: 'var(--space-4)',
            lineHeight: '1.3'
          }}>
            Welcome to Taste Machine
          </h1>
        </div>

        {/* Body Text */}
        <div style={{ 
          marginBottom: 'var(--space-6)',
          textAlign: 'left',
          fontSize: 'var(--font-size-base)',
          lineHeight: '1.5',
          color: '#e5e5e5', // Light text for dark background
          position: 'relative',
          zIndex: 1
        }}>
          <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-lg)' }}>
            Where beauty matters and metadata doesn't.
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)' }}>
            You vote, you earn GUGO, and we burn the rest. Let's find out what actually looks good.
          </p>

          {/* Bullet Points */}
          <div style={{ 
            textAlign: 'left', 
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            maxWidth: '400px',
            margin: '0 0 var(--space-4) 0'
          }}>
            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-color)', marginRight: 'var(--space-2)' }}>•</span>
              <span>Whatever you win, we burn the same amount.</span>
            </div>
            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-color)', marginRight: 'var(--space-2)' }}>•</span>
              <span>10 free votes daily (with multipliers)</span>
            </div>
            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-color)', marginRight: 'var(--space-2)' }}>•</span>
              <span>Prize Breaks every 10 votes</span>
            </div>
            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-color)', marginRight: 'var(--space-2)' }}>•</span>
              <span>Jackpot and Prize Raffles every week</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-color)', marginRight: 'var(--space-2)' }}>•</span>
              <span>Free to play, earn more with GUGO</span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div style={{ marginBottom: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
          <h2 style={{ 
            color: '#ffffff', // White text for dark background
            fontSize: 'var(--font-size-lg)',
            fontWeight: '600',
            marginBottom: 'var(--space-3)'
          }}>
            Let's start voting?
          </h2>
        </div>

        {/* Start Button */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 'var(--space-4)',
          position: 'relative',
          zIndex: 1
        }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🚀 Starting voting experience...');
              onAccept();
            }}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--color-white)',
              color: 'var(--color-black)',
              border: '2px solid var(--color-white)',
              borderRadius: 'var(--border-radius)',
              fontSize: 'var(--font-size-base)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              minWidth: '200px',
              boxShadow: '0 4px 20px rgba(255, 255, 255, 0.3)'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLElement;
              target.style.background = 'transparent';
              target.style.color = 'var(--color-white)';
              target.style.transform = 'translateY(-2px)';
              target.style.boxShadow = '0 6px 25px rgba(255, 255, 255, 0.5)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLElement;
              target.style.background = 'var(--color-white)';
              target.style.color = 'var(--color-black)';
              target.style.transform = 'translateY(0)';
              target.style.boxShadow = '0 4px 20px rgba(255, 255, 255, 0.3)';
            }}
          >
            Ready to Start Voting
          </button>
        </div>

        {/* Note */}
        <div style={{ 
          fontSize: 'var(--font-size-xs)',
          color: '#999999', // Light gray for dark background
          fontStyle: 'italic',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          You'll see NFTs from all collections for maximum variety
        </div>

        {/* Monster Logo - Bottom Right Corner */}
        <div style={{
          position: 'absolute',
          bottom: 'var(--space-3)',
          right: 'var(--space-3)',
          opacity: 0.6
        }}>
          <img 
            src="/Taste-Machine-Monster-Abstract-Green-150x150.png" 
            alt="Taste Machine Logo"
            style={{
              width: '40px',
              height: '40px',
              objectFit: 'contain'
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      </div>
    </div>
  );
}