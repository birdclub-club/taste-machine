import { NextResponse } from 'next/server';
import { votingPreloader } from '../../../../lib/preloader';

export async function POST() {
  try {
    console.log('🧹 API: Clearing preloader cache...');
    
    // Force clear and regenerate all cached sessions
    votingPreloader.forceClearAndRegenerate();
    
    return NextResponse.json({
      success: true,
      message: 'Preloader cache cleared and regenerating with updated filtering',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing preloader cache:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to clear preloader cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to clear preloader cache',
    info: 'This endpoint clears all cached voting sessions and regenerates them with current filtering rules'
  });
}

