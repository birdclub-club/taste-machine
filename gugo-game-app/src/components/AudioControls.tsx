"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMusic } from '@/contexts/MusicContext';

interface AudioControlsProps {
  className?: string;
}

export default function AudioControls({ className = '' }: AudioControlsProps) {
  const {
    isPlaying,
    volume,
    volumePercentage,
    isMuted,
    hasStarted,
    togglePlayback,
    setVolume,
    toggleMute
  } = useMusic();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only show controls after music has started
  if (!hasStarted) {
    return null;
  }

  if (!mounted) {
    return null;
  }
  
  const controlsElement = (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      zIndex: 99999,
      pointerEvents: 'auto',
      backgroundColor: 'var(--dynamic-text-color, rgba(255, 255, 255, 0.9))',
      border: 'none',
      padding: '8px',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(10px)'
    }}>
      
      {/* Play/Pause Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePlayback();
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--dynamic-bg-color, var(--color-black))',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={isPlaying ? 'Pause Music' : 'Play Music'}
      >
        {isPlaying ? (
          // Pause icon (two vertical bars)
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3" height="12" />
            <rect x="10" y="2" width="3" height="12" />
          </svg>
        ) : (
          // Play icon (triangle)
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <polygon points="4,2 4,14 13,8" />
          </svg>
        )}
      </button>

      {/* Volume Control */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        {/* Volume Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--dynamic-bg-color, var(--color-black))',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={isMuted ? 'Unmute' : `Volume: ${volumePercentage}%`}
        >
          {isMuted ? (
            // Muted icon (speaker with X)
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
              <path d="m9 5.5 3 3m0-3-3 3"/>
            </svg>
          ) : volume < 0.5 ? (
            // Low volume icon
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
              <path d="M9 8a2.5 2.5 0 0 1 0-4V3a3.5 3.5 0 0 1 0 10V9z"/>
            </svg>
          ) : (
            // High volume icon
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
              <path d="M9 8a2.5 2.5 0 0 1 0-4V3a3.5 3.5 0 0 1 0 10V9z"/>
              <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
            </svg>
          )}
        </button>

        {/* Volume Slider */}
        {showVolumeSlider && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            backgroundColor: 'var(--dynamic-text-color, rgba(255, 255, 255, 0.9))',
            padding: '8px',
            borderRadius: '4px',
            border: 'none',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            minWidth: '32px',
            zIndex: 1000
          }}>
            {/* Volume Percentage */}
            <span style={{
              fontSize: '10px',
              color: 'var(--dynamic-bg-color, var(--color-black))',
              fontWeight: '600'
            }}>
              {volumePercentage}%
            </span>
            
            {/* Vertical Volume Slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={volumePercentage}
              onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                width: '16px',
                height: '60px',
                background: 'rgba(255, 255, 255, 0.2)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(controlsElement, document.body);
}
