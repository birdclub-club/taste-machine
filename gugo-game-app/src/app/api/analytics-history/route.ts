import { NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function GET() {
  try {
    console.log('📊 Fetching analytics history...');
    
    // Get historical data from analytics_snapshots table (if it exists)
    const { data: historyData, error: historyError } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(30); // Last 30 data points

    if (historyError && historyError.code !== 'PGRST116') {
      console.warn('⚠️ Analytics snapshots table not available:', historyError.message);
    }

    // If we have historical data, return it
    if (!historyError && historyData && historyData.length > 0) {
      return NextResponse.json({
        success: true,
        history: historyData,
        note: 'Historical data from analytics_snapshots table'
      });
    }

    // Fallback: Generate mock historical data for demonstration
    console.log('📈 Generating mock historical data for demonstration...');
    
    const mockHistory = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Simulate realistic growth patterns
      const daysSinceStart = 29 - i;
      const baseUsers = 15 + Math.floor(daysSinceStart * 0.3); // Gradual user growth
      const dailyVariation = Math.floor(Math.random() * 5) - 2; // ±2 variation
      const totalUsers = Math.max(15, baseUsers + dailyVariation);
      
      const dailyUsers = Math.floor(Math.random() * 8) + 1; // 1-8 daily users
      const activeUsers = Math.floor(dailyUsers * (0.6 + Math.random() * 0.4)); // 60-100% of daily users are active
      const newUsers = Math.floor(Math.random() * 3); // 0-2 new users per day
      
      const totalVotes = Math.floor(totalUsers * (50 + Math.random() * 100)); // 50-150 votes per user
      const dailyVotes = Math.floor(activeUsers * (5 + Math.random() * 15)); // 5-20 votes per active user
      
      // Collection growth simulation
      const baseCollections = Math.min(11, 6 + Math.floor(daysSinceStart * 0.2)); // Gradual collection growth
      const collectionsActive = Math.max(3, Math.min(baseCollections, 6 + Math.floor(Math.random() * 2))); // 3-8 active
      
      // NFT growth simulation
      const baseNFTs = 40000 + (daysSinceStart * 500); // Growing NFT count
      const nftVariation = Math.floor(Math.random() * 2000) - 1000; // ±1000 variation
      const totalNFTs = Math.max(40000, baseNFTs + nftVariation);
      
      // Vote engagement metrics
      const avgVotesPerNFT = totalVotes / Math.max(1, totalNFTs);
      const collectionEngagement = Math.random() * 0.8 + 0.2; // 20-100% engagement
      
      mockHistory.push({
        id: `mock-${i}`,
        created_at: date.toISOString(),
        date: date.toISOString().split('T')[0],
        total_users: totalUsers,
        daily_users: dailyUsers,
        active_users: activeUsers,
        new_users: newUsers,
        total_votes: totalVotes,
        daily_votes: dailyVotes,
        total_collections: baseCollections,
        active_collections: collectionsActive,
        total_nfts: totalNFTs,
        avg_votes_per_nft: Math.round(avgVotesPerNFT * 100) / 100,
        collection_engagement: Math.round(collectionEngagement * 100) / 100,
        new_collections: i === 29 ? 0 : Math.floor(Math.random() * 2), // 0-1 new collections per day
        collections_with_votes: Math.floor(collectionsActive * collectionEngagement)
      });
    }

    // Add today's actual data as the last point
    try {
      // Get current user stats from database directly (avoid circular API calls)
      const { data: currentUsers } = await supabase
        .from('users')
        .select('id', { count: 'exact' });
      
      const today = new Date().toISOString().split('T')[0];
      const { data: todayVotes } = await supabase
        .from('votes')
        .select('id', { count: 'exact' })
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);
      
      // Update the last entry with real data
      const lastEntry = mockHistory[mockHistory.length - 1];
      if (currentUsers) {
        lastEntry.total_users = currentUsers.length;
      }
      if (todayVotes) {
        lastEntry.daily_votes = todayVotes.length;
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch current stats for historical data:', err);
    }

    return NextResponse.json({
      success: true,
      history: mockHistory,
      note: 'Mock historical data - implement analytics_snapshots table for real tracking'
    });

  } catch (error) {
    console.error('❌ Unexpected error in analytics history API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      history: []
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    console.log('📊 Creating analytics snapshot...');
    
    // Get current stats
    const userStatsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/user-stats`);
    const userStats = await userStatsResponse.json();
    
    const dailyVotesResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/daily-vote-count`);
    const dailyVotesData = await dailyVotesResponse.json();

    const snapshot = {
      date: new Date().toISOString().split('T')[0],
      total_users: userStats.totalUsers || 0,
      daily_users: userStats.dailyUsers || 0,
      active_users: userStats.activeUsersToday || 0,
      new_users: userStats.newUsersToday || 0,
      daily_votes: dailyVotesData.count || 0,
      total_collections: 11, // Could be fetched from collection API
      active_collections: 6,
      total_nfts: 54312
    };

    // Try to insert into analytics_snapshots table
    const { data, error } = await supabase
      .from('analytics_snapshots')
      .upsert(snapshot, { 
        onConflict: 'date',
        ignoreDuplicates: false
      });

    if (error) {
      console.warn('⚠️ Could not save analytics snapshot:', error.message);
      return NextResponse.json({
        success: false,
        error: 'Analytics snapshots table not available',
        note: 'Run the analytics migration to enable historical tracking'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      snapshot: data,
      message: 'Analytics snapshot saved successfully'
    });

  } catch (error) {
    console.error('❌ Error creating analytics snapshot:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}
