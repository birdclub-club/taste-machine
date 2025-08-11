/**
 * API endpoint to debug leaderboard issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging leaderboard issues...');

    const results: any = {
      fireVoteCheck: null,
      nftsWithFire: null,
      functionResult: null,
      topByElo: null,
      collectionStats: null,
      imageIssues: null
    };

    // First, check if FIRE votes exist at all
    console.log('📋 Checking FIRE vote existence...');
    const { data: fireCheck, error: fireError } = await supabase
      .from('favorites')
      .select('*', { count: 'exact' })
      .eq('vote_type', 'fire');

    if (fireError) {
      console.error('❌ Fire vote check failed:', fireError);
    } else {
      results.fireVoteCheck = {
        totalFireVotes: fireCheck?.length || 0,
        sampleVotes: fireCheck?.slice(0, 5) || []
      };
      console.log(`✅ Found ${fireCheck?.length || 0} FIRE votes`);
    }

    // Check the specific NFTs that have FIRE votes
    console.log('📋 Checking NFTs with FIRE votes...');
    try {
      const { data: fireNfts, error: fireNftsError } = await supabase
        .rpc('get_fire_voted_nfts', { limit_count: 10 });

      if (fireNftsError) {
        console.warn('⚠️ Fire NFTs RPC failed, trying manual query...');
        
        // Manual approach using favorites join
        const { data: manualFireNfts, error: manualError } = await supabase
          .from('nfts')
          .select(`
            id, name, collection_name, current_elo, total_votes, wins, losses, image,
            favorites!inner(vote_type)
          `)
          .eq('favorites.vote_type', 'fire')
          .limit(10);

        if (manualError) {
          console.error('❌ Manual fire NFTs query failed:', manualError);
        } else {
          results.nftsWithFire = manualFireNfts;
        }
      } else {
        results.nftsWithFire = fireNfts;
      }
    } catch (error) {
      console.error('❌ Error checking NFTs with FIRE votes:', error);
    }

    // Check what the leaderboard function actually returns
    console.log('📋 Testing leaderboard function...');
    const { data: functionData, error: functionError } = await supabase
      .rpc('get_fire_first_leaderboard_v2', { limit_count: 10 });

    if (functionError) {
      console.error('❌ Leaderboard function failed:', functionError);
      results.functionResult = { error: functionError.message };
    } else {
      results.functionResult = functionData;
      console.log(`✅ Function returned ${functionData?.length || 0} NFTs`);
    }

    // Check the top NFTs by Elo
    console.log('📋 Checking top NFTs by Elo...');
    const { data: topElo, error: eloError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, current_elo, total_votes, wins, losses')
      .not('current_elo', 'is', null)
      .order('current_elo', { ascending: false })
      .limit(10);

    if (eloError) {
      console.error('❌ Top Elo query failed:', eloError);
    } else {
      results.topByElo = topElo;
    }

    // Check collection distribution
    console.log('📋 Checking collection distribution...');
    const { data: collections, error: collectionsError } = await supabase
      .from('nfts')
      .select('collection_name')
      .not('current_elo', 'is', null);

    if (collectionsError) {
      console.error('❌ Collections query failed:', collectionsError);
    } else {
      const collectionCounts = collections?.reduce((acc: any, nft: any) => {
        acc[nft.collection_name] = (acc[nft.collection_name] || 0) + 1;
        return acc;
      }, {});
      
      results.collectionStats = Object.entries(collectionCounts || {})
        .map(([name, count]) => ({ collection_name: name, nft_count: count }))
        .sort((a: any, b: any) => b.nft_count - a.nft_count)
        .slice(0, 10);
    }

    // Check image issues
    console.log('📋 Checking image issues...');
    const { data: allNfts, error: allError } = await supabase
      .from('nfts')
      .select('collection_name, image')
      .not('current_elo', 'is', null);

    if (allError) {
      console.error('❌ All NFTs query failed:', allError);
    } else {
      const imageStats = allNfts?.reduce((acc: any, nft: any) => {
        const collection = nft.collection_name;
        if (!acc[collection]) {
          acc[collection] = { total: 0, nullImages: 0, ipfsImages: 0, httpImages: 0 };
        }
        acc[collection].total++;
        if (!nft.image || nft.image === '') acc[collection].nullImages++;
        if (nft.image?.includes('ipfs')) acc[collection].ipfsImages++;
        if (nft.image?.includes('http')) acc[collection].httpImages++;
        return acc;
      }, {});

      results.imageIssues = Object.entries(imageStats || {})
        .map(([name, stats]) => ({ collection_name: name, ...stats }))
        .sort((a: any, b: any) => b.total - a.total);
    }

    return NextResponse.json({
      success: true,
      debug: results,
      summary: {
        totalFireVotes: results.fireVoteCheck?.totalFireVotes || 0,
        nftsWithFireVotes: results.nftsWithFire?.length || 0,
        leaderboardFunction: results.functionResult?.length || 0,
        topCollections: results.collectionStats?.slice(0, 3).map((c: any) => `${c.collection_name}: ${c.nft_count}`) || []
      }
    });

  } catch (error) {
    console.error('❌ Error debugging leaderboard:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error 
      },
      { status: 500 }
    );
  }
}
