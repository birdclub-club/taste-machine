import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet') || '0xd593c708833d606f28E81a147FD33edFeAdE0Aa9';
    
    // Get user ID
    const { data: user } = await supabase
      .from('users')
      .select('id, wallet_address, created_at')
      .eq('wallet_address', walletAddress)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's votes ordered by date (most recent first)
    const { data: votes, error } = await supabase
      .from('votes')
      .select('created_at, vote_type_v2, slider_value')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5000); // Get last 5000 votes

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group votes by date
    const votesByDate = new Map<string, number>();
    const voteDetails: Record<string, any[]> = {};
    
    votes?.forEach(vote => {
      const date = new Date(vote.created_at).toISOString().split('T')[0];
      votesByDate.set(date, (votesByDate.get(date) || 0) + 1);
      
      if (!voteDetails[date]) {
        voteDetails[date] = [];
      }
      voteDetails[date].push({
        time: vote.created_at,
        type: vote.vote_type_v2,
        slider: vote.slider_value
      });
    });

    const sortedDates = Array.from(votesByDate.keys()).sort().reverse();
    
    // Calculate streak manually
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let streak = 0;
    let currentDate = today;
    
    console.log('🔍 Streak calculation debug:', {
      today,
      yesterday,
      hasVotesToday: votesByDate.has(today),
      hasVotesYesterday: votesByDate.has(yesterday),
      totalVotingDays: sortedDates.length,
      firstVotingDate: sortedDates[sortedDates.length - 1],
      lastVotingDate: sortedDates[0]
    });
    
    // Start from today or yesterday if they haven't voted today
    if (!votesByDate.has(today)) {
      if (!votesByDate.has(yesterday)) {
        console.log('❌ No recent activity (no votes today or yesterday)');
        streak = 0;
      } else {
        console.log('✅ Starting from yesterday');
        currentDate = yesterday;
      }
    } else {
      console.log('✅ Starting from today');
    }

    // Count consecutive days
    const streakDays = [];
    while (votesByDate.has(currentDate) && streak < 30) { // Safety limit
      streak++;
      streakDays.push({
        date: currentDate,
        votes: votesByDate.get(currentDate),
        details: voteDetails[currentDate]?.slice(0, 3) // First 3 votes of the day
      });
      
      const date = new Date(currentDate);
      date.setDate(date.getDate() - 1);
      currentDate = date.toISOString().split('T')[0];
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        wallet: user.wallet_address,
        joined: user.created_at
      },
      streak: {
        calculated: streak,
        streakDays: streakDays
      },
      summary: {
        totalVotes: votes?.length || 0,
        totalVotingDays: sortedDates.length,
        today,
        yesterday,
        hasVotesToday: votesByDate.has(today),
        hasVotesYesterday: votesByDate.has(yesterday),
        votesToday: votesByDate.get(today) || 0,
        votesYesterday: votesByDate.get(yesterday) || 0
      },
      recentDates: sortedDates.slice(0, 10).map(date => ({
        date,
        votes: votesByDate.get(date),
        sample: voteDetails[date]?.[0]
      }))
    });

  } catch (error) {
    console.error('Error in debug voting streak:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
