/**
 * Publish Gates Configuration
 * 
 * Defines the minimum requirements for an NFT to "earn" a published POA score
 */

export interface PublishGatesConfig {
  // Head-to-head requirements
  min_h2h_matchups: number;
  min_unique_opponents: number;
  
  // Slider requirements  
  min_slider_ratings: number;
  min_unique_slider_users: number;
  
  // Publishing thresholds
  min_poa_change: number;
  confidence_tier_boundaries: number[];
  
  // Grace period settings
  grace_period_hours: number;
  min_republish_interval_minutes: number;
}

export const DEFAULT_PUBLISH_GATES: PublishGatesConfig = {
  // Head-to-head gates
  min_h2h_matchups: 5,
  min_unique_opponents: 3,
  
  // Slider gates
  min_slider_ratings: 2, 
  min_unique_slider_users: 2,
  
  // Publishing thresholds
  min_poa_change: 0.5,
  confidence_tier_boundaries: [20, 30, 40, 50, 60, 70, 80, 90],
  
  // Grace periods
  grace_period_hours: 1,
  min_republish_interval_minutes: 5,
};

/**
 * Get publish gates configuration (allows for environment overrides)
 */
export function getPublishGatesConfig(): PublishGatesConfig {
  return {
    min_h2h_matchups: parseInt(process.env.PUBLISH_MIN_H2H_MATCHUPS || String(DEFAULT_PUBLISH_GATES.min_h2h_matchups)),
    min_unique_opponents: parseInt(process.env.PUBLISH_MIN_UNIQUE_OPPONENTS || String(DEFAULT_PUBLISH_GATES.min_unique_opponents)),
    min_slider_ratings: parseInt(process.env.PUBLISH_MIN_SLIDER_RATINGS || String(DEFAULT_PUBLISH_GATES.min_slider_ratings)),
    min_unique_slider_users: parseInt(process.env.PUBLISH_MIN_UNIQUE_SLIDER_USERS || String(DEFAULT_PUBLISH_GATES.min_unique_slider_users)),
    min_poa_change: parseFloat(process.env.PUBLISH_MIN_POA_CHANGE || String(DEFAULT_PUBLISH_GATES.min_poa_change)),
    confidence_tier_boundaries: DEFAULT_PUBLISH_GATES.confidence_tier_boundaries,
    grace_period_hours: parseInt(process.env.PUBLISH_GRACE_PERIOD_HOURS || String(DEFAULT_PUBLISH_GATES.grace_period_hours)),
    min_republish_interval_minutes: parseInt(process.env.PUBLISH_MIN_REPUBLISH_INTERVAL || String(DEFAULT_PUBLISH_GATES.min_republish_interval_minutes)),
  };
}

/**
 * Check if confidence tier has changed (for republishing)
 */
export function hasConfidenceTierChanged(
  oldConfidence: number | null, 
  newConfidence: number,
  config: PublishGatesConfig = getPublishGatesConfig()
): boolean {
  if (oldConfidence === null) return true;
  
  const oldTier = getConfidenceTier(oldConfidence, config);
  const newTier = getConfidenceTier(newConfidence, config);
  
  return oldTier !== newTier;
}

/**
 * Get confidence tier for a given confidence score
 */
export function getConfidenceTier(confidence: number, config: PublishGatesConfig): number {
  for (let i = 0; i < config.confidence_tier_boundaries.length; i++) {
    if (confidence < config.confidence_tier_boundaries[i]) {
      return i;
    }
  }
  return config.confidence_tier_boundaries.length;
}

/**
 * Check if enough time has passed since last update (grace period)
 */
export function isWithinGracePeriod(
  lastUpdated: string | null,
  config: PublishGatesConfig = getPublishGatesConfig()
): boolean {
  if (!lastUpdated) return false;
  
  const lastUpdateTime = new Date(lastUpdated).getTime();
  const now = Date.now();
  const gracePeriodMs = config.min_republish_interval_minutes * 60 * 1000;
  
  return (now - lastUpdateTime) < gracePeriodMs;
}

