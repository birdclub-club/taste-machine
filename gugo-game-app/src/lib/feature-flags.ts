/**
 * 🎛️ Feature Flags for POA v2 System
 * 
 * Manages rollout of the new Bayesian POA scoring system
 * alongside the existing bootstrap POA for safe A/B testing.
 */

export interface FeatureFlags {
  POA_V2_ENABLED: boolean;
  POA_V2_COMPUTATION: boolean;
  POA_V2_DISPLAY: boolean;
  POA_V2_LEADERBOARD: boolean;
  CAI_ENABLED: boolean;
  CAI_COMPUTATION: boolean;
  CAI_DISPLAY: boolean;
}

/**
 * Get feature flags from environment variables with safe defaults
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    // POA v2 System
    POA_V2_ENABLED: process.env.POA_V2_ENABLED === 'true',
    POA_V2_COMPUTATION: process.env.POA_V2_COMPUTATION === 'true',
    POA_V2_DISPLAY: process.env.POA_V2_DISPLAY === 'true', 
    POA_V2_LEADERBOARD: process.env.POA_V2_LEADERBOARD === 'true',
    
    // Collection Aesthetic Index
    CAI_ENABLED: process.env.CAI_ENABLED === 'true',
    CAI_COMPUTATION: process.env.CAI_COMPUTATION === 'true',
    CAI_DISPLAY: process.env.CAI_DISPLAY === 'true',
  };
}

/**
 * Check if POA v2 should be used for computation
 */
export function shouldUsePOAv2(): boolean {
  const flags = getFeatureFlags();
  return flags.POA_V2_ENABLED && flags.POA_V2_COMPUTATION;
}

/**
 * Check if POA v2 should be displayed in UI
 */
export function shouldDisplayPOAv2(): boolean {
  const flags = getFeatureFlags();
  return flags.POA_V2_ENABLED && flags.POA_V2_DISPLAY;
}

/**
 * Check if POA v2 should be used in leaderboard
 */
export function shouldUsePOAv2Leaderboard(): boolean {
  const flags = getFeatureFlags();
  return flags.POA_V2_ENABLED && flags.POA_V2_LEADERBOARD;
}

/**
 * Check if CAI system should be active
 */
export function shouldUseCAI(): boolean {
  const flags = getFeatureFlags();
  return flags.CAI_ENABLED && flags.CAI_COMPUTATION;
}

/**
 * Check if CAI should be displayed in UI
 */
export function shouldDisplayCAI(): boolean {
  const flags = getFeatureFlags();
  return flags.CAI_ENABLED && flags.CAI_DISPLAY;
}

/**
 * Development helper: Get all flag states for debugging
 */
export function getFeatureFlagStatus(): Record<string, boolean> {
  const flags = getFeatureFlags();
  return {
    ...flags,
    // Computed flags
    shouldUsePOAv2: shouldUsePOAv2(),
    shouldDisplayPOAv2: shouldDisplayPOAv2(),
    shouldUsePOAv2Leaderboard: shouldUsePOAv2Leaderboard(),
    shouldUseCAI: shouldUseCAI(),
    shouldDisplayCAI: shouldDisplayCAI(),
  };
}

/**
 * Log feature flag status for debugging
 */
export function logFeatureFlags(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('🎛️ Feature Flags Status:', getFeatureFlagStatus());
  }
}

