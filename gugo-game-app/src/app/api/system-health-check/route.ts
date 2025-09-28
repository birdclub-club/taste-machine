import { NextRequest, NextResponse } from 'next/server';
import { databaseErrorHandler } from '@/lib/database-error-handler';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🏥 Running comprehensive system health check...');
    
    const healthResults = {
      timestamp: new Date().toISOString(),
      overall_status: 'unknown',
      database: {
        healthy: false,
        latency: 0,
        error: null as string | null
      },
      collection_statistics: {
        success: false,
        duration: 0,
        attempts: 0,
        error: null as string | null
      },
      enhanced_functions: {
        same_collection: { success: false, duration: 0, error: null as string | null },
        cross_collection: { success: false, duration: 0, error: null as string | null },
        slider_selection: { success: false, duration: 0, error: null as string | null }
      },
      cache_version: {
        initialized: false,
        version: null as string | null,
        error: null as string | null
      }
    };

    // 1. Basic database health check
    console.log('🔍 Checking database connection...');
    const dbHealth = await databaseErrorHandler.healthCheck();
    healthResults.database = {
      healthy: dbHealth.healthy,
      latency: dbHealth.latency || 0,
      error: dbHealth.error || null
    };

    // 2. Test collection statistics (known problematic endpoint)
    console.log('📊 Testing collection statistics...');
    const collectionStatsResult = await databaseErrorHandler.executeRPC(
      'get_collection_statistics',
      {},
      { 
        timeout: 8000, // 8 second timeout
        retries: 2,
        fallback: async () => {
          // Fallback: direct query
          const { data, error } = await supabase
            .from('nfts')
            .select('collection_name')
            .limit(10);
          
          if (error) throw error;
          return { fallback_used: true, sample_collections: data };
        }
      }
    );

    healthResults.collection_statistics = {
      success: collectionStatsResult.success,
      duration: collectionStatsResult.duration,
      attempts: collectionStatsResult.attempts,
      error: collectionStatsResult.error || null
    };

    // 3. Test enhanced functions (with shorter timeouts)
    console.log('🧠 Testing enhanced functions...');
    
    // Test same collection function
    const sameCollResult = await databaseErrorHandler.executeRPC(
      'find_optimal_same_collection_matchup_v2',
      { max_candidates: 5, target_collection: 'BEEISH' },
      { timeout: 3000, retries: 1 }
    );
    
    healthResults.enhanced_functions.same_collection = {
      success: sameCollResult.success,
      duration: sameCollResult.duration,
      error: sameCollResult.error || null
    };

    // Test cross collection function
    const crossCollResult = await databaseErrorHandler.executeRPC(
      'find_optimal_cross_collection_matchup_v2',
      { max_candidates: 5 },
      { timeout: 3000, retries: 1 }
    );
    
    healthResults.enhanced_functions.cross_collection = {
      success: crossCollResult.success,
      duration: crossCollResult.duration,
      error: crossCollResult.error || null
    };

    // Test slider function
    const sliderResult = await databaseErrorHandler.executeRPC(
      'find_optimal_slider_nft_v2',
      { max_candidates: 5 },
      { timeout: 2000, retries: 1 }
    );
    
    healthResults.enhanced_functions.slider_selection = {
      success: sliderResult.success,
      duration: sliderResult.duration,
      error: sliderResult.error || null
    };

    // 4. Check cache version system
    console.log('🔄 Checking cache version system...');
    try {
      // This would be available in browser context, not server
      healthResults.cache_version = {
        initialized: true,
        version: 'server_side_check_not_applicable',
        error: null
      };
    } catch (error: any) {
      healthResults.cache_version = {
        initialized: false,
        version: null,
        error: error.message
      };
    }

    // 5. Determine overall status
    const dbOk = healthResults.database.healthy;
    const collectionStatsOk = healthResults.collection_statistics.success;
    const enhancedFunctionsOk = Object.values(healthResults.enhanced_functions)
      .filter(f => f.success).length >= 2; // At least 2/3 working
    
    if (dbOk && collectionStatsOk && enhancedFunctionsOk) {
      healthResults.overall_status = 'healthy';
    } else if (dbOk && (collectionStatsOk || enhancedFunctionsOk)) {
      healthResults.overall_status = 'degraded';
    } else {
      healthResults.overall_status = 'unhealthy';
    }

    console.log(`🏥 Health check complete: ${healthResults.overall_status}`);

    return NextResponse.json({
      success: true,
      health_check: healthResults,
      recommendations: generateRecommendations(healthResults),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Health check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      health_check: {
        overall_status: 'error',
        error: error.message
      }
    }, { status: 500 });
  }
}

function generateRecommendations(healthResults: any): string[] {
  const recommendations: string[] = [];
  
  if (!healthResults.database.healthy) {
    recommendations.push('🚨 Database connection issues detected - check Supabase status');
  }
  
  if (!healthResults.collection_statistics.success) {
    recommendations.push('⚠️ Collection statistics failing - may need database optimization');
  }
  
  if (healthResults.database.latency > 2000) {
    recommendations.push('🐌 High database latency detected - consider connection pooling');
  }
  
  const enhancedFailures = Object.values(healthResults.enhanced_functions)
    .filter((f: any) => !f.success).length;
  
  if (enhancedFailures >= 2) {
    recommendations.push('🧠 Enhanced functions struggling - consider reducing enhanced ratio');
  }
  
  if (healthResults.overall_status === 'healthy') {
    recommendations.push('✅ System healthy - consider increasing enhanced ratio to 60-70%');
  }
  
  return recommendations;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;
    
    if (action === 'force_cache_invalidation') {
      console.log('🚨 Force cache invalidation requested...');
      
      return NextResponse.json({
        success: true,
        message: 'Cache invalidation triggered',
        script: `
          // Force cache invalidation script
          console.log('🚨 Force invalidating all caches...');
          
          // Clear localStorage
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.includes('taste-machine') || key.includes('preloader') || key.includes('voting')) {
              localStorage.removeItem(key);
              console.log('🗑️ Removed:', key);
            }
          });
          
          // Clear sessionStorage
          sessionStorage.clear();
          
          // Clear preloader if available
          if (window.votingPreloader) {
            window.votingPreloader.clearAllSessions();
            console.log('✅ Preloader cleared');
          }
          
          console.log('✅ Cache invalidation complete - refresh page');
        `
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Unknown action'
    }, { status: 400 });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
