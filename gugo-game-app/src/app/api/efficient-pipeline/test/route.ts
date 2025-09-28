import { NextRequest, NextResponse } from 'next/server';
import { EventIngestionService } from '../../../../lib/event-ingestion-service';
import { BatchProcessingWorker } from '../../../../lib/batch-processing-worker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    console.log(`🧪 Pipeline test request: ${action}`);

    switch (action) {
      case 'full_pipeline': {
        // Test the complete pipeline with sample data
        const testResults = await runFullPipelineTest();
        
        return NextResponse.json({
          success: testResults.success,
          message: 'Full pipeline test completed',
          data: testResults,
        });
      }

      case 'sample_events': {
        // Generate and ingest sample events for testing
        const sampleResults = await generateSampleEvents();
        
        return NextResponse.json({
          success: sampleResults.success,
          message: 'Sample events generated',
          data: sampleResults,
        });
      }

      case 'stress_test': {
        // Run a stress test with many events
        const { event_count = 100 } = body;
        const stressResults = await runStressTest(event_count);
        
        return NextResponse.json({
          success: stressResults.success,
          message: `Stress test completed with ${event_count} events`,
          data: stressResults,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['full_pipeline', 'sample_events', 'stress_test']
        });
    }

  } catch (error) {
    console.error('❌ Pipeline test API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Run a complete pipeline test
 */
async function runFullPipelineTest(): Promise<any> {
  const results = {
    success: false,
    steps: [] as any[],
    summary: {} as any,
  };

  try {
    // Step 1: Check initial pipeline status
    console.log('🔍 Step 1: Checking initial pipeline status...');
    const initialStatus = await EventIngestionService.getPipelineStatus();
    results.steps.push({
      step: 1,
      name: 'Initial Status',
      success: initialStatus.success,
      data: initialStatus.data,
    });

    // Step 2: Generate sample events
    console.log('📝 Step 2: Generating sample events...');
    const sampleEvents = await generateSampleEvents();
    results.steps.push({
      step: 2,
      name: 'Sample Events',
      success: sampleEvents.success,
      data: sampleEvents.data,
    });

    // Step 3: Process the batch
    console.log('⚙️ Step 3: Processing batch...');
    const worker = new BatchProcessingWorker({ batchSize: 50 });
    const batchResult = await worker.processBatch();
    results.steps.push({
      step: 3,
      name: 'Batch Processing',
      success: batchResult.success,
      data: {
        processed: batchResult.processed,
        published: batchResult.published,
        duration_ms: batchResult.duration_ms,
        error_count: batchResult.errors.length,
      },
    });

    // Step 4: Check final pipeline status
    console.log('🏁 Step 4: Checking final pipeline status...');
    const finalStatus = await EventIngestionService.getPipelineStatus();
    results.steps.push({
      step: 4,
      name: 'Final Status',
      success: finalStatus.success,
      data: finalStatus.data,
    });

    // Calculate summary
    results.summary = {
      total_steps: results.steps.length,
      successful_steps: results.steps.filter(s => s.success).length,
      events_generated: sampleEvents.data?.total_events || 0,
      nfts_processed: batchResult.processed,
      scores_published: batchResult.published,
      processing_time_ms: batchResult.duration_ms,
      dirty_nfts_before: initialStatus.data?.dirty_nfts_count || 0,
      dirty_nfts_after: finalStatus.data?.dirty_nfts_count || 0,
    };

    results.success = results.steps.every(s => s.success);
    
    console.log('✅ Full pipeline test completed successfully');
    return results;

  } catch (error) {
    console.error('❌ Full pipeline test failed:', error);
    results.steps.push({
      step: 'error',
      name: 'Test Error',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return results;
  }
}

/**
 * Generate sample events for testing
 */
async function generateSampleEvents(): Promise<any> {
  try {
    console.log('🎲 Generating sample events...');

    // Sample NFT IDs (using some real ones from your system)
    const nftIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const voterIds = [
      'user1', 'user2', 'user3', 'user4', 'user5'
    ];

    const events = {
      votes: [] as any[],
      sliders: [] as any[],
      fires: [] as any[],
    };

    // Generate 20 vote events
    for (let i = 0; i < 20; i++) {
      const nftA = nftIds[Math.floor(Math.random() * nftIds.length)];
      let nftB = nftIds[Math.floor(Math.random() * nftIds.length)];
      while (nftB === nftA) {
        nftB = nftIds[Math.floor(Math.random() * nftIds.length)];
      }
      
      const voter = voterIds[Math.floor(Math.random() * voterIds.length)];
      const winner = Math.random() > 0.5 ? nftA : nftB;
      
      events.votes.push({
        voter_id: voter,
        nft_a_id: nftA,
        nft_b_id: nftB,
        winner_id: winner,
        elo_pre_a: 1200 + Math.random() * 400,
        elo_pre_b: 1200 + Math.random() * 400,
        vote_type: Math.random() > 0.9 ? 'super' : 'normal',
      });
    }

    // Generate 15 slider events
    for (let i = 0; i < 15; i++) {
      const nft = nftIds[Math.floor(Math.random() * nftIds.length)];
      const voter = voterIds[Math.floor(Math.random() * voterIds.length)];
      const score = Math.random() * 100;
      
      events.sliders.push({
        voter_id: voter,
        nft_id: nft,
        raw_score: score,
      });
    }

    // Generate 5 FIRE events
    for (let i = 0; i < 5; i++) {
      const nft = nftIds[Math.floor(Math.random() * nftIds.length)];
      const voter = voterIds[Math.floor(Math.random() * voterIds.length)];
      
      events.fires.push({
        voter_id: voter,
        nft_id: nft,
      });
    }

    // Batch ingest all events
    const result = await EventIngestionService.ingestBatch(events);

    return {
      success: result.success,
      data: {
        total_events: events.votes.length + events.sliders.length + events.fires.length,
        votes_generated: events.votes.length,
        sliders_generated: events.sliders.length,
        fires_generated: events.fires.length,
        ingestion_results: result.results,
        errors: result.errors,
      },
    };

  } catch (error) {
    console.error('❌ Sample event generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run a stress test with many events
 */
async function runStressTest(eventCount: number): Promise<any> {
  try {
    console.log(`🚀 Running stress test with ${eventCount} events...`);
    
    const startTime = Date.now();
    const results = {
      success: false,
      events_generated: 0,
      batches_processed: 0,
      total_duration_ms: 0,
      avg_events_per_second: 0,
    };

    // Generate events in batches
    const batchSize = 50;
    const batches = Math.ceil(eventCount / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const eventsInBatch = Math.min(batchSize, eventCount - (batch * batchSize));
      
      // Generate batch events
      const sampleResult = await generateSampleEvents();
      if (sampleResult.success) {
        results.events_generated += sampleResult.data.total_events;
      }
      
      // Process batch
      const worker = new BatchProcessingWorker({ batchSize: 100 });
      await worker.processBatch();
      
      results.batches_processed++;
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    results.total_duration_ms = Date.now() - startTime;
    results.avg_events_per_second = results.events_generated / (results.total_duration_ms / 1000);
    results.success = true;

    console.log(`✅ Stress test completed: ${results.events_generated} events in ${results.total_duration_ms}ms`);
    return results;

  } catch (error) {
    console.error('❌ Stress test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return pipeline health and status
    const status = await EventIngestionService.getPipelineStatus();
    const recentEvents = await EventIngestionService.getRecentEvents(10);

    return NextResponse.json({
      success: true,
      message: 'Pipeline test status',
      data: {
        pipeline_status: status.data,
        recent_events_count: {
          votes: recentEvents.data?.votes.length || 0,
          sliders: recentEvents.data?.sliders.length || 0,
          fires: recentEvents.data?.fires.length || 0,
        },
        test_endpoints: {
          full_pipeline: 'POST /api/efficient-pipeline/test {"action": "full_pipeline"}',
          sample_events: 'POST /api/efficient-pipeline/test {"action": "sample_events"}',
          stress_test: 'POST /api/efficient-pipeline/test {"action": "stress_test", "event_count": 100}',
        },
      },
    });

  } catch (error) {
    console.error('❌ Pipeline test GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

