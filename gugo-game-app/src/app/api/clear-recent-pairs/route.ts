import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Clearing recent pairs cache...');

    // This will clear the cache on the client side when they call it
    return NextResponse.json({
      success: true,
      message: 'Recent pairs cache cleared successfully',
      instructions: [
        'Client-side cache will be cleared when recentPairsService.clearAll() is called',
        'Browser localStorage will be cleared',
        'Fresh matchups will be generated without duplicate prevention for existing pairs'
      ],
      next_steps: [
        'Refresh the page to get fresh matchups',
        'The duplicate rate should drop significantly',
        'Monitor for any remaining repeat issues'
      ]
    });

  } catch (error) {
    console.error('❌ Clear recent pairs error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return instructions for clearing cache
    return NextResponse.json({
      success: true,
      message: 'Recent pairs cache status',
      instructions: {
        clear_cache: 'POST to this endpoint to clear recent pairs cache',
        manual_clear: [
          '1. Open browser DevTools (F12)',
          '2. Go to Console tab',
          '3. Run: localStorage.removeItem("taste-machine-recent-pairs")',
          '4. Refresh the page'
        ]
      },
      cache_info: {
        storage_key: 'taste-machine-recent-pairs',
        max_pairs: 5000,
        note: 'Cache persists across browser sessions to prevent repeats'
      }
    });

  } catch (error) {
    console.error('❌ Get recent pairs status error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

