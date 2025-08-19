/**
 * Real-time IPFS to HTTP Converter API
 * 
 * Endpoints:
 * GET /api/ipfs-converter - Get conversion statistics and progress
 * POST /api/ipfs-converter - Start conversion process
 * DELETE /api/ipfs-converter - Clear caches
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

interface ConversionStats {
  total: number;
  ipfs: number;
  http: number;
  processed: number;
  cached: number;
}

interface ConversionProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: number;
  lastUpdate: number;
  isRunning?: boolean;
  speed?: number;
  estimatedTimeRemaining?: number;
}

// Global conversion state (in production, use Redis or similar)
const conversionState: {
  isRunning: boolean;
  progress: ConversionProgress | null;
  lastResult: any;
} = {
  isRunning: false,
  progress: null,
  lastResult: null
};

async function runConverterCommand(command: string, args: string[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'bulk-ipfs-converter.js');
    const childProcess = spawn('node', [scriptPath, command, ...args], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    childProcess.stdout.on('data', (data) => {
      output += data.toString();
      
      // Parse progress updates from output
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('Progress:')) {
          try {
            // Extract progress information from log line
            const progressMatch = line.match(/(\d+\.\d+)%.*?(\d+)\/(\d+).*?✅ (\d+).*?❌ (\d+).*?(\d+\.\d+) NFTs\/sec/);
            if (progressMatch) {
              const [, percent, processed, total, successful, failed, speed] = progressMatch;
              
              conversionState.progress = {
                total: parseInt(total),
                processed: parseInt(processed),
                successful: parseInt(successful),
                failed: parseInt(failed),
                startTime: conversionState.progress?.startTime || Date.now(),
                lastUpdate: Date.now(),
                speed: parseFloat(speed)
              };
              
              // Calculate estimated time remaining
              const remaining = parseInt(total) - parseInt(processed);
              const estimatedSeconds = remaining / parseFloat(speed);
              conversionState.progress.estimatedTimeRemaining = estimatedSeconds;
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }
      }
    });

    childProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    childProcess.on('close', (code) => {
      conversionState.isRunning = false;
      
      if (code === 0) {
        try {
          // Try to parse JSON output from the script
          const result = JSON.parse(output.split('\n').find(line => line.startsWith('{')) || '{}');
          conversionState.lastResult = result;
          resolve(result);
        } catch (error) {
          // If no JSON, return the raw output
          resolve({ output, success: true });
        }
      } else {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }
    });

    childProcess.on('error', (error) => {
      conversionState.isRunning = false;
      reject(error);
    });
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        console.log('📊 Fetching conversion statistics...');
        const stats = await runConverterCommand('stats');
        return NextResponse.json({
          success: true,
          stats,
          progress: conversionState.progress,
          isRunning: conversionState.isRunning,
          lastResult: conversionState.lastResult
        });

      case 'progress':
        return NextResponse.json({
          success: true,
          progress: conversionState.progress,
          isRunning: conversionState.isRunning,
          lastUpdate: conversionState.progress?.lastUpdate || null
        });

      default:
        // Default: return current state
        return NextResponse.json({
          success: true,
          isRunning: conversionState.isRunning,
          progress: conversionState.progress,
          lastResult: conversionState.lastResult
        });
    }

  } catch (error) {
    console.error('❌ Error in GET /api/ipfs-converter:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get converter status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (conversionState.isRunning) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Conversion already in progress',
          progress: conversionState.progress
        },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { 
      collection = null, 
      limit = null, 
      dryRun = false, 
      fresh = false 
    } = body;

    console.log('🚀 Starting IPFS conversion...', { collection, limit, dryRun, fresh });

    // Mark as running
    conversionState.isRunning = true;
    conversionState.progress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: Date.now(),
      lastUpdate: Date.now()
    };

    // Build command arguments
    const args = ['convert'];
    if (collection) args.push(collection);
    if (limit) args.push('--limit', limit.toString());
    if (dryRun) args.push('--dry-run');
    if (fresh) args.push('--fresh');

    // Start conversion in background
    runConverterCommand('convert', args.slice(1))
      .then((result) => {
        console.log('✅ Conversion completed:', result);
        conversionState.lastResult = result;
      })
      .catch((error) => {
        console.error('❌ Conversion failed:', error);
        conversionState.lastResult = { error: error.message, success: false };
      })
      .finally(() => {
        conversionState.isRunning = false;
      });

    return NextResponse.json({
      success: true,
      message: 'Conversion started',
      parameters: { collection, limit, dryRun, fresh },
      progress: conversionState.progress
    });

  } catch (error) {
    console.error('❌ Error in POST /api/ipfs-converter:', error);
    conversionState.isRunning = false;
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start conversion',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (conversionState.isRunning) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot clear cache while conversion is running'
        },
        { status: 409 }
      );
    }

    console.log('🧹 Clearing converter caches...');
    await runConverterCommand('clear-cache');

    // Reset state
    conversionState.progress = null;
    conversionState.lastResult = null;

    return NextResponse.json({
      success: true,
      message: 'Caches cleared successfully'
    });

  } catch (error) {
    console.error('❌ Error in DELETE /api/ipfs-converter:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
