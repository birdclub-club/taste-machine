import { NextRequest, NextResponse } from 'next/server';
import { 
  computeCAIForCollection, 
  computeCAIBatch, 
  getCAIComputationCandidates,
  getCAILeaderboard 
} from '../../../lib/cai-computation-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, collection_name, collection_names, limit } = body;

    console.log(`🧮 CAI computation request: ${action}`);

    switch (action) {
      case 'compute_single': {
        if (!collection_name) {
          return NextResponse.json({
            success: false,
            error: 'collection_name is required for single computation'
          });
        }

        const result = await computeCAIForCollection(collection_name);
        
        return NextResponse.json({
          success: result.computed,
          phase: 'B2',
          message: result.computed ? 'Single collection CAI computation completed' : 'CAI computation failed',
          data: {
            collection: {
              name: result.collection_name,
              cai_score: result.cai_score,
              cai_confidence: result.cai_confidence,
              cai_cohesion: result.cai_cohesion,
              cai_coverage: result.cai_coverage,
            },
            computation: result,
            computed: result.computed,
          },
          error: result.error,
          warnings: result.warnings,
        });
      }

      case 'compute_batch': {
        const collections = collection_names || await getCAIComputationCandidates();
        
        if (!collections || collections.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No collections provided or found for batch computation'
          });
        }

        const results = await computeCAIBatch(collections, {
          maxConcurrent: limit || 3,
        });

        const successful = results.filter(r => r.computed);
        const failed = results.filter(r => !r.computed);

        return NextResponse.json({
          success: successful.length > 0,
          phase: 'B2',
          message: `CAI batch computation completed: ${successful.length} successful, ${failed.length} failed`,
          data: {
            total_processed: results.length,
            successful: successful.length,
            failed: failed.length,
            results: results.map(r => ({
              collection_name: r.collection_name,
              cai_score: r.cai_score,
              cai_confidence: r.cai_confidence,
              computed: r.computed,
              error: r.error,
            })),
            successful_collections: successful.map(r => ({
              name: r.collection_name,
              cai_score: r.cai_score,
              cai_confidence: r.cai_confidence,
              cai_cohesion: r.cai_cohesion,
              cai_coverage: r.cai_coverage,
            })),
          },
        });
      }

      case 'get_candidates': {
        const candidates = await getCAIComputationCandidates();
        
        return NextResponse.json({
          success: true,
          phase: 'B2',
          message: 'CAI computation candidates retrieved',
          data: {
            total_candidates: candidates.length,
            candidates: candidates,
          },
        });
      }

      case 'get_leaderboard': {
        const leaderboard = await getCAILeaderboard(limit || 10);
        
        return NextResponse.json({
          success: true,
          phase: 'B2',
          message: 'CAI leaderboard retrieved',
          data: {
            total_collections: leaderboard.length,
            leaderboard: leaderboard,
          },
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['compute_single', 'compute_batch', 'get_candidates', 'get_leaderboard']
        });
    }

  } catch (error) {
    console.error('❌ CAI computation API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Default GET returns candidates and leaderboard
    const candidates = await getCAIComputationCandidates();
    const leaderboard = await getCAILeaderboard(5);

    return NextResponse.json({
      success: true,
      phase: 'B2',
      message: 'CAI system status',
      data: {
        candidates: {
          count: candidates.length,
          collections: candidates,
        },
        leaderboard: {
          count: leaderboard.length,
          top_collections: leaderboard,
        },
        system_ready: candidates.length > 0,
      },
    });

  } catch (error) {
    console.error('❌ CAI status API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

