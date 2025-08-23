import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Force clearing all caches...');

    // This endpoint will provide instructions to clear all caches
    return NextResponse.json({
      success: true,
      message: 'Cache clear instructions provided',
      immediate_actions: {
        browser_storage: [
          'localStorage.clear()',
          'sessionStorage.clear()',
          'location.reload()'
        ],
        specific_keys: [
          'localStorage.removeItem("taste-machine-recent-pairs")',
          'localStorage.removeItem("voting-preloader-cache")',
          'localStorage.removeItem("matchup-cache")'
        ]
      },
      script_to_run: `
// Copy and paste this entire block into browser console:
console.log('🧹 Clearing Taste Machine caches...');
localStorage.removeItem('taste-machine-recent-pairs');
localStorage.removeItem('voting-preloader-cache');
localStorage.removeItem('matchup-cache');
Object.keys(localStorage).forEach(key => {
  if (key.includes('taste-machine') || key.includes('voting') || key.includes('matchup')) {
    localStorage.removeItem(key);
    console.log('Removed:', key);
  }
});
console.log('✅ Cache cleared! Refreshing page...');
location.reload();
      `,
      manual_steps: [
        '1. Open DevTools (F12)',
        '2. Go to Application tab',
        '3. Click Storage → Clear storage',
        '4. Click "Clear site data"',
        '5. Refresh the page'
      ]
    });

  } catch (error) {
    console.error('❌ Force clear cache error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

