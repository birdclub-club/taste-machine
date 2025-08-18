import { NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function GET() {
  try {
    console.log('📊 Fetching user statistics...');
    
    // Try to use the comprehensive statistics function first
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_user_statistics');

    if (!statsError && statsData && statsData.length > 0) {
      const stats = statsData[0];
      
      console.log(`📊 User Statistics (from RPC):`);
      console.log(`   Total Users (Lifetime): ${stats.total_users}`);
      console.log(`   Users Today: ${stats.users_today}`);
      console.log(`   Active Users Today: ${stats.active_users_today}`);
      console.log(`   New Users Today: ${stats.new_users_today}`);
      
      const totalUsers = parseInt(stats.total_users);
      const dailyUsers = parseInt(stats.users_today);
      const activeUsers = parseInt(stats.active_users_today);
      const newUsers = parseInt(stats.new_users_today);
      
      return NextResponse.json({ 
        totalUsers,
        dailyUsers: Math.min(dailyUsers, totalUsers), // Cap at total users
        activeUsersToday: Math.min(activeUsers, totalUsers), // Cap at total users
        newUsersToday: Math.min(newUsers, totalUsers), // Cap at total users
        usersThisWeek: parseInt(stats.users_this_week),
        usersThisMonth: parseInt(stats.users_this_month),
        date: new Date().toISOString().split('T')[0]
      });
    }

    // Fallback to manual queries if RPC function is not available
    console.warn('⚠️ RPC function not available, using fallback queries');
    
    // Get total unique users (lifetime)
    const { data: totalUsersData, error: totalUsersError } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    if (totalUsersError) {
      console.error('❌ Error fetching total users:', totalUsersError);
      return NextResponse.json({ 
        error: 'Failed to fetch total users',
        totalUsers: 0,
        dailyUsers: 0
      }, { status: 500 });
    }

    // Get unique users for today (users who created accounts or voted today)
    // Use the same date format as treasury API for consistency
    const today = new Date().toISOString().split('T')[0];
    const startOfToday = `${today}T00:00:00.000Z`;
    const startOfTomorrow = `${today}T23:59:59.999Z`;
    
    console.log(`📅 Fetching daily users for ${today} from ${startOfToday} to ${startOfTomorrow}`);
    
    // Get users who created accounts today
    const { data: newUsersToday, error: newUsersError } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', startOfToday)
      .lte('created_at', startOfTomorrow);

    if (newUsersError) {
      console.error('❌ Error fetching new users today:', newUsersError);
    }

    // Get unique active users (users who voted today) - join with users table to get wallet addresses
    const { data: votesToday, error: votesError } = await supabase
      .from('votes')
      .select(`
        created_at,
        users!inner(wallet_address)
      `)
      .gte('created_at', startOfToday)
      .lte('created_at', startOfTomorrow);

    let dailyActiveUsers = 0;
    if (!votesError && votesToday) {
      // Count unique wallet addresses that voted today
      const uniqueWallets = new Set(votesToday.map((vote: any) => vote.users.wallet_address));
      dailyActiveUsers = uniqueWallets.size;
      console.log(`📊 Found ${votesToday.length} votes today from ${dailyActiveUsers} unique wallets`);
      if (votesToday.length > 0) {
        console.log(`📊 Sample vote timestamps:`, votesToday.slice(0, 3).map(v => v.created_at));
        console.log(`📊 Sample wallet addresses:`, Array.from(uniqueWallets).slice(0, 3));
      }
    } else if (votesError) {
      console.error('❌ Error fetching votes for today:', votesError);
    }

    const totalUsers = totalUsersData?.length || 0;
    const newUsersCount = newUsersToday?.length || 0;
    
    // Daily users should never exceed total users
    // Daily users = max of (new users today, active users today), but capped at total users
    const dailyUsers = Math.min(Math.max(newUsersCount, dailyActiveUsers), totalUsers);
    
    console.log(`📊 User Statistics (fallback):`);
    console.log(`   Total Users (Lifetime): ${totalUsers}`);
    console.log(`   New Users Today: ${newUsersCount}`);
    console.log(`   Active Users Today: ${dailyActiveUsers}`);
    console.log(`   Daily Users (Combined): ${dailyUsers}`);
    
    return NextResponse.json({ 
      totalUsers,
      dailyUsers,
      activeUsersToday: Math.min(dailyActiveUsers, totalUsers), // Cap at total users
      newUsersToday: Math.min(newUsersCount, totalUsers), // Cap at total users
      date: new Date().toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('❌ Unexpected error in user stats API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      totalUsers: 0,
      dailyUsers: 0
    }, { status: 500 });
  }
}
