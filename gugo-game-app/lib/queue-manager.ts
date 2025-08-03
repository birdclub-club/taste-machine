// 🚀 Queue Management Utilities
// Helper functions for managing the matchup queue system

import { supabase } from './supabase';

export interface QueueStatus {
  same_coll: number;
  cross_coll: number;
  slider: number;
  total: number;
}

export interface QueueHealth {
  healthy: boolean;
  warnings: string[];
  stats: QueueStatus;
}

// 📊 Get current queue status
export async function getQueueStatus(): Promise<QueueStatus> {
  const { data, error } = await supabase
    .from('matchup_queue')
    .select('vote_type')
    .or('reserved_until.is.null,reserved_until.lt.now()');

  if (error) {
    console.error('❌ Failed to get queue status:', error);
    return { same_coll: 0, cross_coll: 0, slider: 0, total: 0 };
  }

  const counts = data.reduce((acc, item) => {
    acc[item.vote_type as keyof QueueStatus]++;
    acc.total++;
    return acc;
  }, { same_coll: 0, cross_coll: 0, slider: 0, total: 0 });

  return counts;
}

// 🏥 Check queue health
export async function checkQueueHealth(): Promise<QueueHealth> {
  const stats = await getQueueStatus();
  const warnings: string[] = [];
  
  // Check if any queue type is running low
  if (stats.same_coll < 5) {
    warnings.push('Same collection queue running low');
  }
  if (stats.cross_coll < 5) {
    warnings.push('Cross collection queue running low');
  }
  if (stats.slider < 10) {
    warnings.push('Slider queue running low');
  }
  
  // Check total queue size
  if (stats.total < 20) {
    warnings.push('Total queue size is low');
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    stats
  };
}

// 🔄 Force queue refill
export async function refillQueue(): Promise<{ success: boolean; results?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('populate_matchup_queue');
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, results: data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 🧹 Clean up expired queue items
export async function cleanupQueue(): Promise<{ success: boolean; cleaned?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('cleanup_matchup_queue');
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, cleaned: data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 📈 Get queue analytics
export async function getQueueAnalytics() {
  try {
    const { data, error } = await supabase
      .from('matchup_queue')
      .select(`
        vote_type,
        priority_score,
        created_at,
        reserved_until,
        reserved_by
      `);

    if (error) throw error;

    const analytics = {
      byType: {} as Record<string, number>,
      averagePriority: {} as Record<string, number>,
      reservationRate: 0,
      oldestItem: null as Date | null,
      newestItem: null as Date | null
    };

    let reservedCount = 0;
    const now = new Date();

    data.forEach((item: Record<string, any>) => {
      // Count by type
      analytics.byType[item.vote_type] = (analytics.byType[item.vote_type] || 0) + 1;
      
      // Track priority averages
      if (!analytics.averagePriority[item.vote_type]) {
        analytics.averagePriority[item.vote_type] = 0;
      }
      analytics.averagePriority[item.vote_type] += item.priority_score;
      
      // Count reservations
      if (item.reserved_until && new Date(item.reserved_until) > now) {
        reservedCount++;
      }
      
      // Track age
      const createdAt = new Date(item.created_at);
      if (!analytics.oldestItem || createdAt < analytics.oldestItem) {
        analytics.oldestItem = createdAt;
      }
      if (!analytics.newestItem || createdAt > analytics.newestItem) {
        analytics.newestItem = createdAt;
      }
    });

    // Calculate averages
    Object.keys(analytics.averagePriority).forEach(type => {
      analytics.averagePriority[type] = Math.round(
        analytics.averagePriority[type] / analytics.byType[type]
      );
    });

    analytics.reservationRate = data.length > 0 ? reservedCount / data.length : 0;

    return { success: true, analytics };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}