/**
 * Collection Aesthetic Index (CAI) Configuration
 * 
 * Defines parameters and constants for CAI calculation system
 */

export const CAI_CONSTANTS = {
  // CAI Calculation Weights
  weights: {
    aesthetic_mean: 0.40,    // Average POA v2 score of collection
    cohesion: 0.30,          // Consistency of aesthetics (lower std-dev = higher cohesion)
    coverage: 0.30,          // How well evaluated the collection is
  },

  // Cohesion Calculation (based on POA v2 standard deviation)
  cohesion: {
    max_std_dev: 25,         // Standard deviation that results in 0 cohesion
    min_std_dev: 2,          // Standard deviation that results in 100 cohesion
    curve_factor: 2,         // Exponential curve factor for cohesion scoring
  },

  // Coverage Calculation (based on vote depth and distribution)
  coverage: {
    min_votes_per_nft: 5,    // Minimum votes needed for basic coverage
    target_votes_per_nft: 20, // Target votes for full coverage
    min_nfts_for_coverage: 3, // Minimum NFTs needed for meaningful coverage
    evaluation_completeness_weight: 0.6, // Weight for how many NFTs are evaluated
    vote_depth_weight: 0.4,   // Weight for average votes per NFT
  },

  // Confidence Calculation
  confidence: {
    min_nfts: 5,             // Minimum NFTs for any confidence
    target_nfts: 20,         // Target NFTs for high confidence
    min_total_votes: 25,     // Minimum total votes for any confidence
    target_total_votes: 200, // Target total votes for high confidence
    recency_weight: 0.2,     // Weight for how recent the data is
    max_age_days: 30,        // Age in days that reduces confidence to 0
  },

  // Thresholds for computation triggers
  thresholds: {
    new_nft_trigger: 1,      // Recompute CAI when new NFT added
    vote_change_trigger: 10, // Recompute when 10+ new votes on collection
    poa_change_threshold: 5, // Recompute when POA v2 changes by 5+ points
    staleness_hours: 24,     // Recompute if CAI older than 24 hours
  },

  // Quality filters
  quality: {
    min_collection_size: 2,  // Minimum NFTs to calculate CAI
    max_collection_size: 10000, // Maximum NFTs (sanity check)
    exclude_test_collections: true, // Exclude collections marked as test
  },

  // Batch processing limits
  batch: {
    max_concurrent: 3,       // Maximum concurrent CAI computations
    timeout_minutes: 10,     // Timeout for single CAI computation
    retry_attempts: 2,       // Number of retry attempts on failure
    delay_between_ms: 1000,  // Delay between computations in batch
  },
};

// CAI Score Interpretation Ranges
export const CAI_RANGES = {
  exceptional: { min: 80, max: 100, label: 'Exceptional', description: 'Outstanding aesthetic quality and consistency' },
  excellent: { min: 70, max: 79, label: 'Excellent', description: 'High aesthetic quality with good consistency' },
  good: { min: 60, max: 69, label: 'Good', description: 'Above average aesthetic quality' },
  average: { min: 40, max: 59, label: 'Average', description: 'Moderate aesthetic quality' },
  below_average: { min: 20, max: 39, label: 'Below Average', description: 'Lower aesthetic quality' },
  poor: { min: 0, max: 19, label: 'Poor', description: 'Inconsistent or low aesthetic quality' },
};

// Get CAI configuration with validation
export function getCaiConfig() {
  const config = CAI_CONSTANTS;
  const validation: string[] = [];

  // Validate weights sum to 1.0
  const totalWeight = config.weights.aesthetic_mean + config.weights.cohesion + config.weights.coverage;
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    validation.push(`CAI weights sum to ${totalWeight}, should be 1.0`);
  }

  // Validate cohesion parameters
  if (config.cohesion.min_std_dev >= config.cohesion.max_std_dev) {
    validation.push('CAI cohesion min_std_dev must be less than max_std_dev');
  }

  // Validate coverage parameters
  const coverageWeightSum = config.coverage.evaluation_completeness_weight + config.coverage.vote_depth_weight;
  if (Math.abs(coverageWeightSum - 1.0) > 0.001) {
    validation.push(`CAI coverage weights sum to ${coverageWeightSum}, should be 1.0`);
  }

  // Validate confidence parameters
  if (config.confidence.min_nfts >= config.confidence.target_nfts) {
    validation.push('CAI confidence min_nfts must be less than target_nfts');
  }

  if (config.confidence.min_total_votes >= config.confidence.target_total_votes) {
    validation.push('CAI confidence min_total_votes must be less than target_total_votes');
  }

  // Validate quality parameters
  if (config.quality.min_collection_size < 1) {
    validation.push('CAI quality min_collection_size must be at least 1');
  }

  if (config.quality.min_collection_size >= config.quality.max_collection_size) {
    validation.push('CAI quality min_collection_size must be less than max_collection_size');
  }

  return {
    ...config,
    validation,
    isValid: validation.length === 0,
  };
}

// Get CAI range for a given score
export function getCaiRange(score: number) {
  for (const [key, range] of Object.entries(CAI_RANGES)) {
    if (score >= range.min && score <= range.max) {
      return { key, ...range };
    }
  }
  return { key: 'unknown', min: 0, max: 0, label: 'Unknown', description: 'Score out of range' };
}

// Calculate confidence based on data quality factors
export function calculateCaiConfidence(
  nftCount: number,
  totalVotes: number,
  avgVotesPerNft: number,
  dataAgeHours: number
): number {
  const config = getCaiConfig().confidence;
  
  // NFT count factor (0-1)
  const nftFactor = Math.min(1, Math.max(0, 
    (nftCount - config.min_nfts) / (config.target_nfts - config.min_nfts)
  ));
  
  // Total votes factor (0-1)
  const votesFactor = Math.min(1, Math.max(0,
    (totalVotes - config.min_total_votes) / (config.target_total_votes - config.min_total_votes)
  ));
  
  // Recency factor (0-1)
  const maxAgeHours = config.max_age_days * 24;
  const recencyFactor = Math.min(1, Math.max(0, 
    1 - (dataAgeHours / maxAgeHours)
  ));
  
  // Combine factors
  const baseConfidence = (nftFactor + votesFactor) / 2;
  const finalConfidence = baseConfidence * (1 - config.recency_weight) + 
                         recencyFactor * config.recency_weight;
  
  return Math.round(finalConfidence * 100);
}

// Validate CAI computation input data
export function validateCaiInput(collectionData: {
  collection_name: string;
  nfts: Array<{ poa_v2: number; total_votes: number }>;
  total_votes: number;
}) {
  const config = getCaiConfig().quality;
  const errors: string[] = [];
  
  if (!collectionData.collection_name) {
    errors.push('Collection name is required');
  }
  
  if (!collectionData.nfts || collectionData.nfts.length < config.min_collection_size) {
    errors.push(`Collection must have at least ${config.min_collection_size} NFTs`);
  }
  
  if (collectionData.nfts && collectionData.nfts.length > config.max_collection_size) {
    errors.push(`Collection cannot have more than ${config.max_collection_size} NFTs`);
  }
  
  // Check for valid POA v2 scores
  const invalidNfts = collectionData.nfts?.filter(nft => 
    nft.poa_v2 == null || nft.poa_v2 < 0 || nft.poa_v2 > 100
  ) || [];
  
  if (invalidNfts.length > 0) {
    errors.push(`${invalidNfts.length} NFTs have invalid POA v2 scores`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

