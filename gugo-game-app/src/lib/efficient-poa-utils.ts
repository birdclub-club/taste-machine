/**
 * Efficient POA Update Pipeline - Core Utilities
 * 
 * Implements the event-driven, incremental, debounced POA scoring system
 */

// =====================================================
// CORE ALGORITHM IMPLEMENTATIONS
// =====================================================

const q = Math.log(10) / 400;
const sigmaFloor = 50;
const c = 10; // slight sigma drift toward uncertainty

/**
 * Calculate expected score for Elo matchup
 */
export function expected(Ra: number, Rb: number): number {
  return 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
}

/**
 * Bayesian-ish Elo update (Glicko-lite)
 */
export function updateEloBayes(
  R: number, 
  sigma: number, 
  Ropp: number, 
  S: number, 
  k: number = 32
): { mean: number; sigma: number } {
  const E = expected(R, Ropp);
  const delta = k * (S - E);
  const mean = R + delta;
  
  // Gradual sigma increase with floor/ceiling
  const sigma2 = Math.max(
    sigmaFloor, 
    Math.min(400, Math.sqrt(sigma * sigma + c * c) * 0.98)
  );
  
  return { mean, sigma: sigma2 };
}

/**
 * Welford online algorithm for running statistics
 */
export function updateRunningStats(
  mean: number, 
  M2: number, 
  count: number, 
  x: number
): { mean: number; M2: number; count: number; std: number } {
  const n = count + 1;
  const delta = x - mean;
  const newMean = mean + delta / n;
  const newM2 = M2 + delta * (x - newMean);
  
  // Calculate variance and std with sensible defaults
  const variance = n > 1 ? newM2 / (n - 1) : 225; // ~15^2 default early
  const std = Math.max(5, Math.sqrt(variance));
  
  return { 
    mean: newMean, 
    M2: newM2, 
    count: n, 
    std 
  };
}

/**
 * Normalize slider score using user's calibration
 */
export function normalizeSlider(
  raw: number, 
  userMean: number, 
  userStd: number
): number {
  const z = (raw - userMean) / userStd;
  const zClamped = Math.max(-2.5, Math.min(2.5, z)); // Clamp to reasonable range
  return ((zClamped + 2.5) / 5) * 100; // Map to [0,100]
}

/**
 * Update voter reliability score
 */
export function updateReliability(
  currentReliability: number, 
  aligned: boolean, 
  alpha: number = 0.10
): number {
  const target = aligned ? 1.2 : 0.8; // >1 boosts, <1 reduces
  const adjustment = alpha * (target - 1.0);
  const newReliability = currentReliability + adjustment;
  
  // Clamp to reasonable bounds
  return Math.max(0.5, Math.min(1.5, newReliability));
}

/**
 * Compute POA v2 from incremental stats (no history scans)
 */
