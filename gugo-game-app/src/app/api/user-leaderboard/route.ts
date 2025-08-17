import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Calculate voting streak for a user
async function calculateVotingStreak(userId: string): Promise<number> {
  try {
    // Get user's votes ordered by date (most recent first)
    const { data: votes, error } = await supabase
      .from('votes')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !votes || votes.length === 0) {
      return 0;
    }

    // Group votes by date
    const votesByDate = new Map<string, number>();
    votes.forEach(vote => {
      const date = new Date(vote.created_at).toISOString().split('T')[0];
      votesByDate.set(date, (votesByDate.get(date) || 0) + 1);
    });

    const sortedDates = Array.from(votesByDate.keys()).sort().reverse();
    
    if (sortedDates.length === 0) return 0;

    // Check if user voted today
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let streak = 0;
    let currentDate = today;
    
    // Start from today or yesterday if they haven't voted today
    if (!votesByDate.has(today)) {
      if (!votesByDate.has(yesterday)) {
        return 0; // No recent activity
      }
      currentDate = yesterday;
    }

    // Count consecutive days
    while (votesByDate.has(currentDate)) {
      streak++;
      const date = new Date(currentDate);
      date.setDate(date.getDate() - 1);
      currentDate = date.toISOString().split('T')[0];
    }

    return streak;
  } catch (error) {
    console.error('Error calculating voting streak:', error);
    return 0;
  }
}

// Taste Level calculation based on XP
export function calculateTasteLevel(xp: number): { level: number; name: string; minXP: number; maxXP: number; progress: number } {
  const tasteLevels = [
    { level: 1, name: "Novice Taster", minXP: 0, maxXP: 99 },
    { level: 2, name: "Apprentice Curator", minXP: 100, maxXP: 299 },
    { level: 3, name: "Aesthetic Explorer", minXP: 300, maxXP: 599 },
    { level: 4, name: "Visual Connoisseur", minXP: 600, maxXP: 999 },
    { level: 5, name: "Taste Specialist", minXP: 1000, maxXP: 1599 },
    { level: 6, name: "Art Critic", minXP: 1600, maxXP: 2399 },
    { level: 7, name: "Aesthetic Master", minXP: 2400, maxXP: 3499 },
    { level: 8, name: "Taste Virtuoso", minXP: 3500, maxXP: 4999 },
    { level: 9, name: "Visual Sage", minXP: 5000, maxXP: 7499 },
    { level: 10, name: "Taste Legend", minXP: 7500, maxXP: 9999 },
    { level: 11, name: "Aesthetic Deity", minXP: 10000, maxXP: Infinity }
  ];

  const currentLevel = tasteLevels.find(level => xp >= level.minXP && xp <= level.maxXP) || tasteLevels[tasteLevels.length - 1];
  
  // Calculate progress within current level
  const progress = currentLevel.maxXP === Infinity 
    ? 100 
    : Math.round(((xp - currentLevel.minXP) / (currentLevel.maxXP - currentLevel.minXP)) * 100);

  return {
    ...currentLevel,
    progress: Math.min(progress, 100)
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('👥 Fetching user leaderboard...');

    // Get top users by XP and total votes
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        wallet_address,
        username,
        avatar_url,
        xp,
        total_votes,
        available_votes,
        created_at
      `)
      .order('xp', { ascending: false })
      .order('total_votes', { ascending: false })
      .order('created_at', { ascending: true }) // Earlier users win ties
      .limit(50); // Get top 50 users

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return NextResponse.json(
        { success: false, error: `Database error: ${usersError.message}` },
        { status: 500 }
      );
    }

    if (!usersData || usersData.length === 0) {
      console.log('📊 No users found');
      return NextResponse.json({
        success: true,
        leaderboard: [],
        metadata: {
          totalUsers: 0,
          topXP: 0,
          topVotes: 0
        }
      });
    }

    // Process users and add taste levels, rankings, and streaks
    const processedUsers = await Promise.all(usersData.map(async (user, index) => {
      const tasteLevel = calculateTasteLevel(user.xp || 0);
      
      // Create display name (username or shortened wallet address)
      const displayName = user.username || 
        `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`;

      // Calculate voting streak
      const votingStreak = await calculateVotingStreak(user.id);

      // Calculate days since joining
      const daysSinceJoining = Math.max(1, Math.ceil((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: user.id,
        wallet_address: user.wallet_address,
        display_name: displayName,
        username: user.username,
        avatar_url: user.avatar_url,
        xp: user.xp || 0,
        total_votes: user.total_votes || 0,
        available_votes: user.available_votes || 0,
        created_at: user.created_at,
        position: index + 1,
        taste_level: tasteLevel,
        voting_streak: votingStreak,
        days_since_joining: daysSinceJoining,
        // Calculate some additional stats
        votes_per_day: user.total_votes ? Math.round((user.total_votes || 0) / daysSinceJoining * 10) / 10 : 0,
        xp_per_vote: user.total_votes ? Math.round(((user.xp || 0) / Math.max(1, user.total_votes)) * 100) / 100 : 0
      };
    }));

    // Calculate metadata
    const metadata = {
      totalUsers: processedUsers.length,
      topXP: processedUsers[0]?.xp || 0,
      topVotes: Math.max(...processedUsers.map(u => u.total_votes)),
      averageXP: Math.round(processedUsers.reduce((sum, u) => sum + u.xp, 0) / processedUsers.length),
      averageVotes: Math.round(processedUsers.reduce((sum, u) => sum + u.total_votes, 0) / processedUsers.length),
      tasteLevelDistribution: processedUsers.reduce((acc, user) => {
        const levelName = user.taste_level.name;
        acc[levelName] = (acc[levelName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    console.log(`👥 User leaderboard generated: ${processedUsers.length} users`);
    console.log(`🏆 Top user: ${processedUsers[0]?.display_name} with ${processedUsers[0]?.xp} XP and ${processedUsers[0]?.total_votes} votes`);
    console.log(`🎯 Taste level distribution:`, metadata.tasteLevelDistribution);

    return NextResponse.json({
      success: true,
      leaderboard: processedUsers,
      metadata
    });

  } catch (error) {
    console.error('❌ User leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
