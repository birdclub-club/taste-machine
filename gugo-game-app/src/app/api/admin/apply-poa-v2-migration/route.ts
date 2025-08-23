/**
 * 🚀 Apply POA v2 Migration API
 * 
 * Admin endpoint to apply Phase A1 database schema changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';

const MIGRATION_STATEMENTS = [
  // NFT table enhancements
  `ALTER TABLE nfts ADD COLUMN IF NOT EXISTS elo_mean NUMERIC DEFAULT 1200`,
  `ALTER TABLE nfts ADD COLUMN IF NOT EXISTS elo_sigma NUMERIC DEFAULT 350`,
  `ALTER TABLE nfts ADD COLUMN IF NOT EXISTS poa_v2 NUMERIC`,
  `ALTER TABLE nfts ADD COLUMN IF NOT EXISTS poa_v2_updated_at TIMESTAMPTZ`,
  `ALTER TABLE nfts ADD COLUMN IF NOT EXISTS poa_v2_components JSONB`,
  `ALTER TABLE nfts ADD COLUMN IF NOT EXISTS poa_v2_confidence NUMERIC`,
  `ALTER TABLE nfts ADD COLUMN IF NOT EXISTS poa_v2_explanation TEXT`,
  
  // User table enhancements
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS slider_mean NUMERIC DEFAULT 50`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS slider_std NUMERIC DEFAULT 15`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS slider_count INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS slider_m2 NUMERIC DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reliability_score NUMERIC DEFAULT 1.0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reliability_count INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reliability_updated_at TIMESTAMPTZ DEFAULT NOW()`,
  
  // Performance indexes
  `CREATE INDEX IF NOT EXISTS idx_nfts_poa_v2 ON nfts(poa_v2 DESC NULLS LAST)`,
  `CREATE INDEX IF NOT EXISTS idx_nfts_poa_v2_confidence ON nfts(poa_v2 DESC, poa_v2_confidence DESC) WHERE poa_v2 IS NOT NULL AND poa_v2_confidence > 0.6`,
  `CREATE INDEX IF NOT EXISTS idx_nfts_elo_bayesian ON nfts(elo_mean DESC, elo_sigma ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_users_reliability ON users(reliability_score DESC, reliability_count DESC) WHERE reliability_count >= 3`,
  `CREATE INDEX IF NOT EXISTS idx_users_slider_stats ON users(slider_count DESC, slider_std ASC) WHERE slider_count >= 2`,
];

const CONSTRAINT_STATEMENTS = [
  // NFT constraints
  `ALTER TABLE nfts ADD CONSTRAINT IF NOT EXISTS chk_elo_mean_range CHECK (elo_mean >= 0 AND elo_mean <= 3000)`,
  `ALTER TABLE nfts ADD CONSTRAINT IF NOT EXISTS chk_elo_sigma_range CHECK (elo_sigma >= 10 AND elo_sigma <= 1000)`,
  `ALTER TABLE nfts ADD CONSTRAINT IF NOT EXISTS chk_poa_v2_range CHECK (poa_v2 >= 0 AND poa_v2 <= 100)`,
  `ALTER TABLE nfts ADD CONSTRAINT IF NOT EXISTS chk_poa_v2_confidence_range CHECK (poa_v2_confidence >= 0 AND poa_v2_confidence <= 100)`,
  
  // User constraints
  `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_slider_mean_range CHECK (slider_mean >= 0 AND slider_mean <= 100)`,
  `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_slider_std_range CHECK (slider_std >= 1 AND slider_std <= 50)`,
  `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_reliability_range CHECK (reliability_score >= 0.1 AND reliability_score <= 2.0)`,
  `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_slider_count_positive CHECK (slider_count >= 0)`,
  `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_reliability_count_positive CHECK (reliability_count >= 0)`,
];

const INITIALIZATION_STATEMENTS = [
  // Initialize elo_mean from current_elo
  `UPDATE nfts SET elo_mean = COALESCE(current_elo, 1200) WHERE elo_mean IS NULL OR elo_mean = 1200`,
  
  // Initialize elo_sigma based on vote count
  `UPDATE nfts SET elo_sigma = CASE 
    WHEN total_votes >= 20 THEN 150
    WHEN total_votes >= 10 THEN 250
    WHEN total_votes >= 5 THEN 300
    WHEN total_votes >= 1 THEN 350
    ELSE 400
  END WHERE elo_sigma = 350`,
  
  // Initialize user statistics
  `UPDATE users SET 
    slider_mean = 50,
    slider_std = 15,
    slider_count = 0,
    slider_m2 = 0,
    reliability_score = 1.0,
    reliability_count = 0,
    reliability_updated_at = NOW()
  WHERE slider_mean IS NULL`,
];

export async function POST(request: NextRequest) {
  try {
    const { step = 'all' } = await request.json();
    
    console.log('🚀 Starting POA v2 Schema Migration (Phase A1)...');
    
    let results = {
      columns: { success: 0, failed: 0, errors: [] as string[] },
      constraints: { success: 0, failed: 0, errors: [] as string[] },
      initialization: { success: 0, failed: 0, errors: [] as string[] },
      indexes: { success: 0, failed: 0, errors: [] as string[] },
    };
    
    // Step 1: Add columns and indexes
    if (step === 'all' || step === 'columns') {
      console.log('📊 Adding columns and indexes...');
      
      for (const statement of MIGRATION_STATEMENTS) {
        try {
          const { error } = await supabase.rpc('exec', { sql: statement });
          
          if (error) {
            // Try to determine if it's a "already exists" error
            if (error.message.includes('already exists') || error.message.includes('duplicate')) {
              console.log('ℹ️  Already exists:', statement.substring(0, 50) + '...');
              results.columns.success++;
            } else {
              throw error;
            }
          } else {
            results.columns.success++;
          }
        } catch (error: any) {
          results.columns.failed++;
          results.columns.errors.push(`${statement.substring(0, 50)}...: ${error.message}`);
          console.error('❌ Column/index statement failed:', error.message);
        }
      }
    }
    
    // Step 2: Add constraints
    if (step === 'all' || step === 'constraints') {
      console.log('🛡️  Adding constraints...');
      
      for (const statement of CONSTRAINT_STATEMENTS) {
        try {
          const { error } = await supabase.rpc('exec', { sql: statement });
          
          if (error) {
            if (error.message.includes('already exists') || error.message.includes('duplicate')) {
              console.log('ℹ️  Constraint already exists');
              results.constraints.success++;
            } else {
              throw error;
            }
          } else {
            results.constraints.success++;
          }
        } catch (error: any) {
          results.constraints.failed++;
          results.constraints.errors.push(`Constraint: ${error.message}`);
          console.error('❌ Constraint statement failed:', error.message);
        }
      }
    }
    
    // Step 3: Initialize data
    if (step === 'all' || step === 'initialization') {
      console.log('🔄 Initializing data...');
      
      for (const statement of INITIALIZATION_STATEMENTS) {
        try {
          const { error } = await supabase.rpc('exec', { sql: statement });
          
          if (error) {
            throw error;
          }
          
          results.initialization.success++;
        } catch (error: any) {
          results.initialization.failed++;
          results.initialization.errors.push(`Init: ${error.message}`);
          console.error('❌ Initialization statement failed:', error.message);
        }
      }
    }
    
    // Test the migration
    console.log('🧪 Testing migration results...');
    
    const testResults = {
      nftColumns: false,
      userColumns: false,
      dataInitialized: false,
    };
    
    try {
      // Test NFT columns
      const { data: nftTest, error: nftError } = await supabase
        .from('nfts')
        .select('id, elo_mean, elo_sigma, poa_v2')
        .limit(1);
      
      testResults.nftColumns = !nftError;
      
      // Test User columns
      const { data: userTest, error: userError } = await supabase
        .from('users')
        .select('id, slider_mean, reliability_score')
        .limit(1);
      
      testResults.userColumns = !userError;
      
      // Test data initialization
      const { data: initTest, error: initError } = await supabase
        .from('nfts')
        .select('elo_mean, elo_sigma')
        .not('elo_mean', 'is', null)
        .limit(1);
      
      testResults.dataInitialized = !initError && initTest && initTest.length > 0;
      
    } catch (testError: any) {
      console.error('❌ Migration test failed:', testError.message);
    }
    
    const totalSuccess = results.columns.success + results.constraints.success + results.initialization.success;
    const totalFailed = results.columns.failed + results.constraints.failed + results.initialization.failed;
    const allErrors = [...results.columns.errors, ...results.constraints.errors, ...results.initialization.errors];
    
    console.log('📊 Migration Summary:');
    console.log(`✅ Successful: ${totalSuccess}`);
    console.log(`❌ Failed: ${totalFailed}`);
    
    const migrationSuccess = totalFailed === 0 && Object.values(testResults).every(test => test === true);
    
    return NextResponse.json({
      success: migrationSuccess,
      phase: 'A1',
      message: migrationSuccess ? 'POA v2 schema migration completed successfully' : 'POA v2 schema migration completed with issues',
      data: {
        results,
        testResults,
        summary: {
          totalStatements: MIGRATION_STATEMENTS.length + CONSTRAINT_STATEMENTS.length + INITIALIZATION_STATEMENTS.length,
          totalSuccess,
          totalFailed,
          migrationSuccess,
        },
        errors: allErrors,
        nextStep: migrationSuccess ? 'Ready for Phase A2: Vote Ingestion Pipeline' : 'Review errors and retry failed steps',
      }
    });
    
  } catch (error) {
    console.error('❌ POA v2 migration failed:', error);
    
    return NextResponse.json({
      success: false,
      phase: 'A1',
      error: 'POA v2 schema migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

