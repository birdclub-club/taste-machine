// 🔄 Adaptive Queue Refill System
// Refills the queue during prize breaks and user downtime

import { supabase } from './supabase';

export interface QueueRefillOptions {
  breakDurationMs: number;
  userVoteCount: number;
  priorityMode?: 'balanced' | 'speed' | 'quality';
}

export interface RefillResult {
  success: boolean;
  added: {
    slider: number;
    same_coll: number;
    cross_coll: number;
    total: number;
  };
  queueStatus: {
    slider: number;
    same_coll: number;
    cross_coll: number;
    total: number;
  };
  refillTime: number;
}

// 🎯 Smart refill based on break duration and context
export async function refillQueueDuringBreak(options: QueueRefillOptions): Promise<RefillResult> {
  const startTime = Date.now();
  const { breakDurationMs, userVoteCount, priorityMode = 'balanced' } = options;
  
  console.log(`🔄 Starting queue refill during ${breakDurationMs}ms break`);
  
  try {
    // Calculate how much to refill based on break duration
    const refillCounts = calculateRefillCounts(breakDurationMs, userVoteCount, priorityMode);
    
    const results = await Promise.all([
      addSliderVotesToQueue(refillCounts.slider),
      addSameCollMatchupsToQueue(refillCounts.same_coll),
      addCrossCollMatchupsToQueue(refillCounts.cross_coll)
    ]);
    
    const added = {
      slider: results[0],
      same_coll: results[1],
      cross_coll: results[2],
      total: results[0] + results[1] + results[2]
    };
    
    // Get current queue status
    const queueStatus = await getQueueStatus();
    
    const refillTime = Date.now() - startTime;
    
    console.log(`✅ Refill complete: +${added.total} matchups in ${refillTime}ms`);
    
    return {
      success: true,
      added,
      queueStatus,
      refillTime
    };
    
  } catch (error) {
    console.error('❌ Queue refill failed:', error);
    const queueStatus = await getQueueStatus();
    
    return {
      success: false,
      added: { slider: 0, same_coll: 0, cross_coll: 0, total: 0 },
      queueStatus,
      refillTime: Date.now() - startTime
    };
  }
}

// 📊 Calculate optimal refill counts based on context
function calculateRefillCounts(
  breakDurationMs: number, 
  userVoteCount: number, 
  priorityMode: 'balanced' | 'speed' | 'quality'
): { slider: number; same_coll: number; cross_coll: number } {
  
  // Base counts for different break durations
  let baseMultiplier = 1;
  
  if (breakDurationMs >= 30000) {        // 30+ seconds = long break
    baseMultiplier = 3;
  } else if (breakDurationMs >= 15000) { // 15-30 seconds = medium break
    baseMultiplier = 2;
  } else if (breakDurationMs >= 5000) {  // 5-15 seconds = short break
    baseMultiplier = 1;
  } else {                               // <5 seconds = quick break
    baseMultiplier = 0.5;
  }
  
  // Adjust based on user engagement level
  const engagementMultiplier = Math.min(2, userVoteCount / 50); // More engaged = more refill
  
  const totalMultiplier = baseMultiplier * (0.5 + engagementMultiplier);
  
  // Base distribution based on priority mode
  let baseCounts: { slider: number; same_coll: number; cross_coll: number };
  
  switch (priorityMode) {
    case 'speed':
      // Prioritize simple matchups for speed
      baseCounts = { slider: 5, same_coll: 8, cross_coll: 2 };
      break;
    case 'quality':
      // Prioritize slider votes for better data
      baseCounts = { slider: 10, same_coll: 3, cross_coll: 2 };
      break;
    default: // 'balanced'
      baseCounts = { slider: 7, same_coll: 5, cross_coll: 3 };
  }
  
  // Apply multiplier and round
  return {
    slider: Math.round(baseCounts.slider * totalMultiplier),
    same_coll: Math.round(baseCounts.same_coll * totalMultiplier),
    cross_coll: Math.round(baseCounts.cross_coll * totalMultiplier)
  };
}

// 🎚️ Add slider votes to queue
async function addSliderVotesToQueue(count: number): Promise<number> {
  if (count <= 0) return 0;
  
  try {
    const { data: nfts, error } = await supabase
      .from('nfts')
      .select('id, slider_count, total_votes')
      .lt('slider_count', 10)
      .not('id', 'in', `(SELECT slider_nft_id FROM matchup_queue WHERE vote_type = 'slider' AND slider_nft_id IS NOT NULL)`)
      .order('slider_count', { ascending: true })
      .order('total_votes', { ascending: true })
      .limit(count);
    
    if (error || !nfts || nfts.length === 0) return 0;
    
    const queueItems = nfts.map(nft => ({
      vote_type: 'slider',
      slider_nft_id: nft.id,
      priority_score: (10 - nft.slider_count) * 10 + (20 - Math.min(nft.total_votes, 20))
    }));
    
    const { error: insertError } = await supabase
      .from('matchup_queue')
      .insert(queueItems);
    
    if (insertError) throw insertError;
    
    return nfts.length;
  } catch (error) {
    console.error('❌ Error adding slider votes:', error);
    return 0;
  }
}

