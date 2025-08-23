import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verifying total NFT count and investigating discrepancy...');

    // 1. Get exact count using count query
    const { count: totalCount, error: countError } = await supabase
      .from('nfts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ success: false, error: countError.message });
    }

    console.log(`📊 Total count query result: ${totalCount}`);

    // 2. Try different approaches to get collection data
    
    // Approach A: Small sample with no range
    const { data: smallSample, error: smallError } = await supabase
      .from('nfts')
      .select('collection_name')
      .limit(1000);

    // Approach B: Try with larger limit
    const { data: largeSample, error: largeError } = await supabase
      .from('nfts')
      .select('collection_name')
      .limit(10000);

    // Approach C: Try pagination approach
    const { data: page1, error: page1Error } = await supabase
      .from('nfts')
      .select('collection_name')
      .range(0, 999);

    const { data: page2, error: page2Error } = await supabase
      .from('nfts')
      .select('collection_name')
      .range(1000, 1999);

    const { data: page3, error: page3Error } = await supabase
      .from('nfts')
      .select('collection_name')
      .range(2000, 2999);

    // Count collections from each approach
    const countCollections = (data: any[]) => {
      return data?.reduce((acc, nft) => {
        acc[nft.collection_name] = (acc[nft.collection_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
    };

    const smallCollections = countCollections(smallSample || []);
    const largeCollections = countCollections(largeSample || []);
    const page1Collections = countCollections(page1 || []);
    const page2Collections = countCollections(page2 || []);
    const page3Collections = countCollections(page3 || []);

    // 3. Check if there are NFTs beyond the first 10k
    const { data: highRange, error: highRangeError } = await supabase
      .from('nfts')
      .select('collection_name, name')
      .range(50000, 50010);

    return NextResponse.json({
      success: true,
      message: 'NFT count verification complete',
      data: {
        total_count_query: totalCount,
        query_results: {
          small_sample: {
            count: smallSample?.length || 0,
            collections: smallCollections,
            error: smallError?.message
          },
          large_sample: {
            count: largeSample?.length || 0,
            collections: largeCollections,
            error: largeError?.message
          },
          pagination_test: {
            page1_count: page1?.length || 0,
            page2_count: page2?.length || 0,
            page3_count: page3?.length || 0,
            page1_collections: page1Collections,
            page2_collections: page2Collections,
            page3_collections: page3Collections
          },
          high_range_test: {
            count: highRange?.length || 0,
            sample: highRange?.slice(0, 3) || [],
            error: highRangeError?.message
          }
        },
        analysis: {
          expected_total: 54312,
          largest_query_returned: Math.max(
            smallSample?.length || 0,
            largeSample?.length || 0,
            (page1?.length || 0) + (page2?.length || 0) + (page3?.length || 0)
          ),
          discrepancy: totalCount ? totalCount - Math.max(smallSample?.length || 0, largeSample?.length || 0) : 'unknown',
          likely_issue: totalCount && totalCount > 10000 ? 'Query limits preventing full data access' : 'Database size smaller than expected'
        }
      }
    });

  } catch (error) {
    console.error('❌ NFT count verification error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

