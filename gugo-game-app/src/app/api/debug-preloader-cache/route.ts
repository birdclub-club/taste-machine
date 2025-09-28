import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging preloader cache for repeat matchups...');

    // This endpoint will help us understand what's in the preloader cache
    // and if it's causing repeat matchups

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analysis: {
        message: "Preloader cache analysis - this would require access to the VotingPreloader instance",
        recommendations: [
          "Clear preloader cache to force fresh matchup generation",
          "Check if preloader is using recent pairs tracking",
          "Verify enhanced matchup engine is being used consistently"
        ]
      },
      instructions: {
        clear_cache_steps: [
          "1. Go to browser DevTools > Application > Local Storage",
          "2. Clear all taste-machine related storage",
          "3. Refresh the page to force fresh matchup generation",
          "4. Test if repeat matchups still occur"
        ],
        force_reset_api: "Call POST /api/force-reset-preloader to clear server-side cache"
      }
    });

  } catch (error) {
    console.error('❌ Preloader debug error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'force_reset') {
      // This would force reset the preloader cache
      // For now, we'll just return instructions
      
      return NextResponse.json({
        success: true,
        message: "Preloader reset instructions provided",
        instructions: [
          "Clear browser local storage and refresh page",
          "This will force the preloader to regenerate all cached matchups",
          "New matchups should respect recent pairs tracking"
        ]
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown action. Use {"action": "force_reset"} to reset preloader.'
    });

  } catch (error) {
    console.error('❌ Preloader reset error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

