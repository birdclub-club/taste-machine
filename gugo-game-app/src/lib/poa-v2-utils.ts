/**
 * 🧮 POA v2 Computation Utilities
 * 
 * Implements the new Bayesian POA scoring system with:
 * - Glicko-lite Elo updates with uncertainty
 * - Per-user slider normalization
 * - Reliability-weighted scoring
 * - Confidence-aware aggregation
 */

export interface EloUpdate {
  mean: number;
  sigma: number;
}

export interface UserStats {
  slider_mean: number;
  slider_std: number;
  slider_count: number;
  reliability_score: number;
  reliability_count: number;
}

export interface POAv2Components {
  elo_component: number;      // 0-100
  slider_component: number;   // 0-100
  fire_component: number;     // 0-100
  confidence: number;         // 0-100
  avg_reliability: number;    // 0.5-1.5
}

export interface POAv2Result {
  poa_v2: number;
  components: POAv2Components;
  explanation: string;
}

/**
 * Constants for POA v2 system
 */
export const POA_V2_CONSTANTS = {
  // Elo system
  ELO_BASE_K: 32,
  ELO_SUPER_K: 64,
  ELO_SIGMA_FLOOR: 50,
  ELO_SIGMA_DECAY: 10,
  ELO_SIGMA_SHRINK: 0.98,
  
  // User stats
  DEFAULT_SLIDER_MEAN: 50,
  DEFAULT_SLIDER_STD: 15,
  MIN_SLIDER_STD: 5,
  DEFAULT_RELIABILITY: 1.0,
  RELIABILITY_MIN: 0.5,
  RELIABILITY_MAX: 1.5,
  RELIABILITY_ALPHA: 0.10,
  
  // POA v2 weights
  ELO_WEIGHT: 0.40,
  SLIDER_WEIGHT: 0.30,
  FIRE_WEIGHT: 0.30,
  
  // Normalization ranges
  ELO_MIN: 800,
  ELO_MAX: 2000,
  SIGMA_MAX: 400,
  Z_SCORE_CLAMP: 2.5,
};

/**
 * Calculate expected score for Elo system
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update Elo rating using Glicko-lite approach
 */
export function updateEloBayesian(
  currentMean: number,
  currentSigma: number,
  opponentMean: number,
  score: number, // 1 for win, 0 for loss
  isSuperVote: boolean = false
): EloUpdate {
  const { ELO_BASE_K, ELO_SUPER_K, ELO_SIGMA_FLOOR, ELO_SIGMA_DECAY, ELO_SIGMA_SHRINK } = POA_V2_CONSTANTS;
  
  const kFactor = isSuperVote ? ELO_SUPER_K : ELO_BASE_K;
  const expectedScore = calculateExpectedScore(currentMean, opponentMean);
  const delta = kFactor * (score - expectedScore);
  
  const newMean = currentMean + delta;
  
  // Shrink sigma as matches accumulate; add small decay between matches
  const newSigma = Math.max(
    ELO_SIGMA_FLOOR,
    Math.min(POA_V2_CONSTANTS.SIGMA_MAX, 
      Math.sqrt(currentSigma * currentSigma + ELO_SIGMA_DECAY * ELO_SIGMA_DECAY) * ELO_SIGMA_SHRINK
    )
  );
  
  return { mean: newMean, sigma: newSigma };
}

/**
 * Update user running statistics using Welford's online algorithm
 */
export function updateUserStats(
  currentStats: UserStats,
  newSliderValue: number
): UserStats {
  const { MIN_SLIDER_STD } = POA_V2_CONSTANTS;
  
  const count = currentStats.slider_count + 1;
  const delta = newSliderValue - currentStats.slider_mean;
  const newMean = currentStats.slider_mean + delta / count;
  
  // Welford's algorithm for online variance
  const delta2 = newSliderValue - newMean;
  const M2 = (currentStats.slider_std * currentStats.slider_std * (currentStats.slider_count - 1)) + delta * delta2;
  const variance = count > 1 ? M2 / (count - 1) : 225; // fallback variance ~ 15^2
  const newStd = Math.max(MIN_SLIDER_STD, Math.sqrt(variance));
  
  return {
    ...currentStats,
    slider_mean: newMean,
    slider_std: newStd,
    slider_count: count,
  };
}

