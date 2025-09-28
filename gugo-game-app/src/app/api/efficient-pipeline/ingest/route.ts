import { NextRequest, NextResponse } from 'next/server';
import { EventIngestionService } from '../../../../lib/event-ingestion-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    console.log(`🔄 Event ingestion request: ${action}`);

    switch (action) {
      case 'vote': {
        const { voter_id, nft_a_id, nft_b_id, winner_id, elo_pre_a, elo_pre_b, vote_type } = params;
        
        if (!voter_id || !nft_a_id || !nft_b_id || !winner_id || elo_pre_a === undefined || elo_pre_b === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameters: voter_id, nft_a_id, nft_b_id, winner_id, elo_pre_a, elo_pre_b'
          });
        }

        const result = await EventIngestionService.ingestVote({
          voter_id,
          nft_a_id: String(nft_a_id),
          nft_b_id: String(nft_b_id),
          winner_id: String(winner_id),
          elo_pre_a: parseFloat(elo_pre_a),
          elo_pre_b: parseFloat(elo_pre_b),
          vote_type: vote_type || 'normal',
        });

        return NextResponse.json({
          success: result.success,
          message: result.success ? 'Vote event ingested successfully' : 'Vote ingestion failed',
          data: { event_id: result.event_id },
          error: result.error,
        });
      }

      case 'slider': {
        const { voter_id, nft_id, raw_score } = params;
        
        if (!voter_id || !nft_id || raw_score === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameters: voter_id, nft_id, raw_score'
          });
        }

        const result = await EventIngestionService.ingestSlider({
          voter_id,
          nft_id: String(nft_id),
          raw_score: parseFloat(raw_score),
        });

        return NextResponse.json({
          success: result.success,
          message: result.success ? 'Slider event ingested successfully' : 'Slider ingestion failed',
          data: { event_id: result.event_id },
          error: result.error,
        });
      }

      case 'fire': {
        const { voter_id, nft_id } = params;
        
        if (!voter_id || !nft_id) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameters: voter_id, nft_id'
          });
        }

        const result = await EventIngestionService.ingestFire({
          voter_id,
          nft_id: String(nft_id),
        });

        return NextResponse.json({
          success: result.success,
          message: result.success ? 'FIRE event ingested successfully' : 'FIRE ingestion failed',
          data: { event_id: result.event_id },
          error: result.error,
        });
      }

      case 'batch': {
        const { events } = params;
        
        if (!events) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameter: events'
          });
        }

        const result = await EventIngestionService.ingestBatch(events);

        return NextResponse.json({
          success: result.success,
          message: `Batch ingestion completed: ${result.results.votes_inserted} votes, ${result.results.sliders_inserted} sliders, ${result.results.fires_inserted} fires`,
          data: result.results,
          errors: result.errors,
        });
      }

      case 'mark_dirty': {
        const { nft_ids, priority } = params;
        
        if (!nft_ids || !Array.isArray(nft_ids)) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameter: nft_ids (array)'
          });
        }

        const result = await EventIngestionService.markNFTsDirty(
          nft_ids.map(id => String(id)),
          priority || 0
        );

        return NextResponse.json({
          success: result.success,
          message: `Marked ${result.marked_count}/${nft_ids.length} NFTs as dirty`,
          data: { marked_count: result.marked_count },
          error: result.error,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['vote', 'slider', 'fire', 'batch', 'mark_dirty']
        });
    }

  } catch (error) {
    console.error('❌ Event ingestion API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';

    switch (action) {
      case 'status': {
        const result = await EventIngestionService.getPipelineStatus();
        
        return NextResponse.json({
          success: result.success,
          message: 'Pipeline status retrieved',
          data: result.data,
          error: result.error,
        });
      }

      case 'recent_events': {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const result = await EventIngestionService.getRecentEvents(limit);
        
        return NextResponse.json({
          success: result.success,
          message: 'Recent events retrieved',
          data: result.data,
          error: result.error,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['status', 'recent_events']
        });
    }

  } catch (error) {
    console.error('❌ Event ingestion GET API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
