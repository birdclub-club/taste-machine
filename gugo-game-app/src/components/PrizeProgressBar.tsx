"use client"

import { useState, useEffect } from 'react';
import { getPrizeBreakThreshold } from '@/lib/prize-break-utils';

interface PrizeProgressBarProps {
  currentVotes: number;
  userXP: number;
  className?: string;
}

export default function PrizeProgressBar({ currentVotes, userXP, className = '' }: PrizeProgressBarProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  const threshold = getPrizeBreakThreshold(userXP);
  const votesInCurrentCycle = currentVotes % threshold;
  const progress = (votesInCurrentCycle / threshold) * 100;
  
  // Smooth animation for progress changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [progress]);
  
  // Color progression based on progress
  const getProgressColor = (progress: number): string => {
    if (progress < 30) return '#4a5568'; // Dark gray
    if (progress < 60) return '#2d3748'; // Medium gray  
    if (progress < 80) return '#1a202c'; // Darker
    return '#00ff88'; // Accent green when close
  };
  
  // Glow intensity based on progress
  const getGlowIntensity = (progress: number): number => {
    if (progress < 50) return 0;
    if (progress < 80) return 0.3;
    return 0.8; // Strong glow when close
  };
  
  const progressColor = getProgressColor(animatedProgress);
  const glowIntensity = getGlowIntensity(animatedProgress);
  
  return (
    <div className={`prize-progress-container ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      opacity: 0.8
    }}>
      {/* Progress Bar */}
      <div style={{
        width: '120px',
        height: '4px',
        backgroundColor: 'var(--dynamic-text-color)',
        borderRadius: '2px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: glowIntensity > 0 ? `0 0 ${8 * glowIntensity}px ${progressColor}40` : 'none'
      }}>
        {/* Progress Fill */}
        <div style={{
          width: `${animatedProgress}%`,
          height: '100%',
          backgroundColor: progressColor,
          borderRadius: '2px',
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: glowIntensity > 0 ? `0 0 ${12 * glowIntensity}px ${progressColor}60` : 'none',
          position: 'relative'
        }}>
          {/* Shimmer effect when close to completion */}
          {animatedProgress > 70 && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
              animation: 'shimmer 2s infinite',
              borderRadius: '2px'
            }} />
          )}
        </div>
      </div>
      
      {/* Vote Counter (Subtle) */}
      <span style={{
        fontSize: '14px',
        color: 'var(--dynamic-text-color, #666)',
        fontWeight: '600',
        minWidth: '40px',
        textAlign: 'right'
      }}>
        {votesInCurrentCycle}/{threshold}
      </span>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .prize-progress-container:hover {
          opacity: 1;
          transition: opacity 0.2s ease;
        }
      `}</style>
    </div>
  );
}

// Note: Helper functions are now imported from @/lib/prize-break-utils
