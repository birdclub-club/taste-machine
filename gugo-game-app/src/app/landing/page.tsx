'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TrailingImages from '@/components/TrailingImages';

// Color palettes (background, text)
const COLOR_PALETTES = [
  { bg: '#C8A784', text: '#E55C26' }, // 1. Original
  { bg: '#52454B', text: '#E8E2E3' }, // 2.
  { bg: '#B8A578', text: '#FFFFFF' }, // 3.
  { bg: '#D9D2A5', text: '#3A4572' }, // 4.
  { bg: '#444245', text: '#A79670' }, // 5.
  { bg: '#4D4A41', text: '#CD5B4E' }, // 6.
  { bg: '#81715F', text: '#C6C0BA' }, // 7.
  { bg: '#B5874D', text: '#E2CE2B' }, // 8.
  { bg: '#DDD094', text: '#3D4572' }, // 9.
  { bg: '#443532', text: '#688274' }, // 10.
  { bg: '#7A5C48', text: '#D3986F' }, // 11. New - Warm brown with golden text
  { bg: '#BF7C6F', text: '#3A1E13' }, // 12. New - Dusty rose with dark brown text
  { bg: '#1E3244', text: '#CBB26E' }, // 13. New - Dark blue with golden text
  { bg: '#201639', text: '#B5B28E' }, // 14. New - Deep purple with sage text
  { bg: '#BF588A', text: '#FFFFFF' }, // 15. New - Magenta with white text
];

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [colorPalette, setColorPalette] = useState(COLOR_PALETTES[0]);
  const [isExiting, setIsExiting] = useState(false);

  // Function to darken a hex color
  const darkenColor = (hex: string, percent: number) => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Darken by reducing each component
    const darkenedR = Math.floor(r * (1 - percent / 100));
    const darkenedG = Math.floor(g * (1 - percent / 100));
    const darkenedB = Math.floor(b * (1 - percent / 100));
    
    // Convert back to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(darkenedR)}${toHex(darkenedG)}${toHex(darkenedB)}`;
  };

  useEffect(() => {
    // Select random color palette on mount
    const randomIndex = Math.floor(Math.random() * COLOR_PALETTES.length);
    const selectedPalette = COLOR_PALETTES[randomIndex];
    setColorPalette(selectedPalette);
    
    // Create darker version of background color
    const darkerBg = darkenColor(selectedPalette.bg, 30); // 30% darker
    
    // Set global CSS variables for the main app
    document.documentElement.style.setProperty('--dynamic-bg-color', selectedPalette.bg);
    document.documentElement.style.setProperty('--dynamic-bg-color-dark', darkerBg);
    document.documentElement.style.setProperty('--dynamic-text-color', selectedPalette.text);
    document.documentElement.style.setProperty('--dynamic-accent-color', selectedPalette.text);
    
    setMounted(true);
  }, []);

  const handleEnter = () => {
    // Mark that user has visited landing page to prevent redirect loops
    sessionStorage.setItem('visited-landing', 'true');
    
    // Trigger exit animation
    setIsExiting(true);
    
    // Navigate earlier to allow main page to start sliding in sooner
    setTimeout(() => {
      router.push('/');
    }, 300); // Start main page while landing is still sliding out
  };

  if (!mounted) {
    return null;
  }

  return (
    <div 
      className={`landing-container ${isExiting ? 'exiting' : ''}`}
      style={{
        backgroundColor: colorPalette.bg,
        '--landing-text-color': colorPalette.text,
        '--landing-border-color': `${colorPalette.text}30`, // 30 = ~18% opacity
        '--landing-border-hover': `${colorPalette.text}60`, // 60 = ~37% opacity
        '--landing-bg-hover': `${colorPalette.text}0D`, // 0D = ~5% opacity
        transform: isExiting ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      } as React.CSSProperties & { [key: string]: string }}
    >
      {/* TASTE - Top Left */}
      <div className="landing-text landing-taste">
        TASTE
      </div>
      
      {/* MACHINE - Bottom Right */}
      <div className="landing-text landing-machine">
        MACHINE
      </div>

      {/* Subtle Enter Button */}
      <button 
        onClick={handleEnter}
        className="landing-enter-btn"
        aria-label="Enter Taste Machine"
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5"
        >
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>

      {/* Optional: Click anywhere to enter */}
      <div 
        className="landing-overlay"
        onClick={handleEnter}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleEnter();
          }
        }}
        aria-label="Click anywhere to enter"
      />

      {/* Trailing NFT Images Effect */}
      <TrailingImages />
    </div>
  );
}
