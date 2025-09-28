import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { enable = true, computation = true, display = false } = await request.json();
    
    // For development, we can temporarily set environment variables
    // In production, these should be set via proper environment configuration
    
    if (enable) {
      process.env.NEXT_PUBLIC_POA_V2_ENABLED = 'true';
    }
    
    if (computation) {
      process.env.NEXT_PUBLIC_POA_V2_COMPUTATION = 'true';
    }
    
    if (display) {
      process.env.NEXT_PUBLIC_POA_V2_DISPLAY = 'true';
    }
    
    return NextResponse.json({
      success: true,
      message: 'POA v2 feature flags updated',
      data: {
        POA_V2_ENABLED: process.env.NEXT_PUBLIC_POA_V2_ENABLED,
        POA_V2_COMPUTATION: process.env.NEXT_PUBLIC_POA_V2_COMPUTATION,
        POA_V2_DISPLAY: process.env.NEXT_PUBLIC_POA_V2_DISPLAY,
        note: 'These are temporary runtime changes. For permanent changes, update your .env file.'
      }
    });

  } catch (error) {
    console.error('Enable POA v2 error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      currentFlags: {
        POA_V2_ENABLED: process.env.NEXT_PUBLIC_POA_V2_ENABLED,
        POA_V2_COMPUTATION: process.env.NEXT_PUBLIC_POA_V2_COMPUTATION,
        POA_V2_DISPLAY: process.env.NEXT_PUBLIC_POA_V2_DISPLAY,
      }
    }
  });
}

