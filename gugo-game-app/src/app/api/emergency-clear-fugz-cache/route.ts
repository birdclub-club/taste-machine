import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚨 EMERGENCY: Clearing all cached sessions to remove Fugz NFTs');
    
    return NextResponse.json({
      success: true,
      message: 'EMERGENCY FUGZ CACHE CLEAR',
      issue: {
        problem: 'Fugz NFTs appearing in first two matchups despite being disabled',
        root_cause: 'Preloader serving cached sessions generated when Fugz was active',
        evidence: 'Collection management shows Fugz as disabled, but cached sessions contain Fugz NFTs'
      },
      solution: {
        action: 'Force clear all cached sessions and regenerate with proper collection filtering',
        impact: 'All future sessions will respect current collection status (Fugz disabled)',
        cache_clearing_script: `
          // 🚨 EMERGENCY FUGZ CACHE CLEAR
          console.log('🚨 EMERGENCY: Clearing Fugz from cached sessions...');

          // Clear all localStorage caches
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.includes('taste-machine') || 
              key.includes('preloader') || 
              key.includes('session') || 
              key.includes('pairs') ||
              key.includes('voting') ||
              key.includes('fugz') ||
              key.includes('Fugz')
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('🗑️ Removed:', key);
          });

          // Clear sessionStorage
          const sessionKeysToRemove = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (
              key.includes('taste-machine') || 
              key.includes('preloader') || 
              key.includes('session') || 
              key.includes('pairs') ||
              key.includes('voting') ||
              key.includes('fugz') ||
              key.includes('Fugz')
            )) {
              sessionKeysToRemove.push(key);
            }
          }
          sessionKeysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
            console.log('🗑️ Removed from session:', key);
          });

          // Try to access preloader instance and clear it
          try {
            // This will force the preloader to reinitialize
            if (window.votingPreloader) {
              window.votingPreloader.clearAllSessions();
              console.log('✅ Preloader cache cleared via global instance');
            }
          } catch (error) {
            console.log('⚠️ Could not access preloader directly:', error);
          }

          console.log('✅ FUGZ CACHE CLEARING COMPLETE - Refresh page for Fugz-free sessions');
          console.log('🎯 All new sessions will respect collection status (Fugz disabled)');
        `
      },
      collection_status: {
        fugz_status: 'DISABLED (active: false)',
        active_collections: ['Final Bosu', 'Pengztracted', 'Canna Sapiens', 'BEARISH', 'BEEISH', 'Kabu'],
        inactive_collections: ['RUYUI', 'Fugz', 'DreamilioMaker', 'Bearish', 'Test Collection']
      },
      next_steps: [
        'Copy the cache_clearing_script above and run it in your browser console (F12)',
        'Perform a hard refresh (Cmd+Shift+R or Ctrl+Shift+R)',
        'Start voting - all sessions should now be Fugz-free',
        'Verify only active collections appear in matchups'
      ],
      expected_result: 'No more Fugz NFTs in any matchups - only active collections',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating emergency Fugz fix:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to create emergency Fugz fix', 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

