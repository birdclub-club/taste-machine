import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Providing comprehensive cache clearing instructions...');

    // JavaScript to clear all browser caches
    const clearCacheScript = `
// 🧹 COMPREHENSIVE CACHE CLEAR FOR TASTE MACHINE
console.log('🧹 Starting comprehensive cache clear...');

// Clear all localStorage
Object.keys(localStorage).forEach(key => {
  if (key.includes('taste') || key.includes('voting') || key.includes('nft') || key.includes('pairs')) {
    console.log('🗑️ Clearing:', key);
    localStorage.removeItem(key);
  }
});

// Clear specific known keys
const keysToRemove = [
  'taste-machine-recent-pairs',
  'recent-pairs-fast',
  'voting-preloader-cache',
  'nft-duplicate-tracking',
  'matchup-history',
  'session-cache'
];

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  console.log('🗑️ Removed:', key);
});

// Clear sessionStorage
sessionStorage.clear();
console.log('🗑️ SessionStorage cleared');

// Force reload preloader
if (window.votingPreloader) {
  window.votingPreloader.clearAllSessions();
  console.log('🔄 Preloader cache cleared');
}

console.log('✅ Cache clear complete! Refresh the page now.');
console.log('🎯 Next votes should show much more variety!');
`;

    return NextResponse.json({
      success: true,
      message: 'Cache clearing script ready',
      
      instructions: {
        step_1: 'Copy the JavaScript code below',
        step_2: 'Open browser console (F12 → Console tab)',
        step_3: 'Paste and press Enter',
        step_4: 'Refresh the page completely',
        step_5: 'Start voting - should see immediate improvement'
      },
      
      javascript_code: clearCacheScript,
      
      alternative_method: {
        description: 'Manual browser refresh',
        steps: [
          'Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) for hard refresh',
          'Or go to Developer Tools → Application → Storage → Clear All',
          'Or use Incognito/Private browsing mode for clean slate'
        ]
      },
      
      what_to_expect: {
        immediate: [
          'Console logs: "EMERGENCY CACHE CLEAR" messages',
          'Console logs: "COLD START SESSION" every 4th vote',
          'Console logs: "Discovery Status" with zero-vote NFT counts'
        ],
        improvement: [
          'Much more variety in NFT pairs',
          'Fewer exact duplicate matchups',
          'More zero-vote NFTs appearing',
          'Progressive Discovery System active'
        ]
      },
      
      if_still_duplicates: [
        'The issue may be in the enhanced algorithm itself',
        'Database may have limited variety in active collections',
        'May need to adjust algorithm weights further'
      ]
    });

  } catch (error) {
    console.error('❌ Cache clear script error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

