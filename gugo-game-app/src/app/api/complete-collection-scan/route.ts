import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page_size = parseInt(url.searchParams.get('page_size') || '5000');
    const max_pages = parseInt(url.searchParams.get('max_pages') || '15'); // Limit to prevent timeouts
    
    console.log(`🔍 Starting complete collection scan (${page_size} per page, max ${max_pages} pages)...`);

    let allCollections: Record<string, any> = {};
    let totalProcessed = 0;
    let currentPage = 0;

    // Paginate through all NFTs
    while (currentPage < max_pages) {
      const startRange = currentPage * page_size;
      const endRange = startRange + page_size - 1;
      
      console.log(`📄 Processing page ${currentPage + 1}: NFTs ${startRange}-${endRange}`);

      const { data: pageNFTs, error } = await supabase
        .from('nfts')
        .select('collection_name, total_votes, poa_v2, name')
        .range(startRange, endRange)
        .order('id'); // Consistent ordering

      if (error) {
        console.error(`❌ Error on page ${currentPage}:`, error);
        break;
      }

      if (!pageNFTs || pageNFTs.length === 0) {
        console.log(`✅ Reached end of data at page ${currentPage + 1}`);
        break;
      }

      // Process this page's NFTs
      for (const nft of pageNFTs) {
        const collection = nft.collection_name || 'NULL_COLLECTION';
        
        if (!allCollections[collection]) {
          allCollections[collection] = {
            total_nfts: 0,
            with_votes: 0,
            with_poa_v2: 0,
            sample_names: []
          };
        }

        allCollections[collection].total_nfts++;
        if (nft.total_votes > 0) allCollections[collection].with_votes++;
        if (nft.poa_v2 !== null) allCollections[collection].with_poa_v2++;
        
        // Keep sample names (first 3 per collection)
        if (allCollections[collection].sample_names.length < 3) {
          allCollections[collection].sample_names.push(nft.name);
        }
      }

      totalProcessed += pageNFTs.length;
      currentPage++;

      // Log progress every few pages
      if (currentPage % 3 === 0) {
        console.log(`📊 Progress: ${totalProcessed} NFTs processed, ${Object.keys(allCollections).length} collections found`);
      }

      // If we got less than page_size, we've reached the end
      if (pageNFTs.length < page_size) {
        console.log(`✅ Reached end of data (got ${pageNFTs.length} < ${page_size})`);
        break;
      }
    }

    // Sort collections by size
    const sortedCollections = Object.entries(allCollections)
      .map(([name, stats]) => ({
        collection_name: name,
        total_nfts: stats.total_nfts,
        with_votes: stats.with_votes,
        with_poa_v2: stats.with_poa_v2,
        vote_percentage: Math.round((stats.with_votes / stats.total_nfts) * 100),
        poa_percentage: Math.round((stats.with_poa_v2 / stats.total_nfts) * 100),
        sample_names: stats.sample_names
      }))
      .sort((a, b) => b.total_nfts - a.total_nfts);

    // Find your target collections
    const targetCollections = ['BEARISH', 'DreamilioMaker', 'BEEISH', 'Pengztracted', 'Kabu'];
    const foundTargets = sortedCollections.filter(col => 
      targetCollections.some(target => 
        col.collection_name.toLowerCase().includes(target.toLowerCase()) ||
        target.toLowerCase().includes(col.collection_name.toLowerCase())
      )
    );

    return NextResponse.json({
      success: true,
      message: `Complete collection scan: ${totalProcessed} NFTs processed`,
      data: {
        scan_summary: {
          total_nfts_processed: totalProcessed,
          pages_processed: currentPage,
          collections_found: sortedCollections.length,
          largest_collection: sortedCollections[0]?.collection_name,
          largest_size: sortedCollections[0]?.total_nfts
        },
        all_collections: sortedCollections,
        target_collections_found: foundTargets,
        migration_candidates: sortedCollections.filter(col => col.with_votes > 0),
        recommendations: generateMigrationRecommendations(sortedCollections, foundTargets, totalProcessed)
      }
    });

  } catch (error) {
    console.error('❌ Complete collection scan error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateMigrationRecommendations(collections: any[], targets: any[], totalProcessed: number): string[] {
  const recommendations = [];

  if (totalProcessed < 50000) {
    recommendations.push(`⚠️ PARTIAL SCAN: Only ${totalProcessed} NFTs processed out of expected 54,312. May need larger pagination.`);
  }

  if (targets.length > 0) {
    const totalTargetNFTs = targets.reduce((sum, col) => sum + col.total_nfts, 0);
    const totalTargetVotes = targets.reduce((sum, col) => sum + col.with_votes, 0);
    recommendations.push(`🎯 TARGET COLLECTIONS: ${targets.length} found with ${totalTargetNFTs} NFTs total, ${totalTargetVotes} have votes`);
  }

  const largeCollections = collections.filter(col => col.total_nfts >= 1000);
  if (largeCollections.length > 0) {
    recommendations.push(`📊 LARGE COLLECTIONS: ${largeCollections.map(col => `${col.collection_name} (${col.total_nfts})`).join(', ')}`);
  }

  const withVotes = collections.filter(col => col.with_votes > 0);
  if (withVotes.length > 0) {
    const totalVotingNFTs = withVotes.reduce((sum, col) => sum + col.with_votes, 0);
    recommendations.push(`🗳️ MIGRATION SCOPE: ${withVotes.length} collections have voting activity, ${totalVotingNFTs} NFTs total need migration`);
  }

  return recommendations;
}

