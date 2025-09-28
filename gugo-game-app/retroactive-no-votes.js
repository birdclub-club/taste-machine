#!/usr/bin/env node

// 📉 Retroactive NO Vote Counter (Bypass Supabase Timeout)
// This script processes NO votes outside of SQL editor timeouts

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function processNoVotes() {
  console.log('📉 Starting retroactive NO vote processing...\n');

  try {
    // Step 1: Find all NO votes
    console.log('🔍 Step 1: Finding NO votes...');
    const { data: noVotes, error: noVotesError } = await supabase
      .from('votes')
      .select('id, nft_a_id, nft_b_id, engagement_data')
      .is('winner_id', null)
      .not('nft_a_id', 'is', null)
      .not('nft_b_id', 'is', null);

    if (noVotesError) {
      throw new Error(`Failed to fetch votes: ${noVotesError.message}`);
    }

    // Filter for actual NO votes
    const actualNoVotes = noVotes.filter(vote => 
      vote.engagement_data && vote.engagement_data.no_vote === true
    );

    console.log(`   Found ${actualNoVotes.length} NO votes to process`);

    if (actualNoVotes.length === 0) {
      console.log('✅ No NO votes found - nothing to process!');
      return;
    }

    // Step 2: Count vote impacts per NFT
    console.log('\n📊 Step 2: Calculating vote impacts...');
    const nftImpacts = new Map();

    actualNoVotes.forEach(vote => {
      const isSuper = vote.engagement_data.super_vote === true;
      const weight = isSuper ? 5 : 1;

      // Both NFTs get the vote count
      [vote.nft_a_id, vote.nft_b_id].forEach(nftId => {
        if (nftId) {
          const current = nftImpacts.get(nftId) || 0;
          nftImpacts.set(nftId, current + weight);
        }
      });
    });

    console.log(`   ${nftImpacts.size} unique NFTs will be updated`);

    // Step 3: Process updates in small batches
    console.log('\n🔄 Step 3: Applying updates in batches...');
    const nftIds = Array.from(nftImpacts.keys());
    const batchSize = 10;
    let processed = 0;

    for (let i = 0; i < nftIds.length; i += batchSize) {
      const batch = nftIds.slice(i, i + batchSize);
      
      console.log(`   Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(nftIds.length/batchSize)} (${batch.length} NFTs)...`);

      // Get current vote counts for this batch
      const { data: nfts, error: nftError } = await supabase
        .from('nfts')
        .select('id, total_votes, name, collection_name')
        .in('id', batch);

      if (nftError) {
        console.error(`   ❌ Failed to fetch NFT batch: ${nftError.message}`);
        continue;
      }

      // Update each NFT individually
      for (const nft of nfts) {
        const voteIncrease = nftImpacts.get(nft.id);
        const newTotal = (nft.total_votes || 0) + voteIncrease;

        const { error: updateError } = await supabase
          .from('nfts')
          .update({ 
            total_votes: newTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', nft.id);

        if (updateError) {
          console.error(`   ❌ Failed to update ${nft.name}: ${updateError.message}`);
        } else {
          console.log(`   ✅ ${nft.name} (${nft.collection_name}): ${nft.total_votes || 0} → ${newTotal} (+${voteIncrease})`);
          processed++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Step 4: Summary
    console.log('\n📈 Step 4: Summary');
    const totalVoteAdded = Array.from(nftImpacts.values()).reduce((sum, val) => sum + val, 0);
    console.log(`   ✅ Updated ${processed} NFTs`);
    console.log(`   ✅ Added ${totalVoteAdded} total vote counts`);
    console.log(`   ✅ NO votes now properly counted as negative aesthetic data`);

  } catch (error) {
    console.error('❌ Processing failed:', error.message);
    process.exit(1);
  }
}

// Run the processor
processNoVotes().then(() => {
  console.log('\n🎉 Retroactive NO vote processing complete!');
  console.log('Your admin panel now shows true engagement including negative feedback.');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

