// 🎛️ Collection Management API
// Advanced collection activation/deactivation and priority management

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'list':
        return await handleListCollections();
      
      case 'stats':
        return await handleCollectionStats();
        
      case 'active':
        return await handleGetActiveCollections();
        
      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid action. Use: list, stats, active' 
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Collection management API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, collection_name, active, priority } = body;

    switch (action) {
      case 'set_active':
        return await handleSetActive(collection_name, active);
        
      case 'set_priority':
        return await handleSetPriority(collection_name, priority);
        
      case 'set_all_active':
        return await handleSetAllActive(active);
        
      case 'reset_priorities':
        return await handleResetPriorities();
        
      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid action. Use: set_active, set_priority, set_all_active, reset_priorities' 
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Collection management POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 📋 List all collections with their current status
async function handleListCollections() {
  try {
    // Try RPC function first
    const { data: collections, error } = await supabase
      .rpc('get_collection_statistics');

    if (!error && collections) {
      return NextResponse.json({
        success: true,
        collections: collections || [],
        total_collections: collections?.length || 0,
        active_collections: collections?.filter((c: any) => c.active)?.length || 0
      });
    }

    // Fallback: Manual query if RPC function doesn't exist
    console.warn('⚠️ RPC function not available, using fallback queries');
    
    // Get all unique collections from NFTs table
    const { data: nftCollections, error: nftError } = await supabase
      .from('nfts')
      .select('collection_name')
      .not('collection_name', 'is', null);

    if (nftError) {
      throw new Error(`Failed to get collections: ${nftError.message}`);
    }

    const uniqueCollections = [...new Set(nftCollections?.map(c => c.collection_name) || [])];

    // Get collection management data
    const { data: managementData, error: mgmtError } = await supabase
      .from('collection_management')
      .select('*');

    if (mgmtError) {
      console.warn('⚠️ Collection management table not available, using defaults');
    }

    // Build collection list with fallback data
    const fallbackCollections = uniqueCollections.map(name => {
      const mgmt = managementData?.find(m => m.collection_name === name);
      return {
        collection_name: name,
        active: mgmt?.active ?? true, // Default to active
        priority: mgmt?.priority ?? 1.0,
        nft_count: 0, // Would need separate query
        total_votes: 0,
        avg_elo: 1000,
        avg_votes_per_nft: 0,
        hours_since_selected: null
      };
    });

    return NextResponse.json({
      success: true,
      collections: fallbackCollections,
      total_collections: fallbackCollections.length,
      active_collections: fallbackCollections.filter(c => c.active).length,
      note: 'Using fallback data - some statistics may be incomplete'
    });
    
  } catch (error) {
    console.error('❌ Error listing collections:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// 📊 Get detailed collection statistics
async function handleCollectionStats() {
  try {
    // Try RPC function first
    const { data: stats, error } = await supabase
      .rpc('get_collection_statistics');

    if (error) {
      console.warn('⚠️ RPC function not available, using fallback for stats');
      
      // Fallback: Return basic stats
      return NextResponse.json({
        success: true,
        statistics: {
          overview: {
            total_collections: 0,
            active_collections: 0,
            total_nfts: 0,
            total_votes: 0,
            votes_today: 0,
            average_elo: 1000,
            average_votes_per_nft: 0
          },
          insights: {
            most_active_collection: null,
            most_active_votes_per_nft: null,
            newest_or_unused_collection: null,
            collections_needing_more_data: []
          },
          collections: []
        },
        note: 'RPC function not available - using fallback data'
      });
    }

    // Calculate aggregate statistics
    const totalNFTs = stats?.reduce((sum: number, collection: any) => sum + Number(collection.nft_count), 0) || 0;
    const totalVotes = stats?.reduce((sum: number, collection: any) => sum + Number(collection.total_votes), 0) || 0;
    const activeCollections = stats?.filter((c: any) => c.active) || [];
    const averageElo = stats?.reduce((sum: number, collection: any) => sum + Number(collection.avg_elo), 0) / Math.max(1, stats?.length || 1);

    // Get today's votes (placeholder - would need actual daily vote tracking)
    const today = new Date().toISOString().split('T')[0];
    let votesToday = 0;
    
    try {
      const { data: dailyVotes, error: dailyError } = await supabase
        .from('votes')
        .select('id')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);
      
      if (!dailyError && dailyVotes) {
        votesToday = dailyVotes.length;
      }
    } catch (err) {
      console.log('Could not fetch daily votes, using 0');
    }

    // Find collection insights
    const mostActiveCollection = stats?.reduce((max: any, collection: any) => 
      Number(collection.avg_votes_per_nft) > Number(max.avg_votes_per_nft) ? collection : max
    );
    
    const newestCollection = stats?.find((collection: any) => 
      collection.hours_since_selected === null || Number(collection.hours_since_selected) > 24
    );

    return NextResponse.json({
      success: true,
      statistics: {
        overview: {
          total_collections: stats?.length || 0,
          active_collections: activeCollections.length,
          total_nfts: totalNFTs,
          total_votes: totalVotes,
          votes_today: votesToday,
          average_elo: Math.round(averageElo * 100) / 100,
          average_votes_per_nft: Math.round((totalVotes / Math.max(1, totalNFTs)) * 100) / 100
        },
        insights: {
          most_active_collection: mostActiveCollection?.collection_name || null,
          most_active_votes_per_nft: mostActiveCollection ? Math.round(Number(mostActiveCollection.avg_votes_per_nft) * 100) / 100 : null,
          newest_or_unused_collection: newestCollection?.collection_name || null,
          collections_needing_more_data: stats?.filter((c: any) => 
            c.active && Number(c.avg_votes_per_nft) < 5
          ).map((c: any) => c.collection_name) || []
        },
        collections: stats || []
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting collection stats:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// ✅ Get only active collections
async function handleGetActiveCollections() {
  try {
    // Try RPC function first
    const { data: stats, error } = await supabase
      .rpc('get_collection_statistics');

    if (error) {
      console.warn('⚠️ RPC function not available, using fallback for active collections');
      
      // Fallback: Get from collection_management table
      const { data: managementData, error: mgmtError } = await supabase
        .from('collection_management')
        .select('*')
        .eq('active', true);

      if (mgmtError) {
        console.warn('⚠️ Collection management table not available');
        return NextResponse.json({
          success: true,
          active_collections: [],
          count: 0,
          note: 'No collection management data available'
        });
      }

      const activeCollections = managementData?.map(c => ({
        name: c.collection_name,
        priority: c.priority || 1.0,
        nft_count: 0, // Would need separate query
        avg_votes_per_nft: 0,
        hours_since_selected: null
      })) || [];

      return NextResponse.json({
        success: true,
        active_collections: activeCollections,
        count: activeCollections.length,
        note: 'Using fallback data - some statistics may be incomplete'
      });
    }

    const activeCollections = stats?.filter((c: any) => c.active).map((c: any) => ({
      name: c.collection_name,
      priority: c.priority,
      nft_count: c.nft_count,
      avg_votes_per_nft: Math.round(Number(c.avg_votes_per_nft) * 100) / 100,
      hours_since_selected: c.hours_since_selected ? Math.round(Number(c.hours_since_selected) * 100) / 100 : null
    })) || [];

    return NextResponse.json({
      success: true,
      active_collections: activeCollections,
      count: activeCollections.length
    });
    
  } catch (error) {
    console.error('❌ Error getting active collections:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// 🎛️ Set collection active/inactive status
async function handleSetActive(collectionName: string, active: boolean) {
  if (!collectionName) {
    return NextResponse.json({ 
      success: false, 
      error: 'collection_name is required' 
    }, { status: 400 });
  }

  if (typeof active !== 'boolean') {
    return NextResponse.json({ 
      success: false, 
      error: 'active must be a boolean' 
    }, { status: 400 });
  }

  try {
    // Check if collection exists in NFTs table
    const { data: nftCheck, error: nftError } = await supabase
      .from('nfts')
      .select('collection_name')
      .eq('collection_name', collectionName)
      .limit(1);

    if (nftError) {
      throw new Error(`Error checking collection existence: ${nftError.message}`);
    }

    if (!nftCheck || nftCheck.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Collection '${collectionName}' not found` 
      }, { status: 404 });
    }

    // Upsert collection management record
    const { error: upsertError } = await supabase
      .from('collection_management')
      .upsert({
        collection_name: collectionName,
        active: active,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'collection_name',
        ignoreDuplicates: false
      });

    if (upsertError) {
      throw new Error(`Failed to update collection status: ${upsertError.message}`);
    }

    console.log(`✅ Collection ${collectionName} ${active ? 'activated' : 'deactivated'}`);

    return NextResponse.json({
      success: true,
      message: `Collection '${collectionName}' ${active ? 'activated' : 'deactivated'}`,
      collection_name: collectionName,
      active: active
    });
    
  } catch (error) {
    console.error('❌ Error setting collection active status:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// 📈 Set collection priority
async function handleSetPriority(collectionName: string, priority: number) {
  if (!collectionName) {
    return NextResponse.json({ 
      success: false, 
      error: 'collection_name is required' 
    }, { status: 400 });
  }

  if (typeof priority !== 'number' || priority < 0.1 || priority > 3.0) {
    return NextResponse.json({ 
      success: false, 
      error: 'priority must be a number between 0.1 and 3.0' 
    }, { status: 400 });
  }

  try {
    // Check if collection exists
    const { data: nftCheck, error: nftError } = await supabase
      .from('nfts')
      .select('collection_name')
      .eq('collection_name', collectionName)
      .limit(1);

    if (nftError) {
      throw new Error(`Error checking collection existence: ${nftError.message}`);
    }

    if (!nftCheck || nftCheck.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Collection '${collectionName}' not found` 
      }, { status: 404 });
    }

    // Upsert collection management record
    const { error: upsertError } = await supabase
      .from('collection_management')
      .upsert({
        collection_name: collectionName,
        priority: priority,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'collection_name',
        ignoreDuplicates: false
      });

    if (upsertError) {
      throw new Error(`Failed to update collection priority: ${upsertError.message}`);
    }

    console.log(`✅ Collection ${collectionName} priority set to ${priority}`);

    return NextResponse.json({
      success: true,
      message: `Collection '${collectionName}' priority set to ${priority}`,
      collection_name: collectionName,
      priority: priority
    });
    
  } catch (error) {
    console.error('❌ Error setting collection priority:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// 🎛️ Set all collections active/inactive
async function handleSetAllActive(active: boolean) {
  if (typeof active !== 'boolean') {
    return NextResponse.json({ 
      success: false, 
      error: 'active must be a boolean' 
    }, { status: 400 });
  }

  try {
    // Get all collection names
    const { data: collections, error: collectionsError } = await supabase
      .from('nfts')
      .select('collection_name')
      .not('collection_name', 'is', null);

    if (collectionsError) {
      throw new Error(`Failed to get collections: ${collectionsError.message}`);
    }

    const uniqueCollections = [...new Set(collections?.map(c => c.collection_name) || [])];

    if (uniqueCollections.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No collections found' 
      }, { status: 404 });
    }

    // Update all collections
    const updates = uniqueCollections.map(collectionName => ({
      collection_name: collectionName,
      active: active,
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError } = await supabase
      .from('collection_management')
      .upsert(updates, { 
        onConflict: 'collection_name',
        ignoreDuplicates: false
      });

    if (upsertError) {
      throw new Error(`Failed to update all collections: ${upsertError.message}`);
    }

    console.log(`✅ All ${uniqueCollections.length} collections ${active ? 'activated' : 'deactivated'}`);

    return NextResponse.json({
      success: true,
      message: `All ${uniqueCollections.length} collections ${active ? 'activated' : 'deactivated'}`,
      affected_collections: uniqueCollections.length,
      active: active
    });
    
  } catch (error) {
    console.error('❌ Error setting all collections active:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// 🔄 Reset all collection priorities to default (1.0)
async function handleResetPriorities() {
  try {
    const { error } = await supabase
      .from('collection_management')
      .update({ 
        priority: 1.0,
        updated_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all records

    if (error) {
      throw new Error(`Failed to reset priorities: ${error.message}`);
    }

    console.log('✅ All collection priorities reset to 1.0');

    return NextResponse.json({
      success: true,
      message: 'All collection priorities reset to default (1.0)'
    });
    
  } catch (error) {
    console.error('❌ Error resetting priorities:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