// 🥊 Add same collection matchups to queue
async function addSameCollMatchupsToQueue(count: number): Promise<number> {
  if (count <= 0) return 0;
  
  try {
    const { data: nfts, error } = await supabase
      .from('nfts')
      .select('id, collection_name, current_elo, total_votes')
      .order('total_votes', { ascending: true })
      .limit(count * 4); // Get more than needed for matching
    
    if (error || !nfts || nfts.length < 2) return 0;
    
    const matchups = [];
    const used = new Set();
    
    // Create same collection matchups
    for (let i = 0; i < nfts.length && matchups.length < count; i++) {
      if (used.has(nfts[i].id)) continue;
      
      for (let j = i + 1; j < nfts.length && matchups.length < count; j++) {
        if (used.has(nfts[j].id)) continue;
        
        const nft1 = nfts[i];
        const nft2 = nfts[j];
        
        if (nft1.collection_name === nft2.collection_name) {
          const eloDiff = Math.abs(nft1.current_elo - nft2.current_elo);
          
          matchups.push({
            vote_type: 'same_coll',
            nft_a_id: nft1.id,
            nft_b_id: nft2.id,
            elo_diff: eloDiff,
            priority_score: Math.max(50, 100 - eloDiff)
          });
          
          used.add(nft1.id);
          used.add(nft2.id);
          break;
        }
      }
    }
    
    if (matchups.length === 0) return 0;
    
    const { error: insertError } = await supabase
      .from('matchup_queue')
      .insert(matchups);
    
    if (insertError) throw insertError;
    
    return matchups.length;
  } catch (error) {
    console.error('❌ Error adding same collection matchups:', error);
    return 0;
  }
}

// 🌍 Add cross collection matchups to queue
async function addCrossCollMatchupsToQueue(count: number): Promise<number> {
  if (count <= 0) return 0;
  
  try {
    const { data: nfts, error } = await supabase
      .from('nfts')
      .select('id, collection_name, current_elo, total_votes')
      .order('total_votes', { ascending: true })
      .limit(count * 6); // Need more for cross-collection matching
    
    if (error || !nfts || nfts.length < 2) return 0;
    
    const matchups = [];
    const used = new Set();
    
    // Create cross collection matchups
    for (let i = 0; i < nfts.length && matchups.length < count; i++) {
      if (used.has(nfts[i].id)) continue;
      
      for (let j = i + 1; j < nfts.length && matchups.length < count; j++) {
        if (used.has(nfts[j].id)) continue;
        
        const nft1 = nfts[i];
        const nft2 = nfts[j];
        
        if (nft1.collection_name !== nft2.collection_name) {
          const eloDiff = Math.abs(nft1.current_elo - nft2.current_elo);
          
          // Prefer moderate Elo differences for cross-collection
          if (eloDiff >= 25 && eloDiff <= 300) {
            matchups.push({
              vote_type: 'cross_coll',
              nft_a_id: nft1.id,
              nft_b_id: nft2.id,
              elo_diff: eloDiff,
              priority_score: eloDiff >= 50 && eloDiff <= 150 ? 75 : 50
            });
            
            used.add(nft1.id);
            used.add(nft2.id);
            break;
          }
        }
      }
    }
    
    if (matchups.length === 0) return 0;
    
    const { error: insertError } = await supabase
      .from('matchup_queue')
      .insert(matchups);
    
    if (insertError) throw insertError;
    
    return matchups.length;
  } catch (error) {
    console.error('❌ Error adding cross collection matchups:', error);
    return 0;
  }
}

// 📊 Get current queue status
async function getQueueStatus(): Promise<{ slider: number; same_coll: number; cross_coll: number; total: number }> {
  try {
    const { data, error } = await supabase
      .from('matchup_queue')
      .select('vote_type')
      .or('reserved_until.is.null,reserved_until.lt.now()');
    
    if (error) throw error;
    
    const counts = { slider: 0, same_coll: 0, cross_coll: 0, total: 0 };
    
    if (data) {
      data.forEach(item => {
        counts[item.vote_type as keyof typeof counts]++;
        counts.total++;
      });
    }
    
    return counts;
  } catch (error) {
    console.error('❌ Error getting queue status:', error);
    return { slider: 0, same_coll: 0, cross_coll: 0, total: 0 };
  }
}

// 🎮 Prize break refill (optimized for game flow)
export async function refillDuringPrizeBreak(
  voteCount: number,
  breakStartTime: number
): Promise<RefillResult> {
  const currentTime = Date.now();
  const breakDuration = currentTime - breakStartTime;
  
  // Determine priority mode based on vote count
  let priorityMode: 'balanced' | 'speed' | 'quality' = 'balanced';
  
  if (voteCount < 20) {
    priorityMode = 'quality'; // Early game - focus on getting good data
  } else if (voteCount > 100) {
    priorityMode = 'speed'; // High engagement - keep them moving
  }
  
  return await refillQueueDuringBreak({
    breakDurationMs: Math.max(breakDuration, 5000), // Minimum 5 second break
    userVoteCount: voteCount,
    priorityMode
  });
}

// 🔧 Background refill (for maintenance)
export async function backgroundRefill(): Promise<RefillResult> {
  return await refillQueueDuringBreak({
    breakDurationMs: 10000, // Assume 10 second maintenance window
    userVoteCount: 50, // Average user
    priorityMode: 'balanced'
  });
}