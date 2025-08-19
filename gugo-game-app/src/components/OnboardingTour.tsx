"use client"

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Taste Machine',
    content: 'You\'re now contributing to a verifiable, on-chain aesthetic score for NFTs.',
    target: 'body', // Center of screen
    position: 'bottom'
  },
  {
    id: 'matchup-area',
    title: 'Smart NFT Selection',
    content: 'Each NFT you see is picked by smart logic to help us learn the most from your vote.\nYou might see repeats, cross-collection matchups, or single images — it\'s all part of the signal-building process.',
    target: '.matchup-card',
    position: 'right'
  },
  {
    id: 'xp-area',
    title: 'Earn XP & Rewards',
    content: 'Every vote earns you XP and rewards.\nThe more you vote, the better it gets.\nLevel up to earn badges, perks, and NFTs.',
    target: '[data-tour="xp-area"]',
    position: 'bottom'
  },
  {
    id: 'licks-area',
    title: 'Daily Free Licks',
    content: 'You get 10 free Licks every day — with guaranteed rewards every 10 to 20 votes.\nCome back daily to build streaks and unlock even more.',
    target: '[data-tour="licks-area"]',
    position: 'bottom'
  },
  {
    id: 'leaderboard',
    title: 'Track Performance',
    content: 'Track the NFTs getting the most love — and the users making the biggest impact.',
    target: '[data-tour="leaderboard"]',
    position: 'bottom'
  },
  {
    id: 'fire-list',
    title: 'Your Favorites',
    content: 'Your personal list of favorites.\nSee prices, track performance, and make offers on what you love.',
    target: '[data-tour="fire-list"]',
    position: 'bottom'
  }
];

