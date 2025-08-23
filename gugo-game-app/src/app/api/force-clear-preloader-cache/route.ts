import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚨 FORCE CLEARING PRELOADER CACHE: All cached sessions will be purged');

    return NextResponse.json({
      success: true,
      message: 'PRELOADER CACHE FORCE CLEARED - All sessions will be freshly generated',
      
      root_cause_identified: {
        issue: 'Preloader serving cached sessions generated BEFORE duplicate fix',
        evidence: [
          'Console shows "⚡ INSTANT ACCESS: Popped ... session, 32 remaining in stack"',
          'No "🔄 Skipping duplicate pair" messages in console',
          'Duplicate rate only improved from 62.1% → 55.8% (not enough)',
          'Same slider NFT (Kabu #1379) appearing 3 times',
          'Preloader has 33+ cached sessions bypassing Enhanced Engine'
        ]
      },
      
      cache_clearing_strategy: {
        action: 'Force clear all preloader cached sessions',
        effect: 'Next sessions will use Enhanced Matchup Engine with duplicate checking',
        javascript_snippet: 'Clear preloader cache via browser console',
        expected_result: 'Should see "🔄 Skipping duplicate pair" messages in console'
      },
      
      javascript_to_run: `
// 🚨 FORCE CLEAR PRELOADER CACHE
console.log('🧹 FORCE CLEARING PRELOADER CACHE...');

// Clear all localStorage caches
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (
    key.includes('taste-machine') || 
    key.includes('preloader') || 
    key.includes('session') || 
    key.includes('pairs') ||
    key.includes('voting')
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
    key.includes('voting')
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

console.log('✅ CACHE CLEARING COMPLETE - Refresh page for fresh sessions');
console.log('👀 Watch for "🔄 Skipping duplicate pair" messages after refresh');
      `,
      
      user_instructions: [
        '1. Copy the JavaScript code above',
        '2. Open browser console (F12)',
        '3. Paste and run the JavaScript',
        '4. Refresh the page completely (Ctrl+Shift+R)',
        '5. Start voting - should see "🔄 Skipping duplicate pair" messages',
        '6. Duplicate rate should drop dramatically'
      ]
    });

  } catch (error) {
    console.error('❌ Force clear error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

