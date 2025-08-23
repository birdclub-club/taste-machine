import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing preloader collection filtering logic...');
    
    // Step 1: Get active collections (same logic as preloader)
    const { data: activeCollections, error: activeError } = await supabase
      .from('collection_management')
      .select('collection_name')
      .eq('active', true);
    
    if (activeError) {
      console.error('❌ Error fetching active collections:', activeError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch active collections',
        details: activeError 
      }, { status: 500 });
    }

    const activeCollectionNames = activeCollections?.map(c => c.collection_name) || [];
    console.log(`🎛️ Active collections: ${activeCollectionNames.join(', ')}`);
    
    // Step 2: Test the same query logic as preloader for same_coll
    let sameCollQuery = supabase
      .from('nfts')
      .select('id, name, image, token_id, contract_address, collection_name, current_elo, traits')
      .not('collection_name', 'is', null)
      .not('image', 'ilike', '%.mp4%')
      .not('image', 'ilike', '%.mov%')
      .not('image', 'ilike', '%.avi%')
      .not('image', 'ilike', '%.webm%')
      .not('image', 'ilike', '%.mkv%')
      .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
      .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')
      .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]');

    // Apply collection filtering (same logic as preloader)
    if (activeCollectionNames.length > 0) {
      sameCollQuery = sameCollQuery.in('collection_name', activeCollectionNames);
      console.log(`🎯 Filtering to active collections only`);
    }

    const { data: filteredNfts, error: queryError } = await sameCollQuery
      .order('id', { ascending: false })
      .limit(100); // Smaller limit for testing

    if (queryError) {
      console.error('❌ Error in filtered query:', queryError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to execute filtered query',
        details: queryError 
      }, { status: 500 });
    }

    // Analyze results
    const collectionBreakdown: Record<string, number> = {};
    filteredNfts?.forEach(nft => {
      collectionBreakdown[nft.collection_name] = (collectionBreakdown[nft.collection_name] || 0) + 1;
    });

    // Check if Fugz appears in results
    const fugzCount = collectionBreakdown['Fugz'] || 0;
    const hasFugz = fugzCount > 0;

    // Also test without collection filtering to see if Fugz NFTs exist
    const { data: allNfts, error: allError } = await supabase
      .from('nfts')
      .select('collection_name')
      .eq('collection_name', 'Fugz')
      .limit(5);

    return NextResponse.json({
      success: true,
      test_results: {
        active_collections: activeCollectionNames,
        active_count: activeCollectionNames.length,
        is_fugz_active: activeCollectionNames.includes('Fugz'),
        filtered_nfts_count: filteredNfts?.length || 0,
        collection_breakdown: collectionBreakdown,
        fugz_in_results: {
          count: fugzCount,
          present: hasFugz
        },
        fugz_nfts_exist_in_db: (allNfts?.length || 0) > 0,
        fugz_nft_sample: allNfts?.slice(0, 3) || []
      },
      diagnosis: {
        preloader_logic_correct: !hasFugz,
        issue_identified: hasFugz ? 'FUGZ APPEARING IN FILTERED RESULTS - BUG CONFIRMED' : 'Collection filtering working correctly',
        likely_cause: hasFugz ? 'Bug in collection filtering logic or cached sessions' : 'Cached sessions from when Fugz was active'
      },
      recommendation: hasFugz 
        ? 'CRITICAL BUG: Collection filtering is not working - investigate query logic'
        : 'Clear cached sessions - filtering logic is correct'
    });
  } catch (error) {
    console.error('Error testing preloader collection filtering:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to test preloader collection filtering', 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

