import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { getUnscoredNFTProgress } from '../../../lib/publish-gates-validator';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'leaderboard';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const collection = url.searchParams.get('collection');
    const nft_id = url.searchParams.get('nft_id');

    console.log(`📊 NFT scores request: ${action}`);

    switch (action) {
      case 'leaderboard': {
        // Ranked list - scored NFTs only
        const { data: scores, error } = await supabase
          .from('nft_scores')
          .select(`
            nft_id,
            poa_v2,
            confidence,
            provisional,
            elo_component,
            slider_component,
            fire_component,
            reliability_factor,
            updated_at
          `)
          .order('poa_v2', { ascending: false })
          .limit(limit);

        if (error) {
          return NextResponse.json({
            success: false,
            error: error.message
          });
        }

        if (!scores || scores.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No scored NFTs found',
            data: {
              leaderboard: [],
              total_scored: 0,
              collection_filter: collection,
            },
          });
        }

        // Get NFT details for the scored NFTs
        const nftIds = scores.map(s => s.nft_id);
        let nftQuery = supabase
          .from('nfts')
          .select('id, name, collection_name')
          .in('id', nftIds);

        if (collection) {
          nftQuery = nftQuery.eq('collection_name', collection);
        }

        const { data: nfts, error: nftError } = await nftQuery;

        if (nftError) {
          return NextResponse.json({
            success: false,
            error: nftError.message
          });
        }

        // Create NFT lookup map
        const nftMap = new Map((nfts || []).map(nft => [nft.id, nft]));

        // Build leaderboard with NFT details
        const leaderboard = scores
          .filter(score => nftMap.has(score.nft_id))
          .map((score, index) => {
            const nft = nftMap.get(score.nft_id);
            if (!nft) throw new Error(`NFT not found: ${score.nft_id}`);
            return {
              id: nft.id,
              name: nft.name,
              collection_name: nft.collection_name,
              rank: index + 1,
              status: 'scored',
              poa: {
                value: score.poa_v2,
                confidence_pm: Math.round((100 - score.confidence) / 2), // Convert confidence to ±
              },
              components: {
                elo: Math.round(score.elo_component),
                slider: Math.round(score.slider_component),
                fire: Math.round(score.fire_component),
              },
              provisional: score.provisional,
              updated_at: score.updated_at,
            };
          });

        return NextResponse.json({
          success: true,
          message: `Leaderboard retrieved: ${leaderboard.length} scored NFTs`,
          data: {
            leaderboard,
            total_scored: leaderboard.length,
            collection_filter: collection,
          },
        });
      }

      case 'unscored': {
        // Unscored NFTs - awaiting data
        let query = supabase
          .from('nfts')
          .select('id, name, collection_name, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (collection) {
          query = query.eq('collection_name', collection);
        }

        const { data: allNFTs, error: nftsError } = await query;

        if (nftsError) {
          return NextResponse.json({
            success: false,
            error: nftsError.message
          });
        }

        // Filter out NFTs that have scores
        const { data: scoredIds, error: scoresError } = await supabase
          .from('nft_scores')
          .select('nft_id');

        if (scoresError) {
          return NextResponse.json({
            success: false,
            error: scoresError.message
          });
        }

        const scoredSet = new Set((scoredIds || []).map(s => s.nft_id));
        const unscoredNFTs = (allNFTs || []).filter(nft => !scoredSet.has(nft.id));

        // Get progress for first few unscored NFTs (to avoid too many DB calls)
        const progressPromises = unscoredNFTs.slice(0, Math.min(10, unscoredNFTs.length))
          .map(async (nft) => {
            const progress = await getUnscoredNFTProgress(nft.id);
            return {
              id: nft.id,
              name: nft.name,
              collection_name: nft.collection_name,
              status: 'awaiting_data',
              progress: progress.progress,
            };
          });

        const unscoredWithProgress = await Promise.all(progressPromises);

        // Add remaining without detailed progress
        const remaining = unscoredNFTs.slice(Math.min(10, unscoredNFTs.length)).map(nft => ({
          id: nft.id,
          name: nft.name,
          collection_name: nft.collection_name,
          status: 'awaiting_data',
          progress: null, // Will be loaded on demand
        }));

        return NextResponse.json({
          success: true,
          message: `Unscored NFTs retrieved: ${unscoredNFTs.length} awaiting data`,
          data: {
            unscored: [...unscoredWithProgress, ...remaining],
            total_unscored: unscoredNFTs.length,
            collection_filter: collection,
          },
        });
      }

      case 'single': {
        if (!nft_id) {
          return NextResponse.json({
            success: false,
            error: 'nft_id parameter required for single NFT lookup'
          });
        }

        // Check if NFT has a score
        const { data: score, error: scoreError } = await supabase
          .from('nft_scores')
          .select('*')
          .eq('nft_id', nft_id)
          .single();

        if (scoreError && scoreError.code !== 'PGRST116') { // PGRST116 = not found
          return NextResponse.json({
            success: false,
            error: scoreError.message
          });
        }

        // Get NFT basic info
        const { data: nft, error: nftError } = await supabase
          .from('nfts')
          .select('id, name, collection_name')
          .eq('id', nft_id)
          .single();

        if (nftError) {
          return NextResponse.json({
            success: false,
            error: nftError.message
          });
        }

        if (score) {
          // Scored NFT
          return NextResponse.json({
            success: true,
            message: 'Scored NFT retrieved',
            data: {
              id: nft.id,
              name: nft.name,
              collection_name: nft.collection_name,
              status: 'scored',
              poa: {
                value: score.poa_v2,
                confidence_pm: Math.round((100 - score.confidence) / 2),
              },
              components: {
                elo: Math.round(score.elo_component),
                slider: Math.round(score.slider_component),
                fire: Math.round(score.fire_component),
              },
              provisional: score.provisional,
              updated_at: score.updated_at,
            },
          });
        } else {
          // Unscored NFT
          const progress = await getUnscoredNFTProgress(nft_id);
          return NextResponse.json({
            success: true,
            message: 'Unscored NFT retrieved',
            data: {
              id: nft.id,
              name: nft.name,
              collection_name: nft.collection_name,
              ...progress,
            },
          });
        }
      }

      case 'collection_stats': {
        if (!collection) {
          return NextResponse.json({
            success: false,
            error: 'collection parameter required for collection stats'
          });
        }

        // Get total NFTs in collection
        const { count: totalNFTs, error: countError } = await supabase
          .from('nfts')
          .select('*', { count: 'exact', head: true })
          .eq('collection_name', collection);

        if (countError) {
          return NextResponse.json({
            success: false,
            error: countError.message
          });
        }

        // Get scored NFTs in collection
        const { data: scoredNFTs, error: scoredError } = await supabase
          .from('nfts')
          .select(`
            id,
            nft_scores!inner(poa_v2, confidence)
          `)
          .eq('collection_name', collection);

        if (scoredError) {
          return NextResponse.json({
            success: false,
            error: scoredError.message
          });
        }

        const scoredCount = scoredNFTs?.length || 0;
        const coverage = totalNFTs ? (scoredCount / totalNFTs) * 100 : 0;
        const avgPOA = scoredCount > 0 
          ? (scoredNFTs?.reduce((sum, nft) => sum + (nft.nft_scores?.[0]?.poa_v2 || 0), 0) || 0) / scoredCount
          : null;

        return NextResponse.json({
          success: true,
          message: 'Collection statistics retrieved',
          data: {
            collection_name: collection,
            total_nfts: totalNFTs || 0,
            scored_nfts: scoredCount,
            unscored_nfts: (totalNFTs || 0) - scoredCount,
            coverage_percent: Math.round(coverage * 100) / 100,
            avg_poa: avgPOA ? Math.round(avgPOA * 100) / 100 : null,
            provisional: coverage < 20 || scoredCount < 25,
          },
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['leaderboard', 'unscored', 'single', 'collection_stats']
        });
    }

  } catch (error) {
    console.error('❌ NFT scores API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
