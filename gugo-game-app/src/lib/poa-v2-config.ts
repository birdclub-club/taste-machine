/**
 * 🎛️ POA v2 System Configuration
 * 
 * Central configuration for the new Bayesian POA scoring system.
 * Allows easy tuning of parameters without code changes.
 */

import { getFeatureFlags } from './feature-flags';

export interface POAv2Config {
  // System toggles
  enabled: boolean;
  parallelComputation: boolean;
  debugLogging: boolean;
  
  // Elo system parameters
  elo: {
    baseK: number;
    superK: number;
    sigmaFloor: number;
    sigmaDecay: number;
    sigmaShrink: number;
    defaultMean: number;
    defaultSigma: number;
  };
  
  // User statistics
  user: {
    defaultSliderMean: number;
    defaultSliderStd: number;
    minSliderStd: number;
    defaultReliability: number;
    reliabilityMin: number;
    reliabilityMax: number;
    reliabilityAlpha: number;
  };
  
  // POA v2 weights
  weights: {
    elo: number;
    slider: number;
    fire: number;
  };
  
  // Normalization ranges
  ranges: {
    eloMin: number;
    eloMax: number;
    sigmaMax: number;
    zScoreClamp: number;
  };
  
  // Computation thresholds
  thresholds: {
    minVotesForReliability: number;
    minVotesForPOAv2: number;
    confidenceThreshold: number;
  };
}

/**
 * Get POA v2 configuration with environment overrides
 */
export function getPOAv2Config(): POAv2Config {
  const flags = getFeatureFlags();
  
  return {
    // System toggles
    enabled: flags.POA_V2_ENABLED,
    parallelComputation: process.env.POA_V2_PARALLEL === 'true',
    debugLogging: process.env.NODE_ENV === 'development' || process.env.POA_V2_DEBUG === 'true',
    
    // Elo system parameters
    elo: {
      baseK: parseInt(process.env.POA_V2_ELO_BASE_K || '32'),
      superK: parseInt(process.env.POA_V2_ELO_SUPER_K || '64'),
      sigmaFloor: parseInt(process.env.POA_V2_ELO_SIGMA_FLOOR || '50'),
      sigmaDecay: parseInt(process.env.POA_V2_ELO_SIGMA_DECAY || '10'),
      sigmaShrink: parseFloat(process.env.POA_V2_ELO_SIGMA_SHRINK || '0.98'),
      defaultMean: parseInt(process.env.POA_V2_ELO_DEFAULT_MEAN || '1200'),
      defaultSigma: parseInt(process.env.POA_V2_ELO_DEFAULT_SIGMA || '350'),
    },
    
    // User statistics
    user: {
      defaultSliderMean: parseFloat(process.env.POA_V2_USER_SLIDER_MEAN || '50'),
      defaultSliderStd: parseFloat(process.env.POA_V2_USER_SLIDER_STD || '15'),
      minSliderStd: parseFloat(process.env.POA_V2_USER_MIN_SLIDER_STD || '5'),
      defaultReliability: parseFloat(process.env.POA_V2_USER_DEFAULT_RELIABILITY || '1.0'),
      reliabilityMin: parseFloat(process.env.POA_V2_USER_RELIABILITY_MIN || '0.5'),
      reliabilityMax: parseFloat(process.env.POA_V2_USER_RELIABILITY_MAX || '1.5'),
      reliabilityAlpha: parseFloat(process.env.POA_V2_USER_RELIABILITY_ALPHA || '0.10'),
    },
    
    // POA v2 weights
    weights: {
      elo: parseFloat(process.env.POA_V2_WEIGHT_ELO || '0.40'),
      slider: parseFloat(process.env.POA_V2_WEIGHT_SLIDER || '0.30'),
      fire: parseFloat(process.env.POA_V2_WEIGHT_FIRE || '0.30'),
    },
    
    // Normalization ranges
    ranges: {
      eloMin: parseInt(process.env.POA_V2_ELO_MIN || '800'),
      eloMax: parseInt(process.env.POA_V2_ELO_MAX || '2000'),
      sigmaMax: parseInt(process.env.POA_V2_SIGMA_MAX || '400'),
      zScoreClamp: parseFloat(process.env.POA_V2_Z_SCORE_CLAMP || '2.5'),
    },
    
    // Computation thresholds
    thresholds: {
      minVotesForReliability: parseInt(process.env.POA_V2_MIN_VOTES_RELIABILITY || '3'),
      minVotesForPOAv2: parseInt(process.env.POA_V2_MIN_VOTES_POA || '1'),
      confidenceThreshold: parseFloat(process.env.POA_V2_CONFIDENCE_THRESHOLD || '0.6'),
    },
  };
}

/**
 * Validate POA v2 configuration
 */
export function validatePOAv2Config(config: POAv2Config): string[] {
  const errors: string[] = [];
  
  // Check weights sum to 1.0
  const weightSum = config.weights.elo + config.weights.slider + config.weights.fire;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    errors.push(`POA v2 weights must sum to 1.0, got ${weightSum}`);
  }
  
  // Check reliability bounds
  if (config.user.reliabilityMin >= config.user.reliabilityMax) {
    errors.push('Reliability min must be less than reliability max');
  }
  
  // Check Elo ranges
  if (config.ranges.eloMin >= config.ranges.eloMax) {
    errors.push('Elo min must be less than Elo max');
  }
  
  // Check K-factors
  if (config.elo.superK <= config.elo.baseK) {
    errors.push('Super K-factor should be greater than base K-factor');
  }
  
  return errors;
}

/**
 * Log POA v2 configuration for debugging
 */
export function logPOAv2Config(): void {
  const config = getPOAv2Config();
  const errors = validatePOAv2Config(config);
  
  if (config.debugLogging) {
    console.log('🎛️ POA v2 Configuration:', config);
    
    if (errors.length > 0) {
      console.error('❌ POA v2 Configuration Errors:', errors);
    } else {
      console.log('✅ POA v2 Configuration Valid');
    }
  }
}

/**
 * Get a summary of current POA v2 settings for admin display
 */
export function getPOAv2Summary(): Record<string, any> {
  const config = getPOAv2Config();
  
  return {
    enabled: config.enabled,
    weights: config.weights,
    eloSystem: {
      baseK: config.elo.baseK,
      superK: config.elo.superK,
      defaultRating: `${config.elo.defaultMean} ± ${config.elo.defaultSigma}`,
    },
    thresholds: config.thresholds,
    validation: validatePOAv2Config(config),
  };
}

