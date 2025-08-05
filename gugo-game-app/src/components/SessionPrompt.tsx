"use client"

import React from 'react';

interface SessionPromptProps {
  isOpen: boolean;
  trigger: 'first-reward' | 'vote-purchase';
  onCreateSession: () => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
  isCreatingSession?: boolean;
}

export function SessionPrompt({ 
  isOpen, 
  trigger, 
  onCreateSession, 
  onSkip, 
  onClose,
  isCreatingSession = false 
}: SessionPromptProps) {
  if (!isOpen) return null;

  const content = {
    'first-reward': {
      title: 'You Earned a Reward!',
      subtitle: 'Start a secure session to claim it instantly—no wallet popups, no interruptions.',
      message: 'Why start a session?',
      benefits: [
        '🎁 Instantly claim all your rewards',
        '💫 Buy Licks without signing every time', 
        '⚡ Enjoy gasless transactions',
        '🚫 Skip the popup parade'
      ],
      primaryButton: 'Create Session & Claim Reward',
      secondaryButton: 'Skip Reward → Keep Voting',
      skipWarning: '⚠️ You\'ll miss this reward, but you can keep voting.',
      sessionDuration: 'Secure session valid for 2 hours.'
    },
    'vote-purchase': {
      title: '💫 Want Seamless Purchasing?',
      subtitle: 'Buy Licks instantly without signing each transaction',
      message: 'Why start a session?',
      benefits: [
        '💫 Buy Licks without signing every time',
        '🎁 Instantly claim future rewards', 
        '⚡ Enjoy gasless transactions',
        '🚫 Skip the popup parade'
      ],
      primaryButton: 'Create Session',
      secondaryButton: 'Continue with Signatures',
      skipWarning: 'You can still purchase, but will need to sign each transaction',
      sessionDuration: 'Secure session valid for 2 hours.'
    }
  };

  const config = content[trigger];

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
      zIndex: 1100,
      padding: 'var(--space-4)'
    }}>
      <div style={{
        background: 'var(--color-black)',
        border: '2px solid var(--color-green)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            color: 'var(--color-grey-400)',
            fontSize: 'var(--font-size-xl)',
            cursor: 'pointer',
            padding: 'var(--space-2)',
            borderRadius: 'var(--border-radius-sm)',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-white)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-grey-400)';
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            color: 'var(--color-green)',
            fontSize: 'var(--font-size-2xl)',
            fontWeight: '800',
            margin: '0 0 var(--space-2) 0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {config.title}
          </h2>
          
          <p style={{
            color: 'var(--color-grey-300)',
            fontSize: 'var(--font-size-base)',
            fontWeight: '600',
            margin: '0 0 var(--space-4) 0'
          }}>
            {config.subtitle}
          </p>
          
          <p style={{
            color: 'var(--color-white)',
            fontSize: 'var(--font-size-base)',
            fontWeight: '600',
            lineHeight: '1.6',
            margin: 0
          }}>
            {config.message}
          </p>
        </div>

        {/* Benefits List */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 'var(--border-radius)',
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)'
        }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            {config.benefits.map((benefit, index) => (
              <div 
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  color: 'var(--color-white)',
                  fontSize: 'var(--font-size-base)',
                  marginBottom: 'var(--space-2)'
                }}
              >
                <span style={{ color: 'var(--color-green)' }}>✓</span>
                {benefit}
              </div>
            ))}
          </div>
          
          <div style={{
            color: 'var(--color-grey-400)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: '500',
            textAlign: 'center',
            borderTop: '1px solid #333',
            paddingTop: 'var(--space-3)'
          }}>
            {config.sessionDuration}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexDirection: 'column'
        }}>
          {/* Primary Action */}
          <button
            onClick={onCreateSession}
            disabled={isCreatingSession}
            style={{
              padding: 'var(--space-4)',
              background: isCreatingSession ? '#16a34a' : 'var(--color-green)',
              border: '2px solid var(--color-green)',
              borderRadius: 'var(--border-radius)',
              cursor: isCreatingSession ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: '700',
              color: 'var(--color-black)',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              opacity: isCreatingSession ? 0.8 : 1
            }}
            onMouseEnter={(e) => {
              if (!isCreatingSession) {
                e.currentTarget.style.background = '#16a34a';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreatingSession) {
                e.currentTarget.style.background = 'var(--color-green)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
              }
            }}
          >
            {isCreatingSession ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid var(--color-black)',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Creating Session...
              </div>
            ) : (
              config.primaryButton
            )}
          </button>

          {/* Secondary Action */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={onSkip}
              disabled={isCreatingSession}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: 'transparent',
                border: '1px solid #444',
                borderRadius: 'var(--border-radius)',
                cursor: isCreatingSession ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-grey-400)',
                transition: 'all 0.2s ease',
                opacity: isCreatingSession ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isCreatingSession) {
                  e.currentTarget.style.color = 'var(--color-white)';
                  e.currentTarget.style.borderColor = '#666';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCreatingSession) {
                  e.currentTarget.style.color = 'var(--color-grey-400)';
                  e.currentTarget.style.borderColor = '#444';
                }
              }}
            >
              {config.secondaryButton}
            </button>
            
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-grey-500)',
              marginTop: 'var(--space-2)',
              lineHeight: '1.4'
            }}>
              {config.skipWarning}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}