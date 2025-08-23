import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🎛️ Enabling CAI feature flags for testing...');

    // In a real environment, these would be set via environment variables
    // For testing, we'll simulate enabling them
    const flags = {
      CAI_ENABLED: 'true',
      CAI_COMPUTATION: 'true', 
      CAI_DISPLAY: 'true',
    };

    // Set environment variables for this session
    Object.entries(flags).forEach(([key, value]) => {
      process.env[key] = value;
    });

    console.log('✅ CAI feature flags enabled');

    return NextResponse.json({
      success: true,
      message: 'CAI feature flags enabled for testing',
      data: {
        flags_set: flags,
        note: 'These flags are set for the current session only. For permanent changes, update your environment variables.',
      },
    });

  } catch (error) {
    console.error('❌ Error enabling CAI flags:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

