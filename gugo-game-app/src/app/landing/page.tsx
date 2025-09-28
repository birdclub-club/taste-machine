'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TrailingImages from '@/components/TrailingImages';

// Color palettes (background, text)
const COLOR_PALETTES = [
  { bg: '#52454B', text: '#E8E2E3' }, // 1. Dark slate with light pink text
  { bg: '#B8A578', text: '#FFFFFF' }, // 2. Golden beige with white text
  { bg: '#D9D2A5', text: '#3A4572' }, // 3. Light cream with navy blue text
  { bg: '#444245', text: '#A79670' }, // 4. Charcoal with olive text
  { bg: '#4D4A41', text: '#CD5B4E' }, // 5. Dark brown with coral text
  { bg: '#81715F', text: '#C6C0BA' }, // 6. Taupe with light beige text
  { bg: '#B5874D', text: '#E2CE2B' }, // 7. Bronze with bright yellow text
  { bg: '#DDD094', text: '#3D4572' }, // 8. Pale yellow with navy text
  { bg: '#443532', text: '#688274' }, // 9. Dark moss with sage green text
  { bg: '#7A5C48', text: '#D3986F' }, // 10. Warm brown with golden text
  { bg: '#BF7C6F', text: '#3A1E13' }, // 11. Dusty rose with dark brown text
  { bg: '#1E3244', text: '#CBB26E' }, // 12. Dark blue with golden text
  { bg: '#FFFFFF', text: '#369397' }, // 13. White with teal text
  { bg: '#2B221F', text: '#BA9963' }, // 14. Dark brown with gold text
  { bg: '#2C2D31', text: '#7A7671' }, // 15. Charcoal with grey text
  { bg: '#46464F', text: '#FFFFFF' }, // 16. Dark grey with white text
  { bg: '#867041', text: '#FFFFFF' }, // 17. Olive brown with white text
  { bg: '#423D3A', text: '#BD8866' }, // 18. Dark brown with tan text
  { bg: '#30353F', text: '#9C9682' }, // 19. Dark slate with sage text
  { bg: '#524E48', text: '#BD746B' }, // 20. Brown grey with coral text
  { bg: '#D8D1AD', text: '#3F486E' }, // 21. Light cream with navy text
  { bg: '#534A4E', text: '#A78551' }, // 22. Dark mauve with gold text
  { bg: '#B69692', text: '#2C1D1A' }, // 23. Dusty pink with dark brown text
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