/**
 * Normalize slider value using user's personal statistics
 */
export function normalizeSliderValue(
  rawSlider: number,
  userMean: number,
  userStd: number
): number {
  const { Z_SCORE_CLAMP } = POA_V2_CONSTANTS;
  
  // Convert to z-score
  const z = (rawSlider - userMean) / userStd;
  
  // Clamp to reasonable range
  const zClamped = Math.max(-Z_SCORE_CLAMP, Math.min(Z_SCORE_CLAMP, z));
  
  // Map back to [0, 100]
  const normalized = ((zClamped + Z_SCORE_CLAMP) / (2 * Z_SCORE_CLAMP)) * 100;
  
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Update user reliability score based on alignment with consensus
 */
export function updateReliabilityScore(
  currentReliability: number,
  resultAligned: boolean,
  matchDifficulty: number = 0.5 // 0 = easy call, 1 = hard call
): number {
  const { RELIABILITY_ALPHA, RELIABILITY_MIN, RELIABILITY_MAX } = POA_V2_CONSTANTS;
  
  // Weight learning by match difficulty
  const difficultyWeight = 0.5 + matchDifficulty * 0.5; // 0.5 to 1.0
  const alpha = RELIABILITY_ALPHA * difficultyWeight;
  
  const target = resultAligned ? 1.2 : 0.8;
  const newReliability = currentReliability + alpha * (target - 1.0);
  
  return Math.max(RELIABILITY_MIN, Math.min(RELIABILITY_MAX, newReliability));
}

/**
 * Calculate FIRE component with diminishing returns
 */
export function calculateFireComponent(
  reliabilityAdjustedFireCount: number
): number {
  // Log-scaling with base 4 for strong early impact, then taper
  return Math.min(100, (Math.log(1 + reliabilityAdjustedFireCount) / Math.log(4)) * 100);
}

/**
 * Compute POA v2 score from components
 */
export function computePOAv2(
  eloMean: number,
  eloSigma: number,
  normalizedSlider: number,
  fireComponent: number,
  avgReliability: number
): POAv2Result {
  const { ELO_MIN, ELO_MAX, SIGMA_MAX, ELO_WEIGHT, SLIDER_WEIGHT, FIRE_WEIGHT } = POA_V2_CONSTANTS;
  
  // Normalize Elo to 0-100
  const eloComponent = Math.max(0, Math.min(100, 
    ((eloMean - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100
  ));
  
  // Calculate confidence from Elo uncertainty (lower sigma = higher confidence)
  const confidence = Math.max(0, Math.min(100, 
    (1.0 - (eloSigma / SIGMA_MAX)) * 100
  ));
  
  // Reliability-adjusted components
  const reliabilityAdjustedElo = eloComponent * avgReliability;
  const reliabilityAdjustedSlider = normalizedSlider * avgReliability;
  const reliabilityAdjustedFire = fireComponent * avgReliability;
  
  // Final POA v2 score
  const poa_v2 = Math.min(100,
    (ELO_WEIGHT * reliabilityAdjustedElo) +
    (SLIDER_WEIGHT * reliabilityAdjustedSlider) +
    (FIRE_WEIGHT * reliabilityAdjustedFire)
  );
  
  const components: POAv2Components = {
    elo_component: eloComponent,
    slider_component: normalizedSlider,
    fire_component: fireComponent,
    confidence,
    avg_reliability: avgReliability,
  };
  
  const explanation = `Elo: ${eloComponent.toFixed(1)}, Slider: ${normalizedSlider.toFixed(1)}, FIRE: ${fireComponent.toFixed(1)} (Reliability: ${avgReliability.toFixed(2)})`;
  
  return {
    poa_v2: Math.round(poa_v2 * 100) / 100, // Round to 2 decimal places
    components,
    explanation,
  };
}

/**
 * Development helper: Log POA v2 computation details
 */
export function logPOAv2Computation(result: POAv2Result, nftId: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🧮 POA v2 for ${nftId}:`, {
      score: result.poa_v2,
      components: result.components,
      explanation: result.explanation,
    });
  }
}

