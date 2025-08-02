#!/usr/bin/env node

/**
 * Database Setup Script
 * 
 * This script sets up the NFT database schema for "Taste Machine" game.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function setupDatabase() {
  console.log('🚀 Setting up NFT database schema...\n');
  
  try {
    // Test connection first
    console.log('🔌 Testing Supabase connection...');
    const { data, error: testError } = await supabase.from('users').select('count').limit(1);
    if (testError) {
      throw new Error(`Connection failed: ${testError.message}`);
    }
    console.log('✅ Connected to Supabase!\n');

    // Execute each table creation separately for better error handling
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
      `CREATE INDEX IF NOT EXISTS idx_votes_matchup ON public.votes(matchup_id);`,

      // Updated trigger function
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
       RETURNS TRIGGER AS $$
       BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
       END;
       $$ language 'plpgsql';`,

      // Updated trigger
      `DROP TRIGGER IF EXISTS update_nfts_updated_at ON public.nfts;
       CREATE TRIGGER update_nfts_updated_at 
           BEFORE UPDATE ON public.nfts 
           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ];

    // Execute commands
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      const description = [
        'NFTs table', 'Matchups table', 'Votes table', 
        'NFTs score index', 'NFTs collection index', 'Matchups status index',
        'Matchups created index', 'Votes user index', 'Votes matchup index',
        'Updated trigger function', 'Updated trigger'
      ][i];
      
      console.log(`📝 Creating ${description}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: command });
      
      if (error) {
        console.error(`❌ Failed to create ${description}:`, error.message);
      } else {
        console.log(`✅ ${description} created successfully`);
      }
    }

    console.log('\n🎉 Database schema setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Run: node scripts/import-nfts.js');
    console.log('2. Check your Supabase dashboard');
    console.log('3. Test the voting UI at http://localhost:3000');

  } catch (error) {
    console.error('💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = { setupDatabase };