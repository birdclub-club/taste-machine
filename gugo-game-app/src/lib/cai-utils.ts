/**
 * Collection Aesthetic Index (CAI) Utilities - IMPROVED VERSION
 * 
 * Core calculation logic for CAI scoring system
 * 
 * Key improvements:
 * - Cohesion as penalty (not additive bonus)
 * - Data-driven confidence calculation
 * - Trimmed outliers for robustness
 * - Mean beauty drives rankings, cohesion nudges
 */

import { getCaiConfig, calculateCaiConfidence, getCaiRange } from './cai-config';

// Types for CAI calculations
export interface NFTData {
  id: string;
  poa_v2: number;
  total_votes: number;
  poa_v2_confidence?: number;
}

export interface CollectionData {
  collection_name: string;
  nfts: NFTData[];
  total_votes: number;
  active: boolean;
}

export interface CaiComponents {
  // Core aesthetic stats (trimmed for robustness)
  aesthetic_mean: number;
  aesthetic_std: number;
  trimmed_mean: number;
  trimmed_std: number;
  standard_error: number;
  
  // Derived scores
  cohesion_penalty: number;        // 0-30% penalty for high variance
  effective_mean: number;          // mean after cohesion penalty
  coverage_score: number;
  
  // Data-driven confidence components
  coverage_factor: number;         // scored/total NFTs
  depth_factor: number;           // avg votes vs target
  uncertainty_factor: number;     // based on standard error
  confidence: number;             // final 0-100 confidence
  
  // Counts and metadata
  nft_count: number;              // total NFTs in collection
  scored_nft_count: number;       // NFTs with POA v2 scores
  total_votes: number;
  avg_votes_per_nft: number;
  avg_votes_per_scored: number;   // votes per scored NFT
  
  // Status flags
  is_provisional: boolean;        // confidence < 70% or coverage < 20%
}

export interface CaiResult {
  cai_score: number;
  cai_confidence: number;
  cai_cohesion: number;           // kept for compatibility (= 100 - cohesion_penalty)
  cai_coverage: number;
  cai_components: CaiComponents;
  cai_explanation: string;
  computation_timestamp: string;
  collection_name: string;
}

/**
 * Calculate aesthetic statistics with outlier trimming
 * Uses only NFTs with POA v2 scores ("scored NFTs")
 */
export function calculateAestheticStats(nfts: NFTData[]): {
  mean: number;
  std: number;
  count: number;
  trimmed_mean: number;
  trimmed_std: number;
  trimmed_count: number;
  standard_error: number;
} {
  if (!nfts || nfts.length === 0) {
    return { mean: 0, std: 0, count: 0, trimmed_mean: 0, trimmed_std: 0, trimmed_count: 0, standard_error: 0 };
  }

  // Filter to only NFTs with POA v2 scores (the "scored NFTs")
  const scoredNfts = nfts.filter(nft => nft.poa_v2 !== null && nft.poa_v2 !== undefined);
  
  if (scoredNfts.length === 0) {
    return { mean: 0, std: 0, count: 0, trimmed_mean: 0, trimmed_std: 0, trimmed_count: 0, standard_error: 0 };
  }

  const scores = scoredNfts.map(nft => nft.poa_v2);
  
  // Calculate basic stats
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const std = Math.sqrt(variance);
  const standard_error = std / Math.sqrt(Math.max(1, scores.length));

  // Calculate trimmed stats (remove top/bottom 5% for outlier resistance)
  let trimmed_mean = mean;
  let trimmed_std = std;
  let trimmed_count = scores.length;

  if (scores.length >= 10) { // Only trim if we have enough data
    const sortedScores = [...scores].sort((a, b) => a - b);
    const trimPercent = 0.05; // 5%
    const trimCount = Math.floor(scores.length * trimPercent);
    
    if (trimCount > 0) {
      const trimmedScores = sortedScores.slice(trimCount, -trimCount);
      trimmed_count = trimmedScores.length;
      
      if (trimmedScores.length > 0) {
        trimmed_mean = trimmedScores.reduce((sum, score) => sum + score, 0) / trimmedScores.length;
        const trimmedVariance = trimmedScores.reduce((sum, score) => sum + Math.pow(score - trimmed_mean, 2), 0) / trimmedScores.length;
        trimmed_std = Math.sqrt(trimmedVariance);
      }
    }
  }

  return {
    mean,
    std,
    count: scoredNfts.length,
    trimmed_mean,
    trimmed_std,
    trimmed_count,
    standard_error,
  };
}

/**
 * Calculate cohesion penalty (replaces additive cohesion score)
 * Higher variance = higher penalty (up to 30%)
 */
