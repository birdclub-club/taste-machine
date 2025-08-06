import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  try {
    // Get today's vote count from Supabase
    const { data, error } = await supabase
      .from('votes')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z') // Start of today
      .lt('created_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z'); // Start of tomorrow

    if (error) {
      console.error('❌ Error fetching daily vote count:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch vote count',
        count: 0 // Fallback to 0
      }, { status: 500 });
    }

    const dailyCount = data?.length || 0;
    console.log(`📊 Daily vote count: ${dailyCount}`);
    
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