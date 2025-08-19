"use client"

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { claimFreeVotes } from '../../lib/auth';

interface DailyLicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string | undefined;
  onSuccess: (licksAmount: number) => void;
}

export function DailyLicksModal({ isOpen, onClose, address, onSuccess }: DailyLicksModalProps) {
  const [popupStage, setPopupStage] = useState<'initial' | 'animating' | 'result'>('initial');
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [finalVotes, setFinalVotes] = useState(0);
  const [congratsWord, setCongratsWord] = useState('Nice!');
  const multiplierRef = useRef<HTMLSpanElement>(null);

  const handleClose = async () => {
    // Award votes if we just claimed
    if (popupStage === 'result' && finalVotes > 0 && address) {
      try {
        const success = await claimFreeVotes(address, finalVotes);
        if (success) {
          console.log(`🎁 Claimed ${finalVotes} Licks!`);
          onSuccess(finalVotes);
        }
      } catch (error) {
        console.error('Error claiming Licks:', error);
      }
    }
    
    // Reset state and close
    setPopupStage('initial');
    setCurrentMultiplier(1);
    setFinalVotes(0);
    setCongratsWord('Nice!');
    onClose();
  };

  const handleClaim = () => {
    setPopupStage('animating');
    
    // Start 2-second animation
    const animationDuration = 2000;
    const startTime = Date.now();
    const baseVotes = 10;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      if (progress < 1) {
        // Random multiplier between 1-5 during animation
        const randomMultiplier = Math.floor(Math.random() * 5) + 1;
        setCurrentMultiplier(randomMultiplier);
        requestAnimationFrame(animate);
      } else {
        // Final multiplier (weighted towards lower values)
        const finalMultiplier = Math.random() < 0.6 ? 1 : 
                               Math.random() < 0.8 ? 2 : 
                               Math.random() < 0.95 ? 3 : 
                               Math.random() < 0.99 ? 4 : 5;
        
        setCurrentMultiplier(finalMultiplier);
        const totalVotes = baseVotes * finalMultiplier;
        setFinalVotes(totalVotes);
        
        // Random congratulatory word
        const congratsWords = ['Nice!', 'Sweet!', 'Awesome!', 'Great!', 'Perfect!', 'Amazing!', 'Fantastic!', 'Excellent!'];
        const randomWord = congratsWords[Math.floor(Math.random() * congratsWords.length)];
        setCongratsWord(randomWord);
        
        setPopupStage('result');
        console.log(`🎁 Ready to claim ${totalVotes} Licks with ${finalMultiplier}x multiplier!`);
      }
    };
    
    animate();
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100000,
      padding: 'var(--space-4)',
      isolation: 'isolate'
    }} onClick={handleClose}>
      <div style={{
        background: 'var(--dynamic-bg-color)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-6)',
        maxWidth: '400px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '2px solid var(--dynamic-text-color)',
        position: 'relative',
        textAlign: 'center'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'transparent',
            border: 'none',
            color: 'var(--dynamic-text-color)',
            fontSize: '24px',
            cursor: 'pointer',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{
          marginBottom: 'var(--space-6)'
        }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'bold',
            color: 'var(--dynamic-text-color)',
            marginBottom: 'var(--space-2)',
            fontFamily: 'var(--font-primary)'
          }}>
            Daily Licks
          </h2>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--dynamic-text-color)',
            opacity: 0.8,
            lineHeight: 1.5
          }}>
            {popupStage === 'initial' && 'Claim your free Licks.'}
            {popupStage === 'animating' && 'Rolling multiplier...'}
            {popupStage === 'result' && congratsWord}
          </p>
        </div>

        {/* Main Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)'
        }}>
          
          {/* Lick Icon */}
          <div style={{
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))'
          }}>
            <img
              src="/lick-icon.png"
              alt="Licks"
              style={{
                width: '64px',
                height: '64px'
              }}
            />
          </div>

          {/* Multiplier Display */}
          {popupStage !== 'initial' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'bold'
            }}>
              <span style={{ color: 'var(--dynamic-text-color)' }}>10</span>
              <span 
                ref={multiplierRef}
                style={{
                  color: 'var(--dynamic-accent-color)',
                  textShadow: popupStage === 'result' ? 
                    '0 0 16px var(--dynamic-accent-color)' : 
                    '0 0 12px var(--dynamic-accent-color)',
                  animation: popupStage === 'animating' ? 
                    'pulse 0.8s ease-in-out infinite' : 
                    popupStage === 'result' ? 'glow 2s ease-out forwards' : 'none'
                }}
              >
                ×{currentMultiplier}
              </span>
              <span style={{ color: 'var(--dynamic-text-color)' }}>
                = {popupStage === 'result' ? finalVotes : (10 * currentMultiplier)} Licks
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'center'
        }}>
          {popupStage === 'initial' && (
            <button
              onClick={handleClaim}
              style={{
                background: 'var(--dynamic-accent-color)',
                color: 'var(--dynamic-bg-color)',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                padding: 'var(--space-3) var(--space-6)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Roll for Multiplier
            </button>
          )}
          
          {popupStage === 'result' && (
            <button
              onClick={handleClose}
              style={{
                background: 'var(--dynamic-accent-color)',
                color: 'var(--dynamic-bg-color)',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                padding: 'var(--space-3) var(--space-6)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-primary)',
                animation: 'glow 2s ease-out infinite'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Claim {finalVotes} Licks
            </button>
          )}
        </div>

        {/* Footer Info */}
        <div style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-4)',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 'var(--border-radius-md)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--dynamic-text-color)',
          opacity: 0.7,
          lineHeight: 1.4
        }}>
          Come back daily and build your streak.
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        @keyframes glow {
          0% { 
            text-shadow: 0 0 12px var(--dynamic-accent-color);
            box-shadow: 0 0 12px var(--dynamic-accent-color);
          }
          50% { 
            text-shadow: 0 0 20px var(--dynamic-accent-color);
            box-shadow: 0 0 20px var(--dynamic-accent-color);
          }
          100% { 
            text-shadow: 0 0 16px var(--dynamic-accent-color);
            box-shadow: 0 0 16px var(--dynamic-accent-color);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
