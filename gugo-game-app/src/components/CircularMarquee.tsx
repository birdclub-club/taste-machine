"use client"

import React, { useMemo } from 'react';

interface CircularMarqueeProps {
  phrases: string[];
  prizeText?: string; // New prop for prize information
  isVisible: boolean;
  radius?: number;
  fontSize?: string;
  color?: string;
  duration?: number; // Animation duration in seconds
  type?: 'circular' | 'linear'; // New prop to choose marquee type
  width?: number; // For linear marquee width
  contained?: boolean; // New prop to make it contained within parent
}

export default function CircularMarquee({ 
  phrases, 
  prizeText,
  isVisible, 
  radius = 140, 
  fontSize = '1rem',
  color = 'var(--color-grey-400)',
  duration = 20,
  type = 'circular',
  width = 800,
  contained = false
}: CircularMarqueeProps) {
  // Get a random phrase from the array and memoize it to keep it consistent for the entire modal
  const randomPhrase = useMemo(() => {
    if (phrases.length === 0) return '';
    return phrases[Math.floor(Math.random() * phrases.length)];
  }, [phrases]); // Include phrases in dependency array

  if (!isVisible || phrases.length === 0) return null;
  
  // Create the text with prize info and phrases
  const baseText = prizeText ? `${prizeText} • ${randomPhrase}` : randomPhrase;
  
  if (type === 'linear') {
    // For linear marquee, repeat the same phrase many times for seamless infinite scroll
    // Use a separator with spaces to ensure proper spacing
    const separator = '     ';
    const repeatedText = Array(50).fill(randomPhrase).join(separator);
    
    return (
      <div style={{
        position: contained ? 'relative' : 'absolute',
        top: contained ? '0' : '325px', // Position under "YOU WON!" title, moved up 15px more
        left: contained ? '0' : '0',
        right: contained ? '0' : '0',
        width: contained ? `${width}px` : '100%',
        height: '50px',
        overflow: 'hidden', // This clips the text at edges
        pointerEvents: 'none',
        zIndex: 10,
        margin: contained ? '0 auto' : '0'
      }}>
        <svg
          width="600%" // Make SVG 6x wider for truly seamless scrolling
          height="50"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            animation: `scrollLeft ${duration}s linear infinite`
          }}
        >
          <defs>
            <path
              id="linearPath"
              d="M 0,25 L 6000,25" // Much longer horizontal line
            />
          </defs>
          <text
            fontSize={fontSize}
            fill={color}
            fontWeight="500"
            textAnchor="start"
            style={{
              textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
              fontFamily: 'var(--font-family-secondary)'
            }}
          >
            <textPath href="#linearPath" startOffset="0%">
              {repeatedText}
            </textPath>
          </text>
        </svg>
        
        <style jsx global>{`
          @keyframes scrollLeft {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-16.666%);
            }
          }
        `}</style>

      </div>
    );
  }
  
  // Circular marquee logic (existing)
  const repeatedText = Array(6).fill(baseText).join(' • ');
  const containerSize = radius * 2.5; // 25% larger than circle diameter
  
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -25%)',
      width: `${containerSize}px`,
      height: `${containerSize}px`,
      pointerEvents: 'none',
      zIndex: 10
    }}>
      <div 
        className="marquee-spinner"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          animation: `spin ${duration}s linear infinite`
        }}>
        <svg
          width={radius * 2}
          height={radius * 2}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <defs>
            <path
              id="circle"
              d={`M ${radius}, ${radius} m -${radius}, 0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 -${radius * 2},0`}
            />
          </defs>
          <text
            fontSize={fontSize}
            fill={color}
            fontWeight="500"
            textAnchor="start"
            style={{
              textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
              fontFamily: 'var(--font-family-secondary)'
            }}
          >
            <textPath href="#circle" startOffset="0%">
              {repeatedText}
            </textPath>
          </text>
        </svg>
      </div>
      
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}