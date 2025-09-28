#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gfhktkhfogixmwfjiqev.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmaGt0a2hmb2dpeG13ZmppcWV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU1NTM0MCwiZXhwIjoyMDUwMTMxMzQwfQ.KJD_h3YLPgV8r1lWvKvGWMtEXo5KnLclm1dFq0YEo0o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateFireVotes() {
  console.log('🔍 Investigating FIRE vote patterns...\n');
  
  try {
    // Get all FIRE votes
    const { data: fireVotes, error } = await supabase
      .from('favorites')
      .select('wallet_address, nft_id, collection_name, created_at, token_id')
      .eq('vote_type', 'fire')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('❌ Error fetching FIRE votes:', error);
      return;
    }
    
    console.log(`📊 Total FIRE votes found: ${fireVotes.length}\n`);
    
    // Analyze wallet patterns
    console.log('=== 🔍 WALLET ANALYSIS ===');
    const walletStats = {};
    
    fireVotes.forEach(vote => {
      if (!walletStats[vote.wallet_address]) {
        walletStats[vote.wallet_address] = {
          totalVotes: 0,
          collections: new Set(),
          nfts: new Set(),
          firstVote: vote.created_at,
          lastVote: vote.created_at
        };
      }
      
      const stats = walletStats[vote.wallet_address];
      stats.totalVotes++;
      stats.collections.add(vote.collection_name);
      stats.nfts.add(vote.nft_id);
      
      if (new Date(vote.created_at) < new Date(stats.firstVote)) {
        stats.firstVote = vote.created_at;
      }
      if (new Date(vote.created_at) > new Date(stats.lastVote)) {
        stats.lastVote = vote.created_at;
      }
    });
    
    // Sort wallets by vote count
    const sortedWallets = Object.entries(walletStats)
      .sort(([,a], [,b]) => b.totalVotes - a.totalVotes);
    
    console.log('Top FIRE voters:');
    sortedWallets.slice(0, 10).forEach(([wallet, stats]) => {
      // Assess wallet type
      let assessment = 'REAL_USER';
      if (wallet.includes('0134ed2fA6832e6dE142B4F986679D340E308CF4')) assessment = '🧪 TEST_WALLET_1';
      else if (wallet.includes('d593c708833d606f28E81a147FD33edFeAdE0Aa9')) assessment = '🧪 TEST_WALLET_2';
      else if (wallet.includes('1234567890123456789012345678901234567890')) assessment = '🧪 OBVIOUS_TEST';
      else if (wallet.length !== 42 || !wallet.startsWith('0x')) assessment = '❌ INVALID_FORMAT';
      
      console.log(`  ${wallet.slice(0, 10)}...`);
      console.log(`    📊 ${stats.totalVotes} votes across ${stats.collections.size} collections`);
      console.log(`    🎯 Collections: ${Array.from(stats.collections).join(', ')}`);
      console.log(`    ⏰ ${stats.firstVote.slice(0, 19)} → ${stats.lastVote.slice(0, 19)}`);
      console.log(`    🔍 ${assessment}\n`);
    });
    
    // Analyze RUYUI specifically
    console.log('=== 🎨 RUYUI COLLECTION ANALYSIS ===');
    const ruyuiVotes = fireVotes.filter(vote => vote.collection_name === 'RUYUI');
    console.log(`RUYUI FIRE votes: ${ruyuiVotes.length}`);
    
    const ruyuiByWallet = {};
    ruyuiVotes.forEach(vote => {
      if (!ruyuiByWallet[vote.wallet_address]) {
        ruyuiByWallet[vote.wallet_address] = [];
      }
      ruyuiByWallet[vote.wallet_address].push(vote);
    });
    
    Object.entries(ruyuiByWallet).forEach(([wallet, votes]) => {
      let assessment = 'REAL_USER';
      if (wallet.includes('0134ed2fA6832e6dE142B4F986679D340E308CF4')) assessment = '🧪 TEST_WALLET_1';
      else if (wallet.includes('d593c708833d606f28E81a147FD33edFeAdE0Aa9')) assessment = '🧪 TEST_WALLET_2';
      else if (wallet.includes('1234567890123456789012345678901234567890')) assessment = '🧪 OBVIOUS_TEST';
      
      console.log(`  ${wallet.slice(0, 10)}...: ${votes.length} RUYUI votes (${assessment})`);
      votes.forEach(vote => {
        console.log(`    - ${vote.token_id} at ${vote.created_at.slice(0, 19)}`);
      });
    });
    
    // Timing analysis
    console.log('\n=== ⏰ TIMING ANALYSIS ===');
    const hourlyVotes = {};
    
    fireVotes.forEach(vote => {
      const hour = vote.created_at.slice(0, 13) + ':00:00';
      const key = `${vote.wallet_address}|${hour}`;
      
      if (!hourlyVotes[key]) {
        hourlyVotes[key] = {
          wallet: vote.wallet_address,
          hour,
          votes: 0,
          collections: new Set()
        };
      }
      
      hourlyVotes[key].votes++;
      hourlyVotes[key].collections.add(vote.collection_name);
    });
    
    const rapidFire = Object.values(hourlyVotes)
      .filter(entry => entry.votes >= 3)
      .sort((a, b) => b.votes - a.votes);
    
    if (rapidFire.length > 0) {
      console.log('Rapid-fire voting detected (3+ votes per hour):');
      rapidFire.forEach(entry => {
        let assessment = 'REAL_USER';
        if (entry.wallet.includes('0134ed2fA6832e6dE142B4F986679D340E308CF4')) assessment = '🧪 TEST_WALLET_1';
        else if (entry.wallet.includes('d593c708833d606f28E81a147FD33edFeAdE0Aa9')) assessment = '🧪 TEST_WALLET_2';
        else if (entry.wallet.includes('1234567890123456789012345678901234567890')) assessment = '🧪 OBVIOUS_TEST';
        
        console.log(`  ${entry.wallet.slice(0, 10)}...: ${entry.votes} votes in ${entry.hour}`);
        console.log(`    Collections: ${Array.from(entry.collections).join(', ')} (${assessment})`);
      });
    } else {
      console.log('✅ No rapid-fire voting patterns detected');
    }
    
    // Summary and recommendations
    console.log('\n=== 📋 SUMMARY & RECOMMENDATIONS ===');
    const testWallets = sortedWallets.filter(([wallet]) => 
      wallet.includes('0134ed') || wallet.includes('d593c7') || wallet.includes('1234567')
    );
    
    const testVoteCount = testWallets.reduce((sum, [, stats]) => sum + stats.totalVotes, 0);
    
    console.log(`🧪 Test wallets identified: ${testWallets.length}`);
    console.log(`📊 Test votes count: ${testVoteCount}/${fireVotes.length} (${Math.round(testVoteCount/fireVotes.length*100)}%)`);
    
    if (testVoteCount > fireVotes.length * 0.3) {
      console.log('⚠️  HIGH TEST DATA POLLUTION - Recommend cleanup');
    } else if (testVoteCount > 0) {
      console.log('⚡ MODERATE TEST DATA - Consider selective cleanup');
    } else {
      console.log('✅ NO OBVIOUS TEST DATA DETECTED');
    }
    
    const ruyuiTestVotes = Object.entries(ruyuiByWallet)
      .filter(([wallet]) => wallet.includes('0134ed') || wallet.includes('d593c7') || wallet.includes('1234567'))
      .reduce((sum, [, votes]) => sum + votes.length, 0);
    
    console.log(`🎨 RUYUI test votes: ${ruyuiTestVotes}/${ruyuiVotes.length} RUYUI votes from test wallets`);
    
    if (ruyuiTestVotes > ruyuiVotes.length * 0.5) {
      console.log('🚨 RUYUI DOMINANCE LIKELY FROM TEST DATA - Recommend cleanup');
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

investigateFireVotes().then(() => {
  console.log('\n✅ Investigation complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
