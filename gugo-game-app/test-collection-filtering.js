#!/usr/bin/env node

// 🎛️ Test Collection Filtering
// Verifies that deactivated collections don't appear in matchups

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testCollectionFiltering() {
  console.log('🎛️ Testing collection filtering system...\n');

  try {
    // 1. Check current collection status
    console.log('📊 Step 1: Current collection status');
    const { data: collections, error: collectionError } = await supabase
      .rpc('get_collection_statistics');

    if (collectionError) {
      throw new Error(`Failed to get collections: ${collectionError.message}`);
    }

    console.log('Collection Status:');
    collections.forEach(collection => {
      const status = collection.active ? '✅ Active' : '❌ Inactive';
      console.log(`  ${status} ${collection.collection_name} (${collection.nft_count} NFTs)`);
    });

    const activeCollections = collections.filter(c => c.active);
    const inactiveCollections = collections.filter(c => !c.active);
    
    console.log(`\nSummary: ${activeCollections.length} active, ${inactiveCollections.length} inactive\n`);

    if (inactiveCollections.length === 0) {
      console.log('⚠️ No inactive collections found. To test filtering:');
      console.log('   1. Go to /admin in your browser');
      console.log('   2. Click some status buttons to deactivate collections');
      console.log('   3. Run this test again');
      return;
    }

    // 2. Test enhanced system functions
    console.log('🧠 Step 2: Testing enhanced functions...');

    // Test slider selection
    console.log('\n📊 Testing enhanced slider selection:');
    const { data: sliderResult, error: sliderError } = await supabase
      .rpc('find_optimal_slider_nft', { max_candidates: 5 });

    if (sliderError) {
      console.log(`   ❌ Slider test failed: ${sliderError.message}`);
    } else if (sliderResult && sliderResult.length > 0) {
      const nftId = sliderResult[0].nft_id;
      
      // Get the NFT details
      const { data: nft, error: nftError } = await supabase
        .from('nfts')
        .select('collection_name, name')
        .eq('id', nftId)
        .single();

      if (nftError) {
        console.log(`   ❌ Could not fetch NFT details: ${nftError.message}`);
      } else {
        const isFromActiveCollection = activeCollections.some(c => c.collection_name === nft.collection_name);
        const status = isFromActiveCollection ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status} Selected ${nft.collection_name}/${nft.name} (from ${isFromActiveCollection ? 'active' : 'INACTIVE'} collection)`);
      }
    } else {
      console.log('   ❌ No slider candidates found');
    }

    // Test same collection matchup
    console.log('\n🎨 Testing same collection matchup:');
    const { data: sameCollResult, error: sameCollError } = await supabase
      .rpc('find_optimal_same_collection_matchup_lite', { max_candidates: 5 });

    if (sameCollError) {
      console.log(`   ❌ Same collection test failed: ${sameCollError.message}`);
    } else if (sameCollResult && sameCollResult.length > 0) {
      const matchup = sameCollResult[0];
      
      // Get both NFT details
      const { data: nfts, error: nftsError } = await supabase
        .from('nfts')
        .select('id, collection_name, name')
        .in('id', [matchup.nft_a_id, matchup.nft_b_id]);

      if (nftsError) {
        console.log(`   ❌ Could not fetch matchup NFT details: ${nftsError.message}`);
      } else {
        const nftA = nfts.find(n => n.id === matchup.nft_a_id);
        const nftB = nfts.find(n => n.id === matchup.nft_b_id);
        
        if (nftA && nftB) {
          const isAActive = activeCollections.some(c => c.collection_name === nftA.collection_name);
          const isBActive = activeCollections.some(c => c.collection_name === nftB.collection_name);
          const allActive = isAActive && isBActive;
          const status = allActive ? '✅ PASS' : '❌ FAIL';
          
          console.log(`   ${status} Matchup: ${nftA.collection_name}/${nftA.name} vs ${nftB.collection_name}/${nftB.name}`);
          console.log(`     NFT A from ${isAActive ? 'active' : 'INACTIVE'} collection`);
          console.log(`     NFT B from ${isBActive ? 'active' : 'INACTIVE'} collection`);
        }
      }
    } else {
      console.log('   ❌ No same collection candidates found');
    }

    // Test cross collection matchup
    console.log('\n🌍 Testing cross collection matchup:');
    const { data: crossCollResult, error: crossCollError } = await supabase
      .rpc('find_optimal_cross_collection_matchup_lite', { max_candidates: 5 });

    if (crossCollError) {
      console.log(`   ❌ Cross collection test failed: ${crossCollError.message}`);
    } else if (crossCollResult && crossCollResult.length > 0) {
      const matchup = crossCollResult[0];
      
      // Get both NFT details
      const { data: nfts, error: nftsError } = await supabase
        .from('nfts')
        .select('id, collection_name, name')
        .in('id', [matchup.nft_a_id, matchup.nft_b_id]);

      if (nftsError) {
        console.log(`   ❌ Could not fetch cross-collection NFT details: ${nftsError.message}`);
      } else {
        const nftA = nfts.find(n => n.id === matchup.nft_a_id);
        const nftB = nfts.find(n => n.id === matchup.nft_b_id);
        
        if (nftA && nftB) {
          const isAActive = activeCollections.some(c => c.collection_name === nftA.collection_name);
          const isBActive = activeCollections.some(c => c.collection_name === nftB.collection_name);
          const allActive = isAActive && isBActive;
          const status = allActive ? '✅ PASS' : '❌ FAIL';
          
          console.log(`   ${status} Cross-collection: ${nftA.collection_name}/${nftA.name} vs ${nftB.collection_name}/${nftB.name}`);
          console.log(`     NFT A from ${isAActive ? 'active' : 'INACTIVE'} collection`);
          console.log(`     NFT B from ${isBActive ? 'active' : 'INACTIVE'} collection`);
        }
      }
    } else {
      console.log('   ❌ No cross collection candidates found');
    }

    console.log('\n🎯 Test complete!');
    console.log('\nTo test the UI integration:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Open browser console');
    console.log('3. Vote on NFTs and watch for collection filtering logs');
    console.log('4. Look for messages like:');
    console.log('   "🎛️ Collection Status: X/Y collections active"');
    console.log('   "✅ Active collections: ..."');
    console.log('   "❌ Inactive collections: ..."');
    console.log('   "🎨 Enhanced matchup: Collection/NFT vs Collection/NFT"');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCollectionFiltering().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

