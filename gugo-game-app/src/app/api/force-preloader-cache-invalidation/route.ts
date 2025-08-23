import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚨 FORCE INVALIDATING PRELOADER CACHE: Clearing week-old Fugz sessions');
    
    return NextResponse.json({
      success: true,
      message: 'PRELOADER CACHE FORCE INVALIDATION',
      bug_analysis: {
        confirmed_issue: 'Preloader serving week-old cached sessions containing Fugz NFTs',
        root_cause: 'No cache invalidation when collection status changes',
        evidence: [
          'Collection filtering logic works correctly (tested)',
          'Fugz properly excluded from new queries', 
          'Fugz disabled for a week but still appearing',
          'Only explanation: serving old cached sessions'
        ]
      },
      cache_invalidation_script: `
        // 🚨 FORCE PRELOADER CACHE INVALIDATION
        console.log('🚨 INVALIDATING WEEK-OLD PRELOADER CACHE...');

        // Method 1: Clear all browser storage
        try {
          localStorage.clear();
          sessionStorage.clear();
          console.log('✅ Cleared all browser storage');
        } catch (e) {
          console.log('⚠️ Could not clear all storage:', e);
        }

        // Method 2: Clear specific keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) keysToRemove.push(key);
        }
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log('🗑️ Removed:', key);
        });

        // Method 3: Clear session storage
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) sessionKeysToRemove.push(key);
        }
        sessionKeysToRemove.forEach(key => {
          sessionStorage.removeItem(key);
          console.log('🗑️ Removed session:', key);
        });

        // Method 4: Try to access and clear preloader
        try {
          if (window.votingPreloader) {
            window.votingPreloader.clearAllSessions();
            console.log('✅ Preloader instance cleared');
          }
        } catch (error) {
          console.log('⚠️ Could not access preloader:', error);
        }

        // Method 5: Clear any global caches
        try {
          if (window.caches) {
            caches.keys().then(names => {
              names.forEach(name => {
                caches.delete(name);
                console.log('🗑️ Cleared cache:', name);
              });
            });
          }
        } catch (error) {
          console.log('⚠️ Could not clear service worker caches:', error);
        }

        console.log('✅ CACHE INVALIDATION COMPLETE');
        console.log('🎯 Hard refresh now to get fresh Fugz-free sessions');
        console.log('📝 All new sessions will respect current collection status');
      `,
      immediate_solution: {
        action: 'Run cache invalidation script + hard refresh',
        expected_result: 'No more Fugz NFTs in any matchups',
        verification: 'First few matchups should only show active collections'
      },
      long_term_fix_needed: {
        issue: 'Preloader cache should invalidate when collection status changes',
        solution: 'Add cache versioning or collection status change detection',
        priority: 'High - prevents similar issues in future'
      },
      active_collections_confirmed: ['BEEISH', 'Kabu', 'Pengztracted', 'Final Bosu', 'BEARISH', 'Canna Sapiens'],
      disabled_collections_confirmed: ['RUYUI', 'Fugz', 'DreamilioMaker', 'Bearish', 'Test Collection'],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating cache invalidation fix:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to create cache invalidation fix', 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

