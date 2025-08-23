import { NextRequest, NextResponse } from 'next/server';
import { BatchProcessingWorker } from '../../../../lib/batch-processing-worker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, batch_size, publish_threshold } = body;

    console.log(`🔄 Batch processing request: ${action}`);

    const worker = new BatchProcessingWorker({
      batchSize: batch_size || 500,
      publishThreshold: publish_threshold || 0.5,
    });

    switch (action) {
      case 'process_batch': {
        const result = await worker.processBatch();

        return NextResponse.json({
          success: result.success,
          message: `Batch processing completed: ${result.processed} processed, ${result.published} published`,
          data: {
            processed: result.processed,
            published: result.published,
            duration_ms: result.duration_ms,
            errors_count: result.errors.length,
            success_rate: result.processed > 0 ? ((result.processed - result.errors.length) / result.processed * 100).toFixed(1) : 0,
          },
          errors: result.errors.slice(0, 10), // Limit error output
        });
      }

      case 'get_stats': {
        const result = await worker.getProcessingStats();

        return NextResponse.json({
          success: result.success,
          message: 'Processing statistics retrieved',
          data: result.data,
          error: result.error,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['process_batch', 'get_stats']
        });
    }

  } catch (error) {
    console.error('❌ Batch processing API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const worker = new BatchProcessingWorker();
    const result = await worker.getProcessingStats();

    return NextResponse.json({
      success: result.success,
      message: 'Processing statistics retrieved',
      data: result.data,
      error: result.error,
    });

  } catch (error) {
    console.error('❌ Batch processing GET API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

