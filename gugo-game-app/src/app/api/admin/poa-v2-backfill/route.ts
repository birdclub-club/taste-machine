import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';
import { computePOAv2ForNFT } from '../../../../lib/poa-v2-computation-engine';

export async function POST(request: NextRequest) {
  try {
    const { batchSize = 10, dryRun = false } = await request.json();
    
    // supabase is already imported
    
    // Get high-priority NFTs that need POA v2 computation
    const { data: candidates, error } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes, poa_v2')
      .gte('total_votes', 10) // Focus on NFTs with meaningful vote data
      .is('poa_v2', null) // Only NFTs without POA v2 scores
      .order('total_votes', { ascending: false })
      .limit(batchSize);

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Failed to get candidates: ${error.message}`
      }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No candidates found for backfill',
        data: { processed: 0, candidates: [] }
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `Dry run: Found ${candidates.length} candidates`,
        data: { 
          candidates: candidates.map(c => ({
            id: c.id,
            name: c.name,
            collection: c.collection_name,
            votes: c.total_votes
          }))
        }
      });
    }

    // Process each NFT individually to avoid timeouts
    const results = [];
    const errors = [];

    for (const nft of candidates) {
      try {
        console.log(`Computing POA v2 for ${nft.name} (${nft.total_votes} votes)...`);
        
        const result = await computePOAv2ForNFT(nft.id);
        
        if (result) {
          results.push({
            id: nft.id,
            name: nft.name,
            collection: nft.collection_name,
            votes: nft.total_votes,
            poa_v2: result.poa_v2,
            confidence: result.poa_v2_confidence
          });
        } else {
          errors.push({
            id: nft.id,
            name: nft.name,
            error: 'Failed to compute POA v2'
          });
        }

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error computing POA v2 for ${nft.name}:`, error);
        errors.push({
          id: nft.id,
          name: nft.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      phase: 'A5',
      message: `Backfill batch completed: ${results.length} successful, ${errors.length} errors`,
      data: {
        processed: results.length,
        errorCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('POA v2 backfill error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // supabase is already imported
    
    // Get backfill progress statistics
    const [totalResult, completedResult, candidatesResult] = await Promise.all([
      supabase
        .from('nfts')
        .select('id', { count: 'exact', head: true })
        .gte('total_votes', 5),
      
      supabase
        .from('nfts')
        .select('id', { count: 'exact', head: true })
        .gte('total_votes', 5)
        .not('poa_v2', 'is', null),
      
      supabase
        .from('nfts')
        .select('id, name, collection_name, total_votes')
        .gte('total_votes', 10)
        .is('poa_v2', null)
        .order('total_votes', { ascending: false })
        .limit(20)
    ]);

    const totalEligible = totalResult.count || 0;
    const completed = completedResult.count || 0;
    const remaining = totalEligible - completed;
    const progress = totalEligible > 0 ? (completed / totalEligible * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      data: {
        backfillProgress: {
          totalEligible,
          completed,
          remaining,
          progressPercent: `${progress}%`
        },
        nextCandidates: candidatesResult.data || [],
        summary: `${completed}/${totalEligible} NFTs have POA v2 scores (${progress}% complete)`
      }
    });

  } catch (error) {
    console.error('Backfill status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
