"use client"

import React from 'react';

interface WelcomePopupProps {
  isOpen: boolean;
  onCollectionChoice: (choice: 'bearish' | 'mix') => void;
}

export default function WelcomePopup({ isOpen, onCollectionChoice }: WelcomePopupProps) {
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
          background: '#1a1a1a', // Dark background to match site
          borderRadius: 'var(--border-radius-lg)',
          padding: 'var(--space-6)', // Smaller padding
          textAlign: 'center',
          maxWidth: '600px', // Back to original size for vertical layout
          width: '100%',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--accent-color)', // Green border to match theme
          position: 'relative'
        }}
        onClick={(e) => {
          // Prevent clicks inside modal from closing it
          e.stopPropagation();
        }}
      >
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
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ 
            color: 'var(--color-white)',
            fontSize: 'var(--font-size-xl)', // Smaller title
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
          color: '#e5e5e5'
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
              <span>Jackpot and Price Raffles every week</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-color)', marginRight: 'var(--space-2)' }}>•</span>
              <span>Free to play, earn more with GUGO</span>
            </div>
          </div>
        </div>

        {/* Question */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ 
            color: 'var(--color-white)',
            fontSize: 'var(--font-size-lg)', // Smaller question
            fontWeight: '600',
            marginBottom: 'var(--space-3)'
          }}>
            Which NFTs do you want to focus on?
          </h2>
        </div>

        {/* Choice Buttons */}
        <div style={{ 
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)'
        }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🐻 Bearish button clicked');
              onCollectionChoice('bearish');
            }}
            style={{
              padding: 'var(--space-2) var(--space-4)', // Even smaller padding
              background: '#333333', // Dark grey
              color: 'var(--color-white)',
              border: '2px solid #333333',
              borderRadius: 'var(--border-radius)',
              fontSize: 'var(--font-size-sm)', // Smaller font
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              minWidth: '120px', // Smaller width
              flex: '1', // Take equal space
              maxWidth: '160px' // Smaller max width
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLElement;
              target.style.background = 'var(--color-white)';
              target.style.color = '#333333';
              target.style.transform = 'translateY(-2px)';
              target.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLElement;
              target.style.background = '#333333';
              target.style.color = 'var(--color-white)';
              target.style.transform = 'translateY(0)';
              target.style.boxShadow = 'none';
            }}
          >
            Bearish
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🎯 Mix it Up button clicked');
              onCollectionChoice('mix');
            }}
            style={{
              padding: 'var(--space-2) var(--space-4)', // Even smaller padding
              background: '#333333', // Same dark grey as Bearish button
              color: 'var(--color-white)', // White text
              border: '2px solid #333333', // Same border
              borderRadius: 'var(--border-radius)',
              fontSize: 'var(--font-size-sm)', // Smaller font
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              minWidth: '120px', // Smaller width
              flex: '1', // Take equal space
              maxWidth: '160px' // Smaller max width
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLElement;
              target.style.background = 'var(--color-white)';
              target.style.color = '#333333';
              target.style.transform = 'translateY(-2px)';
              target.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLElement;
              target.style.background = '#333333';
              target.style.color = 'var(--color-white)';
              target.style.transform = 'translateY(0)';
              target.style.boxShadow = 'none';
            }}
          >
            Mix it Up
          </button>
        </div>

        {/* Subtitle */}
        <div style={{ 
          fontSize: 'var(--font-size-xs)', // Even smaller subtitle
          color: '#999999', // Light grey for dark background
          fontStyle: 'italic'
        }}>
          You can change this preference anytime in settings
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