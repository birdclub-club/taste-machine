#!/usr/bin/env node

// 📉 Test Retroactive NO Vote Counting
// This script analyzes existing NO votes without making changes

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeNoVotes() {
  console.log('📉 Analyzing existing NO votes...\n');

  try {
    // 1. Find all NO votes
    const { data: noVotes, error: noVotesError } = await supabase
      .from('votes')
      .select(`
        id,
        nft_a_id,
        nft_b_id,
        engagement_data,
        created_at,
        vote_type_v2
      `)
      .is('winner_id', null)
      .not('nft_a_id', 'is', null)
      .not('nft_b_id', 'is', null)
      .in('vote_type_v2', ['same_coll', 'cross_coll']);

    if (noVotesError) {
      throw new Error(`Failed to fetch NO votes: ${noVotesError.message}`);
    }

    // Filter for actual NO votes (with no_vote flag)
    const actualNoVotes = noVotes.filter(vote => 
      vote.engagement_data && vote.engagement_data.no_vote === true
    );

    console.log(`🔍 Found ${actualNoVotes.length} NO votes out of ${noVotes.length} potential votes`);

    if (actualNoVotes.length === 0) {
      console.log('❌ No NO votes found. Nothing to retroactively count.');
      return;
    }

    // 2. Analyze vote weights
    let regularNoVotes = 0;
    let superNoVotes = 0;
    let totalVoteWeight = 0;

    actualNoVotes.forEach(vote => {
      const isSuper = vote.engagement_data.super_vote === true;
      const weight = isSuper ? 5 : 1;
      
      if (isSuper) {
        superNoVotes++;
      } else {
        regularNoVotes++;
      }
      
      totalVoteWeight += weight * 2; // Each NO vote affects 2 NFTs
    });

    console.log(`📊 NO Vote Breakdown:`);
    console.log(`   Regular NO votes: ${regularNoVotes} (${regularNoVotes * 2} NFT vote additions)`);
    console.log(`   Super NO votes: ${superNoVotes} (${superNoVotes * 10} NFT vote additions)`);
    console.log(`   Total vote count increases: ${totalVoteWeight}`);
    console.log();

    // 3. Find affected NFTs
    const affectedNFTIds = new Set();
    actualNoVotes.forEach(vote => {
      affectedNFTIds.add(vote.nft_a_id);
      affectedNFTIds.add(vote.nft_b_id);
    });

    console.log(`🎯 Impact:`);
    console.log(`   Unique NFTs affected: ${affectedNFTIds.size}`);
    console.log(`   Average vote increase per affected NFT: ${(totalVoteWeight / affectedNFTIds.size).toFixed(1)}`);
    console.log();

    // 4. Sample some affected NFTs
    const { data: sampleNFTs, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, total_votes')
      .in('id', Array.from(affectedNFTIds).slice(0, 5));

    if (nftError) {
      console.log('⚠️ Could not fetch sample NFTs for analysis');
    } else {
      console.log(`📝 Sample affected NFTs (current vote counts):`);
      sampleNFTs.forEach(nft => {
        console.log(`   ${nft.name} (${nft.collection_name}): ${nft.total_votes} votes`);
      });
      console.log();
    }

    // 5. Analyze by date
    const oldestNoVote = actualNoVotes.reduce((oldest, vote) => 
      new Date(vote.created_at) < new Date(oldest.created_at) ? vote : oldest
    );
    const newestNoVote = actualNoVotes.reduce((newest, vote) => 
      new Date(vote.created_at) > new Date(newest.created_at) ? vote : newest
    );

    console.log(`📅 Timeline:`);
    console.log(`   First NO vote: ${new Date(oldestNoVote.created_at).toLocaleDateString()}`);
    console.log(`   Latest NO vote: ${new Date(newestNoVote.created_at).toLocaleDateString()}`);
    console.log();

    // 6. Recommendations
    console.log(`💡 Recommendations:`);
    if (actualNoVotes.length > 0) {
      console.log(`   ✅ Run the retroactive migration to count ${totalVoteWeight} historical vote engagements`);
      console.log(`   ✅ This will provide more accurate POA scoring data`);
      console.log(`   ✅ Collections will show true user engagement levels`);
      console.log();
      console.log(`📄 To apply changes, run this SQL in Supabase:`);
      console.log(`   migrations/43-retroactive-no-vote-counting.sql`);
    } else {
      console.log(`   ℹ️ No NO votes found - retroactive counting not needed`);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

// Run the analysis
analyzeNoVotes().then(() => {
  console.log('\n📉 NO vote analysis complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

