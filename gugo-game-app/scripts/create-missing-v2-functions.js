const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMissingV2Functions() {
  try {
    console.log('🔧 Creating missing V2 RPC functions...');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '102-create-missing-v2-functions.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }
      
      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          if (error.message.includes('already exists')) {
            console.log(`ℹ️  Function already exists, continuing...`);
            successCount++;
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            errorCount++;
          }
        } else {
          successCount++;
          console.log('✅ Statement executed successfully');
        }
        
      } catch (statementError) {
        errorCount++;
        console.error(`❌ Statement ${i + 1} error:`, statementError.message);
        
        if (statementError.message.includes('already exists')) {
          console.log('ℹ️  Function already exists, continuing...');
          successCount++;
        }
      }
      
      // Small delay between statements
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    
    // Test the created functions
    console.log('\n🧪 Testing created functions...');
    
    const testFunctions = [
      'find_optimal_same_collection_matchup_v2',
      'find_optimal_cross_collection_matchup_v2',
      'find_optimal_slider_nft_v2'
    ];
    
    for (const funcName of testFunctions) {
      try {
        const { data, error } = await supabase.rpc(funcName, { max_candidates: 1 });
        
        if (error) {
          console.log(`❌ ${funcName}: ${error.message}`);
        } else {
          console.log(`✅ ${funcName}: Working (returned ${Array.isArray(data) ? data.length : 'data'})`);
        }
      } catch (testError) {
        console.log(`❌ ${funcName}: ${testError.message}`);
      }
    }
    
    console.log('\n🎉 V2 functions creation completed!');
    
    if (errorCount === 0) {
      console.log('✅ All functions created successfully');
    } else {
      console.log(`⚠️  ${errorCount} errors occurred, but functions may still work`);
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createMissingV2Functions().catch(console.error);
}

module.exports = { createMissingV2Functions };
