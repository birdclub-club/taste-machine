"use client"

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';

/**
 * 🎨 Enhanced CSS Stability Guard
 * Prevents CSS from disappearing during wallet switching by ensuring
 * styles remain applied during React re-renders and hot reloads
 */
export default function CSSStabilityGuard() {
  const { isConnected, address, connector } = useAccount();
  const lastStateRef = useRef({ isConnected, address, connector: connector?.name });

  useEffect(() => {
    // Detect major wallet state changes
    const hasStateChanged = 
      lastStateRef.current.isConnected !== isConnected ||
      lastStateRef.current.address !== address ||
      lastStateRef.current.connector !== connector?.name;

    if (hasStateChanged) {
      console.log('🔄 Wallet state changed, ensuring CSS stability...', {
        from: lastStateRef.current,
        to: { isConnected, address: address?.slice(0, 8) + '...', connector: connector?.name }
      });
    }

    // Enhanced CSS stability check with force reload capability
    const ensureCSSStability = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Test multiple critical CSS properties
      const testProperties = [
        '--color-black',
        '--color-white', 
        '--color-green',
        '--space-4',
        '--font-family'
      ];
      
      let missingProperties = 0;
      const missingList: string[] = [];
      
      testProperties.forEach(prop => {
        const hasProperty = root.style.getPropertyValue(prop) || 
                           getComputedStyle(root).getPropertyValue(prop);
        if (!hasProperty) {
          missingProperties++;
          missingList.push(prop);
        }
      });

      if (missingProperties > 0) {
        console.warn(`🎨 ${missingProperties}/${testProperties.length} CSS variables missing:`, missingList);
        console.log('🔄 Attempting aggressive CSS recovery...');
        
        // AGGRESSIVE CSS RECOVERY
        body.classList.add('css-reload');
        
        // Step 1: Force complete style recalculation
        requestAnimationFrame(() => {
          // Temporarily hide to force recomputation
          body.style.visibility = 'hidden';
          body.style.display = 'none';
          body.offsetHeight; // Force reflow
          
          // Step 2: Re-inject critical properties directly
          root.style.setProperty('--color-black', '#000000');
          root.style.setProperty('--color-white', '#ffffff');
          root.style.setProperty('--color-green', '#22c55e');
          root.style.setProperty('--space-4', '1rem');
          root.style.setProperty('--font-family', 'Inter, system-ui, sans-serif');
          
          // Step 3: Restore visibility with delay
          setTimeout(() => {
            body.style.visibility = '';
            body.style.display = '';
            body.classList.remove('css-reload');
            console.log('✅ Aggressive CSS recovery completed');
            
            // Step 4: Verify recovery worked
            setTimeout(() => {
              const stillMissing = testProperties.filter(prop => 
                !root.style.getPropertyValue(prop) && !getComputedStyle(root).getPropertyValue(prop)
              );
              
              if (stillMissing.length === 0) {
                console.log('🎉 All CSS variables successfully restored!');
              } else {
                console.error('❌ CSS recovery failed for:', stillMissing);
                // Last resort: page reload
                console.log('🔄 Triggering page reload as last resort...');
                window.location.reload();
              }
            }, 100);
          }, 200);
        });
      }
    };

    // Immediate check
    ensureCSSStability();

    // Additional checks with delays to catch async issues
    const timeouts = [
      setTimeout(ensureCSSStability, 100),
      setTimeout(ensureCSSStability, 300),
      setTimeout(ensureCSSStability, 500)
    ];

    // Update last state
    lastStateRef.current = { isConnected, address, connector: connector?.name };

    return () => timeouts.forEach(clearTimeout);
  }, [isConnected, address, connector?.name]);

  useEffect(() => {
    // Enhanced debugging attributes
    const body = document.body;
    
    body.setAttribute('data-wallet-connected', isConnected.toString());
    body.setAttribute('data-wallet-address', address || 'none');
    body.setAttribute('data-wallet-connector', connector?.name || 'none');
    body.setAttribute('data-css-guard-active', 'true');
    body.setAttribute('data-css-guard-timestamp', Date.now().toString());

    // Add RainbowKit specific class for better styling
    if (isConnected) {
      body.classList.add('wallet-connected');
    } else {
      body.classList.remove('wallet-connected');
    }
  }, [isConnected, address, connector?.name]);

  // This component renders nothing but ensures CSS stability
  return null;
}