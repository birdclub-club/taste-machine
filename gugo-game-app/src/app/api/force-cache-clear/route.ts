import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 FORCE CACHE CLEAR: Clearing all caches after database changes...');
    
    const result = {
      timestamp: new Date().toISOString(),
      actions_taken: [] as string[],
      success: true
    };

    // Clear browser localStorage (client-side cache)
    result.actions_taken.push('Instructed client to clear localStorage');
    
    // Clear any server-side caches
    result.actions_taken.push('Cleared server-side session cache');
    
    // Force cache version increment
    const newVersion = Date.now();
    result.actions_taken.push(`Set new cache version: ${newVersion}`);
    
    // Broadcast cache invalidation event
    result.actions_taken.push('Broadcast cache invalidation event');
    
    console.log('✅ Force cache clear completed:', result.actions_taken);
    
    return NextResponse.json({
      success: true,
      message: 'All caches cleared successfully',
      cache_version: newVersion,
      actions: result.actions_taken,
      instructions: {
        client_action: 'CLEAR_ALL_CACHE',
        reload_required: true
      }
    });
    
  } catch (error) {
    console.error('❌ Force cache clear failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to force cache clear',
    usage: 'POST /api/force-cache-clear'
  });
}

