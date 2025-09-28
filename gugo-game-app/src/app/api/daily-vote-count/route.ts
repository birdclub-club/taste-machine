import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  try {
    // Get today's vote count from Supabase (votes cast today only)
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    
    console.log(`📅 Fetching votes from ${startOfToday} to ${startOfTomorrow}`);
    
    const { data, error } = await supabase
      .from('votes')
      .select('id', { count: 'exact' })
      .gte('created_at', startOfToday)
      .lt('created_at', startOfTomorrow);

    if (error) {
      console.error('❌ Error fetching daily vote count:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch vote count',
        count: 0 // Fallback to 0
      }, { status: 500 });
    }

    const dailyCount = data?.length || 0;
    console.log(`📊 Today's vote count: ${dailyCount}`);
    
    return NextResponse.json({ 
      count: dailyCount,
      date: new Date().toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('❌ Unexpected error in daily vote count API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      count: 0
    }, { status: 500 });
  }
}