export function calculateCohesionPenalty(std: number): number {
  // Normalize standard deviation to 0-1 range
  // std of 15+ gets full penalty, 0 gets no penalty
  const normalizedStd = Math.min(1.0, std / 15.0);
  
  // Apply penalty (0-30%)
  const penalty = 0.30 * normalizedStd;
  
  return penalty;
}

/**
 * Calculate coverage score based on evaluation depth and completeness
 */
export function calculateCoverageScore(
  totalNfts: number,
  scoredNfts: number,
  totalVotes: number
): { 
  coverage_score: number;
  coverage_factor: number;
  depth_factor: number;
  avg_votes_per_scored: number;
} {
  const config = getCaiConfig().coverage;
  
  if (totalNfts === 0 || scoredNfts === 0) {
    return { coverage_score: 0, coverage_factor: 0, depth_factor: 0, avg_votes_per_scored: 0 };
  }
  
  // Coverage factor: scored NFTs / total NFTs
  const coverage_factor = scoredNfts / totalNfts;
  
  // Depth factor: avg votes per scored NFT vs target
  const avg_votes_per_scored = totalVotes / scoredNfts;
  const depth_factor = Math.min(1.0, avg_votes_per_scored / config.target_votes_per_nft);
  
  // Combined coverage score (0-100)
  const coverage_score = (
    coverage_factor * config.evaluation_completeness_weight +
    depth_factor * config.vote_depth_weight
  ) * 100;
  
  return {
    coverage_score: Math.round(coverage_score * 100) / 100,
    coverage_factor,
    depth_factor,
    avg_votes_per_scored,
  };
}

/**
 * Calculate data-driven confidence (replaces binary 100%)
 */
export function calculateDataDrivenConfidence(
  scoredCount: number,
  totalNfts: number,
  avgVotesPerScored: number,
  standardError: number
): {
  confidence: number;
  coverage_factor: number;
  depth_factor: number;
  uncertainty_factor: number;
  is_provisional: boolean;
} {
  const config = getCaiConfig().coverage;
  
  // Coverage factor (scored/total)
  const coverage_factor = totalNfts > 0 ? scoredCount / totalNfts : 0;
  
  // Depth factor (avg votes per scored vs target, capped at 1)
  const depth_factor = Math.min(1.0, avgVotesPerScored / config.target_votes_per_nft);
  
  // Uncertainty factor (based on standard error, lower is better)
  const uncertainty_factor = Math.min(1.0, Math.max(0.0, 1 - standardError / 10.0));
  
  // Combined confidence (0-100)
  const confidence = Math.round(100 * (
    0.5 * coverage_factor +
    0.3 * depth_factor +
    0.2 * uncertainty_factor
  ));
  
  // Mark as provisional if confidence < 70% or coverage < 20%
  const is_provisional = confidence < 70 || (coverage_factor * 100) < 20;
  
  return {
    confidence,
    coverage_factor,
    depth_factor,
    uncertainty_factor,
    is_provisional,
  };
}

/**
 * Calculate the main CAI score using the improved penalty-based approach
 */
export function calculateCaiScore(
  trimmedMean: number,
  cohesionPenalty: number,
  coverageScore: number
): { cai_score: number; effective_mean: number } {
  // Apply cohesion penalty to the mean (penalty reduces effective mean)
  const effective_mean = trimmedMean * (1.0 - cohesionPenalty);
  
  // Final CAI: 80% effective mean + 20% coverage
  const cai_score = 0.80 * effective_mean + 0.20 * coverageScore;
  
  return {
    cai_score: Math.round(cai_score * 100) / 100,
    effective_mean: Math.round(effective_mean * 100) / 100,
  };
}

/**
 * Generate human-readable explanation of CAI score
 */
export function generateCaiExplanation(components: CaiComponents): string {
  const { trimmed_mean, cohesion_penalty, coverage_score, scored_nft_count, total_votes, is_provisional } = components;
  
  // Determine quality level based on trimmed mean
  let qualityLevel = 'Unknown';
  if (trimmed_mean >= 60) qualityLevel = 'Exceptional';
  else if (trimmed_mean >= 50) qualityLevel = 'Above Average';
  else if (trimmed_mean >= 40) qualityLevel = 'Average';
  else if (trimmed_mean >= 30) qualityLevel = 'Below Average';
  else qualityLevel = 'Poor';
  
  // Determine cohesion level based on penalty
  let cohesionLevel = 'Perfect';
  if (cohesion_penalty > 0.20) cohesionLevel = 'Low';
  else if (cohesion_penalty > 0.10) cohesionLevel = 'Moderate';
  else if (cohesion_penalty > 0.05) cohesionLevel = 'Good';
  
  // Determine coverage level
  let coverageLevel = 'Excellent';
  if (coverage_score < 40) coverageLevel = 'Poor';
  else if (coverage_score < 60) coverageLevel = 'Moderate';
  else if (coverage_score < 80) coverageLevel = 'Good';
  
  const provisionalText = is_provisional ? ' (Provisional)' : '';
  const penaltyText = cohesion_penalty > 0.01 ? ` with ${Math.round(cohesion_penalty * 100)}% cohesion penalty` : '';
  
  return `${qualityLevel} aesthetic quality (${trimmed_mean.toFixed(1)} mean)${penaltyText}, ${cohesionLevel.toLowerCase()} consistency, ${coverageLevel.toLowerCase()} evaluation coverage (${coverage_score.toFixed(1)}%). Based on ${scored_nft_count} scored NFTs with ${total_votes} total votes${provisionalText}.`;
}