export default function OnboardingTour({ isOpen, onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

  const currentTourStep = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Find target element and calculate popup position
  useEffect(() => {
    if (!isOpen || !currentTourStep) return;

    const findTarget = () => {
      const element = document.querySelector(currentTourStep.target) as HTMLElement;
      if (element) {
        setTargetElement(element);
        
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        let top = 0;
        let left = 0;
        
        // Special positioning for welcome step - center on screen
        if (currentTourStep.id === 'welcome') {
          top = window.innerHeight / 2 + scrollTop;
          left = window.innerWidth / 2 + scrollLeft;
        }
        // Special positioning for matchup area - place popup to the right
        else if (currentTourStep.id === 'matchup-area') {
          top = rect.top + scrollTop + (rect.height / 2);
          left = rect.right + scrollLeft + 30;
          
          // Check if popup would go off-screen to the right
          const popupWidth = 320; // maxWidth from popup styles
          if (left + popupWidth > window.innerWidth) {
            // Place to the left instead
            left = rect.left + scrollLeft - popupWidth - 30;
          }
        } else {
          switch (currentTourStep.position) {
            case 'bottom':
              top = rect.bottom + scrollTop + 20;
              left = rect.left + scrollLeft + (rect.width / 2);
              break;
            case 'top':
              top = rect.top + scrollTop - 20;
              left = rect.left + scrollLeft + (rect.width / 2);
              break;
            case 'left':
              top = rect.top + scrollTop + (rect.height / 2);
              left = rect.left + scrollLeft - 20;
              break;
            case 'right':
              top = rect.top + scrollTop + (rect.height / 2);
              left = rect.right + scrollLeft + 30;
              break;
          }
        }
        
        setPopupPosition({ top, left });
      }
    };

    // Try to find element immediately
    findTarget();
    
    // If not found, try again after a short delay (for dynamic content)
    const timeout = setTimeout(findTarget, 100);
    
    return () => clearTimeout(timeout);
  }, [isOpen, currentStep, currentTourStep]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!isOpen || !currentTourStep) return null;

  return createPortal(
    <>
      {/* Welcome step - full overlay without spotlight */}
      {currentTourStep.id === 'welcome' ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 100000,
          pointerEvents: 'none'
        }} />
      ) : (
        /* Spotlight overlay effect for other steps */
        targetElement && (
        <>
          {/* Calculate dimensions for spotlight */}
          {(() => {
            const rect = targetElement.getBoundingClientRect();
            const padding = currentTourStep.id === 'matchup-area' ? 12 : 12;
            const topPadding = currentTourStep.id === 'matchup-area' ? 52 : 12; // 40px extra on top
            const highlightTop = rect.top - topPadding;
            const highlightLeft = rect.left - padding;
            const highlightWidth = rect.width + (padding * 2);
            const highlightHeight = rect.height + topPadding + padding;
            
            return (
              <>
                {/* Top overlay */}
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${highlightTop}px`,
                  background: 'rgba(0, 0, 0, 0.6)',
                  zIndex: 100000,
                  pointerEvents: 'none'
                }} />
                
                {/* Bottom overlay */}
                <div style={{
                  position: 'fixed',
                  top: `${highlightTop + highlightHeight}px`,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.6)',
                  zIndex: 100000,
                  pointerEvents: 'none'
                }} />
                
                {/* Left overlay */}
                <div style={{
                  position: 'fixed',
                  top: `${highlightTop}px`,
                  left: 0,
                  width: `${highlightLeft}px`,
                  height: `${highlightHeight}px`,
                  background: 'rgba(0, 0, 0, 0.6)',
                  zIndex: 100000,
                  pointerEvents: 'none'
                }} />
                
                {/* Right overlay */}
                <div style={{
                  position: 'fixed',
                  top: `${highlightTop}px`,
                  left: `${highlightLeft + highlightWidth}px`,
                  right: 0,
                  height: `${highlightHeight}px`,
                  background: 'rgba(0, 0, 0, 0.6)',
                  zIndex: 100000,
                  pointerEvents: 'none'
                }} />
                

                
                {/* Highlight border for target element */}
                <div style={{
                  position: 'absolute',
                  top: targetElement.getBoundingClientRect().top + window.pageYOffset - topPadding,
                  left: targetElement.getBoundingClientRect().left + window.pageXOffset - padding,
                  width: targetElement.getBoundingClientRect().width + (padding * 2),
                  height: targetElement.getBoundingClientRect().height + topPadding + padding,
                  border: '3px solid var(--dynamic-accent-color, #22c55e)',
                  borderRadius: '16px',
                  boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.2)',
                  zIndex: 100001,
                  pointerEvents: 'none',
                  animation: 'tour-pulse 2s ease-in-out infinite'
                }} />
              </>
            );
          })()}
        </>
        )
      )}
      
      {/* Tour Popup */}
      <div style={{
        position: 'absolute',
        top: popupPosition.top,
        left: popupPosition.left,
        transform: currentTourStep.id === 'welcome' ? 'translate(-50%, -50%)' : 
                   currentTourStep.id === 'matchup-area' ? 'translateY(-50%)' : 'translateX(-50%)',
        background: 'var(--dynamic-bg-color, #1a1a1a)',
        border: '2px solid var(--dynamic-text-color, #ffffff)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '320px',
        minWidth: '280px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        zIndex: 100003,
        pointerEvents: 'auto'
      }}>
        {/* Close button */}
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: 'var(--dynamic-text-color, #ffffff)',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            opacity: 0.7,
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          ×
        </button>

        {/* Content */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            color: 'var(--dynamic-text-color, #ffffff)',
            fontSize: '18px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            lineHeight: '1.3'
          }}>
            {currentTourStep.title}
          </h3>
          
          <p style={{
            color: 'var(--dynamic-text-color, #ffffff)',
            fontSize: '14px',
            lineHeight: '1.5',
            margin: 0,
            opacity: 0.9,
            whiteSpace: 'pre-line'
          }}>
            {currentTourStep.content}
          </p>
        </div>

        {/* Progress dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}>
          {TOUR_STEPS.map((_, index) => (
            <div
              key={index}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: index === currentStep 
                  ? 'var(--dynamic-accent-color, #22c55e)' 
                  : 'var(--dynamic-text-color, rgba(255, 255, 255, 0.3))',
                opacity: index === currentStep ? 1 : 0.3,
                transition: 'background 0.3s ease, opacity 0.3s ease'
              }}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            style={{
              background: 'none',
              border: '1px solid var(--dynamic-text-color, #ffffff)',
              color: 'var(--dynamic-text-color, #ffffff)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            Previous
          </button>

          <span style={{
            color: 'var(--dynamic-text-color, #ffffff)',
            fontSize: '14px',
            opacity: 0.7
          }}>
            {currentStep + 1} of {TOUR_STEPS.length}
          </span>

          <button
            onClick={handleNext}
            style={{
              background: 'var(--dynamic-text-color, #ffffff)',
              border: 'none',
              color: 'var(--dynamic-bg-color, #000000)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes tour-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.4);
          }
        }
      `}</style>
    </>,
    document.body
  );
}
