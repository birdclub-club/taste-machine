#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gfhktkhfogixmwfjiqev.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmaGt0a2hmb2dpeG13ZmppcWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1NTUzNDAsImV4cCI6MjA1MDEzMTM0MH0.UhFNlJdlF4ZhWsOShd2Tqm4XDJu4mwVU2nOq5fGr8Ns';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFireVotes() {
  console.log('🔍 Checking FIRE votes directly...\n');

  try {
    // Check total count of favorites table
    console.log('1. Total favorites count:');
    const { count: totalFavorites, error: totalError } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      console.error('❌ Error getting total favorites:', totalError);
    } else {
      console.log(`   Total favorites: ${totalFavorites}`);
    }

    // Check FIRE votes specifically
    console.log('\n2. FIRE votes check:');
    const { data: fireVotes, count: fireCount, error: fireError } = await supabase
      .from('favorites')
      .select('*', { count: 'exact' })
      .eq('vote_type', 'fire');
    
    if (fireError) {
      console.error('❌ Error getting FIRE votes:', fireError);
    } else {
      console.log(`   FIRE votes found: ${fireCount}`);
      if (fireVotes && fireVotes.length > 0) {
        console.log('   Sample FIRE votes:');
        fireVotes.slice(0, 5).forEach((vote, i) => {
          console.log(`     ${i + 1}. NFT: ${vote.nft_id}, Collection: ${vote.collection_name}, Wallet: ${vote.wallet_address}`);
        });
      }
    }

    // Check all unique vote types
    console.log('\n3. All vote types in favorites:');
    const { data: voteTypes, error: voteTypesError } = await supabase
      .from('favorites')
      .select('vote_type')
      .limit(1000);
    
    if (voteTypesError) {
      console.error('❌ Error getting vote types:', voteTypesError);
    } else {
      const uniqueTypes = [...new Set(voteTypes.map(v => v.vote_type))];
      console.log(`   Unique vote types: ${uniqueTypes.join(', ')}`);
    }

    // Check if favorites table exists and has the right structure
    console.log('\n4. Favorites table structure check:');
    const { data: sample, error: sampleError } = await supabase
      .from('favorites')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error getting sample:', sampleError);
    } else if (sample && sample.length > 0) {
      console.log('   Sample record structure:');
      console.log('   Columns:', Object.keys(sample[0]));
    } else {
      console.log('   Table exists but is empty');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkFireVotes().then(() => {
  console.log('\n✅ Fire votes check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
