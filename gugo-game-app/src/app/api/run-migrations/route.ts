// 🗄️ Migration Runner API
// Apply database migrations through the API

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { migrations, dryRun = false } = await request.json();
    
    console.log('🗄️ Starting migration runner...', { migrations, dryRun });
    
    const results = {
      migrations_applied: [] as any[],
      errors: [] as string[],
      dry_run: dryRun,
      success: true
    };

    // Available migrations
    const availableMigrations = {
      '102': {
        file: '102-enhanced-matchup-performance-boost.sql',
        description: 'Enhanced matchup performance optimization with V3 functions and strategic indexes'
      },
      '103': {
        file: '103-poa-v2-enhanced-matchup-integration.sql', 
        description: 'POA v2 integration with enhanced matchups and dirty flag awareness'
      }
    };

    const migrationsToRun = migrations || ['102', '103'];

    for (const migrationId of migrationsToRun) {
      const migration = availableMigrations[migrationId as keyof typeof availableMigrations];
      
      if (!migration) {
        results.errors.push(`Unknown migration: ${migrationId}`);
        continue;
      }

      try {
        console.log(`📄 Processing migration ${migrationId}: ${migration.description}`);
        
        // Read migration file
        const migrationPath = join(process.cwd(), '..', 'migrations', migration.file);
        let migrationSQL: string;
        
        try {
          migrationSQL = readFileSync(migrationPath, 'utf8');
        } catch (fileError) {
          // Try alternative path
          const altPath = join(process.cwd(), '..', '..', 'migrations', migration.file);
          try {
            migrationSQL = readFileSync(altPath, 'utf8');
          } catch (altError) {
            results.errors.push(`Could not read migration ${migrationId}: File not found`);
            continue;
          }
        }

        if (dryRun) {
          results.migrations_applied.push({
            id: migrationId,
            description: migration.description,
            status: 'DRY_RUN',
            sql_length: migrationSQL.length,
            preview: migrationSQL.substring(0, 200) + '...'
          });
          continue;
        }

        // Split SQL into individual statements
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        let successCount = 0;
        const statementErrors = [];

        for (const statement of statements) {
          try {
            const { error } = await supabase.rpc('execute_sql', { 
              sql_query: statement + ';' 
            });
            
            if (error) {
              console.warn(`⚠️ Statement warning in ${migrationId}:`, error.message);
              statementErrors.push(error.message);
            } else {
              successCount++;
            }
          } catch (stmtError: any) {
            console.warn(`⚠️ Statement error in ${migrationId}:`, stmtError.message);
            statementErrors.push(stmtError.message);
          }
        }

        results.migrations_applied.push({
          id: migrationId,
          description: migration.description,
          status: statementErrors.length === 0 ? 'SUCCESS' : 'PARTIAL',
          statements_total: statements.length,
          statements_successful: successCount,
          errors: statementErrors
        });

        console.log(`✅ Migration ${migrationId} completed: ${successCount}/${statements.length} statements`);

      } catch (migrationError: any) {
        console.error(`❌ Migration ${migrationId} failed:`, migrationError);
        results.errors.push(`Migration ${migrationId}: ${migrationError.message}`);
        results.success = false;
      }
    }

    // Summary
    const summary = {
      ...results,
      total_migrations: migrationsToRun.length,
      successful_migrations: results.migrations_applied.filter(m => m.status === 'SUCCESS').length,
      recommendations: [] as string[]
    };

    if (dryRun) {
      summary.recommendations.push('🔍 This was a dry run - no changes were made');
      summary.recommendations.push('💡 Run with dryRun: false to apply migrations');
    } else if (summary.successful_migrations === summary.total_migrations) {
      summary.recommendations.push('🎉 All migrations applied successfully!');
      summary.recommendations.push('🧪 Test the enhanced system with /api/test-v3-enhanced-performance');
      summary.recommendations.push('🔍 Check POA v2 integration with /api/test-poa-v2-fallback');
    } else {
      summary.recommendations.push('⚠️ Some migrations had issues - check the errors');
      summary.recommendations.push('🔧 You may need to apply migrations manually via Supabase dashboard');
    }

    console.log('🎯 Migration runner completed:', summary);
    return NextResponse.json(summary, { status: 200 });

  } catch (error: any) {
    console.error('❌ Migration runner failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Migration runner encountered an error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Database Migration Runner',
    available_migrations: {
      '102': 'Enhanced matchup performance boost with V3 functions',
      '103': 'POA v2 integration with enhanced matchups'
    },
    usage: {
      dry_run: 'POST with { "dryRun": true } to preview changes',
      apply_all: 'POST with { "migrations": ["102", "103"] } to apply both',
      apply_specific: 'POST with { "migrations": ["102"] } to apply specific migration'
    },
    note: 'Migrations will be applied through Supabase RPC calls'
  });
}
