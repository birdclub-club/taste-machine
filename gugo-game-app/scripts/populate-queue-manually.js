// 🔄 Manual Queue Population Script
// Run this to gradually populate the matchup queue
// Usage: node scripts/populate-queue-manually.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addSliderVotes(count = 10) {
  console.log(`🎚️ Adding ${count} slider votes...`);
  
  try {
    // Get NFTs that need slider votes
    const { data: nfts, error } = await supabase
      .from('nfts')
      .select('id, slider_count, total_votes')
      .lt('slider_count', 5)
      .order('slider_count', { ascending: true })
      .order('total_votes', { ascending: true })
      .limit(count);
    
    if (error) throw error;
    
    if (!nfts || nfts.length === 0) {
      console.log('ℹ️ No NFTs need slider votes');
      return 0;
    }
    
    // Add them to queue
    const queueItems = nfts.map(nft => ({
      vote_type: 'slider',
      slider_nft_id: nft.id,
      priority_score: (5 - nft.slider_count) * 20 + (10 - Math.min(nft.total_votes, 10)) * 5
    }));
    
    const { error: insertError } = await supabase
      .from('matchup_queue')
      .insert(queueItems);
    
    if (insertError) throw insertError;
    
    console.log(`✅ Added ${nfts.length} slider votes`);
    return nfts.length;
  } catch (error) {
    console.error('❌ Error adding slider votes:', error);
    return 0;
  }
}

async function addSimpleMatchups(count = 5) {
  console.log(`🥊 Adding ${count} simple matchups...`);
  
  try {
    // Get random NFTs for simple matchups
    const { data: nfts, error } = await supabase
      .from('nfts')
      .select('id, collection_name, current_elo')
      .limit(count * 4); // Get more than we need
    
    if (error) throw error;
    
    if (!nfts || nfts.length < 2) {
      console.log('ℹ️ Not enough NFTs for matchups');
      return 0;
    }
    
    const matchups = [];
    
    // Create some same collection matchups
    for (let i = 0; i < Math.min(count, Math.floor(nfts.length / 2)); i++) {
      const nft1 = nfts[i * 2];
      const nft2 = nfts[i * 2 + 1];
      
      if (nft1 && nft2 && nft1.id !== nft2.id) {
        matchups.push({
          vote_type: nft1.collection_name === nft2.collection_name ? 'same_coll' : 'cross_coll',
          nft_a_id: nft1.id,
          nft_b_id: nft2.id,
          elo_diff: Math.abs(nft1.current_elo - nft2.current_elo),
          priority_score: 50
        });
      }
    }
    
    if (matchups.length === 0) {
      console.log('ℹ️ No valid matchups created');
      return 0;
    }
    
    const { error: insertError } = await supabase
      .from('matchup_queue')
      .insert(matchups);
    
    if (insertError) throw insertError;
    
    console.log(`✅ Added ${matchups.length} matchups`);
    return matchups.length;
  } catch (error) {
    console.error('❌ Error adding matchups:', error);
    return 0;
  }
}

async function checkQueueStatus() {
  try {
    const { data, error } = await supabase
      .from('matchup_queue')
      .select('vote_type')
      .is('reserved_until', null);
    
    if (error) throw error;
    
    const counts = {
      slider: 0,
      same_coll: 0,
      cross_coll: 0,
      total: 0
    };
    
    if (data) {
      data.forEach(item => {
        counts[item.vote_type]++;
        counts.total++;
      });
    }
    
    console.log('📊 Queue Status:');
    console.log(`  Slider votes: ${counts.slider}`);
    console.log(`  Same collection: ${counts.same_coll}`);
    console.log(`  Cross collection: ${counts.cross_coll}`);
    console.log(`  Total ready: ${counts.total}`);
    
    return counts;
  } catch (error) {
    console.error('❌ Error checking queue:', error);
    return null;
  }
}

async function populateQueue() {
  console.log('🚀 Starting manual queue population...\n');
  
  // Check initial status
  await checkQueueStatus();
  
  // Add some slider votes
  await addSliderVotes(15);
  
  // Add some matchups
  await addSimpleMatchups(10);
  
  // Show final status
  console.log('\n📊 Final Status:');
  await checkQueueStatus();
  
  console.log('\n✅ Queue population complete!');
  console.log('💡 Run this script again to add more matchups as needed.');
}

// Run if called directly
if (require.main === module) {
  populateQueue().catch(console.error);
}

module.exports = { addSliderVotes, addSimpleMatchups, checkQueueStatus, populateQueue };