/**
 * Validate collection data for CAI computation
 */
export function validateCollectionForCAI(collection: CollectionData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if collection is active
  if (!collection.active) {
    errors.push('Collection is not active');
  }
  
  // Check if we have NFTs
  if (!collection.nfts || collection.nfts.length === 0) {
    errors.push('No NFTs found in collection');
    return { isValid: false, errors, warnings };
  }
  
  // Check for NFTs with POA v2 scores
  const scoredNfts = collection.nfts.filter(nft => nft.poa_v2 !== null && nft.poa_v2 !== undefined);
  if (scoredNfts.length === 0) {
    errors.push('No NFTs with POA v2 scores found');
    return { isValid: false, errors, warnings };
  }
  
  // Warnings for data quality
  if (scoredNfts.length < 5) {
    warnings.push('Very few NFTs with scores - results may be unreliable');
  }
  
  if (collection.total_votes < 50) {
    warnings.push('Low vote count - confidence will be reduced');
  }
  
  const coveragePercent = (scoredNfts.length / collection.nfts.length) * 100;
  if (coveragePercent < 20) {
    warnings.push('Low coverage - most NFTs lack scores');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Main CAI computation function using the improved algorithm
 */
export function computeCAI(collection: CollectionData): CaiResult {
  const timestamp = new Date().toISOString();
  
  // Calculate aesthetic statistics with trimming
  const aestheticStats = calculateAestheticStats(collection.nfts);
  
  // Calculate cohesion penalty (not additive score)
  const cohesion_penalty = calculateCohesionPenalty(aestheticStats.trimmed_std);
  
  // Calculate coverage metrics
  const coverageMetrics = calculateCoverageScore(
    collection.nfts.length,
    aestheticStats.count,
    collection.total_votes
  );
  
  // Calculate data-driven confidence
  const confidenceMetrics = calculateDataDrivenConfidence(
    aestheticStats.count,
    collection.nfts.length,
    coverageMetrics.avg_votes_per_scored,
    aestheticStats.standard_error
  );
  
  // Calculate final CAI score
  const { cai_score, effective_mean } = calculateCaiScore(
    aestheticStats.trimmed_mean,
    cohesion_penalty,
    coverageMetrics.coverage_score
  );
  
  // Build comprehensive components object
  const components: CaiComponents = {
    // Core aesthetic stats
    aesthetic_mean: Math.round(aestheticStats.mean * 100) / 100,
    aesthetic_std: Math.round(aestheticStats.std * 100) / 100,
    trimmed_mean: Math.round(aestheticStats.trimmed_mean * 100) / 100,
    trimmed_std: Math.round(aestheticStats.trimmed_std * 100) / 100,
    standard_error: Math.round(aestheticStats.standard_error * 100) / 100,
    
    // Derived scores
    cohesion_penalty: Math.round(cohesion_penalty * 10000) / 10000, // as decimal (0-0.30)
    effective_mean,
    coverage_score: coverageMetrics.coverage_score,
    
    // Confidence components
    coverage_factor: Math.round(confidenceMetrics.coverage_factor * 10000) / 100,
    depth_factor: Math.round(confidenceMetrics.depth_factor * 10000) / 100,
    uncertainty_factor: Math.round(confidenceMetrics.uncertainty_factor * 10000) / 100,
    confidence: confidenceMetrics.confidence,
    
    // Counts
    nft_count: collection.nfts.length,
    scored_nft_count: aestheticStats.count,
    total_votes: collection.total_votes,
    avg_votes_per_nft: Math.round((collection.total_votes / collection.nfts.length) * 100) / 100,
    avg_votes_per_scored: Math.round(coverageMetrics.avg_votes_per_scored * 100) / 100,
    
    // Status
    is_provisional: confidenceMetrics.is_provisional,
  };
  
  // Generate explanation
  const explanation = generateCaiExplanation(components);
  
  return {
    cai_score,
    cai_confidence: components.confidence,
    cai_cohesion: Math.round((100 - components.cohesion_penalty) * 100) / 100, // for compatibility
    cai_coverage: components.coverage_score,
    cai_components: components,
    cai_explanation: explanation,
    computation_timestamp: timestamp,
    collection_name: collection.collection_name,
  };
}