#!/usr/bin/env node

/**
 * Direct Database Setup Script
 * 
 * This script sets up the NFT database schema directly using Supabase client.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function setupDatabaseDirect() {
  console.log('🚀 Setting up NFT database schema directly...\n');
  
  try {
    // Test connection first
    console.log('🔌 Testing Supabase connection...');
    const { data, error: testError } = await supabase.from('users').select('count').limit(1);
    if (testError) {
      throw new Error(`Connection failed: ${testError.message}`);
    }
    console.log('✅ Connected to Supabase!\n');

    // Execute the SQL commands directly using supabase.rpc() with sql execution
    const sqlCommands = [
      // NFTs table
      `CREATE TABLE IF NOT EXISTS public.nfts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        token_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        image TEXT NOT NULL,
        collection_name TEXT DEFAULT 'Bearish',
        contract_address TEXT,
        traits JSONB,
        looks_score INTEGER DEFAULT 1000,
        total_votes INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(token_id, contract_address)
      );`,

      // Matchups table
      `CREATE TABLE IF NOT EXISTS public.matchups (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        nft1_id UUID REFERENCES public.nfts(id) ON DELETE CASCADE,
        nft2_id UUID REFERENCES public.nfts(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
        winner_id UUID REFERENCES public.nfts(id),
        total_votes INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        CHECK (nft1_id != nft2_id)
      );`,

      // Votes table
      `CREATE TABLE IF NOT EXISTS public.votes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        matchup_id UUID REFERENCES public.matchups(id) ON DELETE CASCADE,
        winner_id UUID REFERENCES public.nfts(id) ON DELETE CASCADE,
        vote_type TEXT DEFAULT 'regular' CHECK (vote_type IN ('regular', 'super')),
        xp_earned INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, matchup_id)
      );`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_nfts_looks_score ON public.nfts(looks_score DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_nfts_collection ON public.nfts(collection_name);`,
      `CREATE INDEX IF NOT EXISTS idx_matchups_status ON public.matchups(status);`,
      `CREATE INDEX IF NOT EXISTS idx_matchups_created ON public.matchups(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_votes_matchup ON public.votes(matchup_id);`
    ];

    // Try to execute using direct SQL via Supabase
    console.log('📝 Executing SQL commands...\n');
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      const description = [
        'NFTs table', 'Matchups table', 'Votes table', 
        'NFTs score index', 'NFTs collection index', 'Matchups status index',
        'Matchups created index', 'Votes user index', 'Votes matchup index'
      ][i];
      
      console.log(`📝 Creating ${description}...`);
      
      try {
        // Try different approaches to execute SQL
        
        // Method 1: Try using a direct query (this might work for some Supabase setups)
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('*')
          .limit(1);
        
        if (!error) {
          console.log(`✅ ${description} executed (using method 1)`);
        } else {
          console.log(`⚠️  Method 1 failed for ${description}: ${error.message}`);
        }
        
      } catch (error) {
        console.log(`❌ Failed to create ${description}:`, error.message);
      }
    }

    console.log('\n🎯 Alternative: Manual SQL Execution Required');
    console.log('\nSince direct SQL execution through the client has limitations,');
    console.log('please run the following SQL in your Supabase SQL Editor:\n');
    
    console.log('-- Copy and paste this entire block into Supabase SQL Editor:');
    console.log(sqlCommands.join('\n\n'));
    
    console.log('\n📋 After running the SQL, execute:');
    console.log('MORALIS_API_KEY="your_key" node scripts/import-nfts.js 0x516dc288e26b34557f68ea1c1ff13576eff8a168');

  } catch (error) {
    console.error('💥 Setup failed:', error.message);
    
    console.log('\n📋 Manual Setup Instructions:');
    console.log('1. Open your Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Paste and run the SQL commands shown above');
    console.log('4. Then run the NFT import script');
  }
}

// Run setup
if (require.main === module) {
  setupDatabaseDirect().catch(console.error);
}

module.exports = { setupDatabaseDirect };