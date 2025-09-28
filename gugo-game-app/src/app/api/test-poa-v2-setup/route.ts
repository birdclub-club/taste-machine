/**
 * 🧪 POA v2 Setup Test API
 * 
 * Test endpoint to verify Phase A0 infrastructure is working
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagStatus, logFeatureFlags } from '../../../lib/feature-flags';
import { getPOAv2Config, logPOAv2Config, validatePOAv2Config } from '../../../lib/poa-v2-config';
import { 
  updateEloBayesian, 
  normalizeSliderValue, 
  updateReliabilityScore, 
  calculateFireComponent,
  computePOAv2,
  POA_V2_CONSTANTS 
} from '../../../lib/poa-v2-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing POA v2 Phase A0 Setup...');
    
    // Test 1: Feature Flags
    logFeatureFlags();
    const featureFlags = getFeatureFlagStatus();
    
    // Test 2: Configuration
    logPOAv2Config();
    const config = getPOAv2Config();
    const configErrors = validatePOAv2Config(config);
    
    // Test 3: Utility Functions
    const testResults = {
      eloUpdate: updateEloBayesian(1200, 350, 1150, 1, false),
      sliderNormalization: normalizeSliderValue(75, 50, 15),
      reliabilityUpdate: updateReliabilityScore(1.0, true, 0.7),
      fireComponent: calculateFireComponent(3.5),
      poaComputation: computePOAv2(1300, 200, 65, 45, 1.1),
    };
    
    // Test 4: Constants
    const constants = POA_V2_CONSTANTS;
    
    const testSummary = {
      featureFlagsWorking: typeof featureFlags === 'object' && featureFlags !== null,
      configValid: configErrors.length === 0,
      utilitiesWorking: testResults.eloUpdate.mean > 0 && testResults.poaComputation.poa_v2 > 0,
      constantsLoaded: constants.ELO_BASE_K === 32,
    };
    
    const allTestsPassed = Object.values(testSummary).every(test => test === true);
    
    console.log('✅ POA v2 Phase A0 Test Results:', {
      summary: testSummary,
      allPassed: allTestsPassed,
    });
    
    return NextResponse.json({
      success: true,
      phase: 'A0',
      message: 'POA v2 infrastructure test completed',
      data: {
        testSummary,
        allTestsPassed,
        featureFlags,
        config: {
          enabled: config.enabled,
          weights: config.weights,
          eloDefaults: {
            mean: config.elo.defaultMean,
            sigma: config.elo.defaultSigma,
          },
        },
        configErrors,
        testResults,
        constants: {
          eloBaseK: constants.ELO_BASE_K,
          eloSuperK: constants.ELO_SUPER_K,
          weights: {
            elo: constants.ELO_WEIGHT,
            slider: constants.SLIDER_WEIGHT,
            fire: constants.FIRE_WEIGHT,
          },
        },
      }
    });
    
  } catch (error) {
    console.error('❌ POA v2 Phase A0 test failed:', error);
    
    return NextResponse.json({
      success: false,
      phase: 'A0',
      error: 'POA v2 infrastructure test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

