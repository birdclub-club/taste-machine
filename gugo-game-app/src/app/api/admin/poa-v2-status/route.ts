/**
 * 🎛️ POA v2 System Status API
 * 
 * Admin endpoint to check feature flags and system configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagStatus } from '../../../../lib/feature-flags';
import { getPOAv2Summary, validatePOAv2Config, getPOAv2Config } from '../../../../lib/poa-v2-config';

export async function GET(request: NextRequest) {
  try {
    // Get feature flag status
    const featureFlags = getFeatureFlagStatus();
    
    // Get POA v2 configuration summary
    const config = getPOAv2Config();
    const configSummary = getPOAv2Summary();
    const configErrors = validatePOAv2Config(config);
    
    // System health check
    const systemHealth = {
      configValid: configErrors.length === 0,
      errors: configErrors,
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json({
      success: true,
      data: {
        featureFlags,
        config: configSummary,
        systemHealth,
        environment: process.env.NODE_ENV,
      }
    });
    
  } catch (error) {
    console.error('❌ POA v2 status check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get POA v2 status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    switch (action) {
      case 'validate_config':
        const config = getPOAv2Config();
        const errors = validatePOAv2Config(config);
        
        return NextResponse.json({
          success: true,
          data: {
            valid: errors.length === 0,
            errors,
            config: getPOAv2Summary(),
          }
        });
        
      case 'get_debug_info':
        return NextResponse.json({
          success: true,
          data: {
            fullConfig: getPOAv2Config(),
            envVars: {
              POA_V2_ENABLED: process.env.POA_V2_ENABLED,
              POA_V2_COMPUTATION: process.env.POA_V2_COMPUTATION,
              POA_V2_DISPLAY: process.env.POA_V2_DISPLAY,
              POA_V2_LEADERBOARD: process.env.POA_V2_LEADERBOARD,
              NODE_ENV: process.env.NODE_ENV,
            }
          }
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['validate_config', 'get_debug_info']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ POA v2 admin action failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to execute POA v2 admin action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