export function computePOAFromStats(stats: {
  elo_mean: number;
  elo_sigma: number;
  slider_sum_w: number;
  slider_weight: number;
  fire_sum_w: number;
  avg_rater_rel: number;
  total_votes: number;
  total_sliders: number;
}): {
  poa_v2: number;
  elo_component: number;
  slider_component: number;
  fire_component: number;
  reliability_factor: number;
  confidence: number;
  provisional: boolean;
} {
  // Component calculations
  const elo0to100 = Math.max(0, Math.min(100, ((stats.elo_mean - 800) / 600) * 100));
  
  const sliderMean = stats.slider_weight > 0 
    ? (stats.slider_sum_w / stats.slider_weight) 
    : 50; // Default neutral
    
  const fire0to100 = Math.min(100, (Math.log(1 + stats.fire_sum_w) / Math.log(4)) * 100);
  
  const reliabilityFactor = stats.avg_rater_rel || 1.0;
  
  // Weighted components with reliability
  const eloComponent = elo0to100 * reliabilityFactor;
  const sliderComponent = sliderMean * reliabilityFactor;
  const fireComponent = fire0to100 * reliabilityFactor;
  
  // Final POA calculation
  const rawPOA = (0.40 * eloComponent) + (0.30 * sliderComponent) + (0.30 * fireComponent);
  const poa_v2 = Math.max(0, Math.min(100, rawPOA));
  
  // Calculate confidence based on data availability
  const confidence = calculateConfidence(stats);
  
  // Determine if provisional
  const provisional = isProvisional(stats, confidence);
  
  return {
    poa_v2: Math.round(poa_v2 * 100) / 100,
    elo_component: Math.round(eloComponent * 100) / 100,
    slider_component: Math.round(sliderComponent * 100) / 100,
    fire_component: Math.round(fireComponent * 100) / 100,
    reliability_factor: Math.round(reliabilityFactor * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    provisional
  };
}

/**
 * Calculate confidence score based on data quality
 */
export function calculateConfidence(stats: {
  elo_sigma: number;
  total_votes: number;
  total_sliders: number;
}): number {
  // Elo uncertainty factor (lower sigma = higher confidence)
  const eloConfidence = Math.max(0, Math.min(100, (400 - stats.elo_sigma) / 350 * 100));
  
  // Vote depth factor
  const voteConfidence = Math.min(100, (stats.total_votes / 10) * 100);
  
  // Slider depth factor
  const sliderConfidence = Math.min(100, (stats.total_sliders / 5) * 100);
  
  // Combined confidence (weighted average)
  const confidence = (
    0.5 * eloConfidence +
    0.3 * voteConfidence +
    0.2 * sliderConfidence
  );
  
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Determine if score should be marked as provisional
 */
export function isProvisional(
  stats: {
    total_votes: number;
    total_sliders: number;
  },
  confidence: number
): boolean {
  // Minimum data requirements
  const minVotes = 5;
  const minSliders = 2;
  const minConfidence = 30;
  
  return (
    stats.total_votes < minVotes ||
    stats.total_sliders < minSliders ||
    confidence < minConfidence
  );
}

/**
 * Determine if a score change is significant enough to publish
 */
export function shouldPublishUpdate(
  oldScore: number | null,
  newScore: number,
  oldConfidence: number | null,
  newConfidence: number,
  threshold: number = 0.5
): boolean {
  // Always publish if no previous score
  if (oldScore === null) return true;
  
  // Publish if POA change is significant
  if (Math.abs(newScore - oldScore) >= threshold) return true;
  
  // Publish if confidence changed significantly
  if (oldConfidence !== null && Math.abs(newConfidence - oldConfidence) >= 5) return true;
  
  // Publish if crossing quality tiers (e.g., 39.5-40.5 boundary)
  const qualityTiers = [20, 30, 40, 50, 60, 70, 80];
  for (const tier of qualityTiers) {
    const oldTier = oldScore >= tier;
    const newTier = newScore >= tier;
    if (oldTier !== newTier) return true;
  }
  
  return false;
}

// =====================================================
// EVENT PROCESSING TYPES
// =====================================================

export interface VoteEvent {
  id: number;
  voter_id: string;
  nft_a_id: string;
  nft_b_id: string;
  winner_id: string;
  elo_pre_a: number;
  elo_pre_b: number;
  vote_type: 'normal' | 'super';
  created_at: string;
}

export interface SliderEvent {
  id: number;
  voter_id: string;
  nft_id: string;
  raw_score: number;
  created_at: string;
}

export interface FireEvent {
  id: number;
  voter_id: string;
  nft_id: string;
  created_at: string;
}

export interface NFTStats {
  nft_id: string;
  elo_mean: number;
  elo_sigma: number;
  last_processed_vote_id: number;
  last_processed_slider_id: number;
  last_processed_fire_id: number;
  slider_sum_w: number;
  slider_weight: number;
  fire_sum_w: number;
  avg_rater_rel: number;
  total_votes: number;
  total_sliders: number;
  total_fires: number;
  updated_at: string;
}

export interface UserCalibration {
  id: string;
  slider_mean: number;
  slider_std: number;
  slider_m2: number;
  slider_count: number;
  reliability_score: number;
  reliability_count: number;
}

export interface PublishedScore {
  nft_id: string;
  poa_v2: number;
  elo_mean: number;
  elo_sigma: number;
  confidence: number;
  provisional: boolean;
  elo_component: number;
  slider_component: number;
  fire_component: number;
  reliability_factor: number;
  updated_at: string;
}

// =====================================================
// BATCH PROCESSING UTILITIES
// =====================================================

/**
 * Get K-factor for vote type
 */
export function getKFactor(voteType: string): number {
  switch (voteType) {
    case 'super': return 64;
    case 'normal': 
    default: return 32;
  }
}

/**
 * Calculate exponential moving average
 */
export function updateEMA(current: number, newValue: number, alpha: number = 0.05): number {
  return current * (1 - alpha) + newValue * alpha;
}

/**
 * Add jitter to prevent thundering herd
 */
export function addJitter(baseDelayMs: number, jitterPercent: number = 0.2): number {
  const jitter = Math.random() * jitterPercent * baseDelayMs;
  return baseDelayMs + jitter;
}

/**
 * Batch array into smaller chunks
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}
