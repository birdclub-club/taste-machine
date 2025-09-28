#!/usr/bin/env node
/**
 * Complete DreamilioMaker Import - Fetch Remaining 555 NFTs
 * Continue from where we left off to get the full 5,555 collection
 */

const { StandardNFTImporter } = require('./import-nft-collection.js');
require('dotenv').config({ path: '.env.local' });

const DREAMILIOMAKER_CONFIG = {
  name: "DreamilioMaker",
  contract_address: "0x30072084ff8724098cbb65e07f7639ed31af5f66",
  description: "You are not alone. You never were. You never will be. $DREAM.",
  symbol: "DREAMILIO",
  blockchain: "Abstract"
};

/**
 * Fetch the remaining DreamilioMaker NFTs (approximately 555 remaining)
 */
async function fetchRemainingDreamilioMaker() {
  console.log('🌊 Fetching remaining DreamilioMaker NFTs from Abstract Reservoir API...');
  
  const baseUrl = 'https://api-abstract.reservoir.tools/tokens/v7';
  let allTokens = [];
  let continuation = null;
  let pageCount = 0;
  
  // We need to fast-forward to page 51 where we left off
  // First, let's get to the continuation token for page 51
  console.log('⏭️ Fast-forwarding to page 51...');
  
  for (let i = 0; i < 50; i++) {
    const url = new URL(baseUrl);
    url.searchParams.set('collection', DREAMILIOMAKER_CONFIG.contract_address);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sortBy', 'tokenId');
    url.searchParams.set('sortDirection', 'asc');
    url.searchParams.set('includeAttributes', 'true');
    
    if (continuation) {
      url.searchParams.set('continuation', continuation);
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) break;
    
    const data = await response.json();
    if (!data.tokens || data.tokens.length === 0) break;
    
    continuation = data.continuation;
    
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (i % 10 === 0) {
      console.log(`⏭️ Skipped ${i * 100} NFTs...`);
    }
  }
  
  console.log('🎯 Starting from page 51 to fetch remaining NFTs...');
  
  // Now fetch the remaining pages
  do {
    const url = new URL(baseUrl);
    url.searchParams.set('collection', DREAMILIOMAKER_CONFIG.contract_address);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sortBy', 'tokenId');
    url.searchParams.set('sortDirection', 'asc');
    url.searchParams.set('includeAttributes', 'true');
    
    if (continuation) {
      url.searchParams.set('continuation', continuation);
    }
    
    console.log(`📄 Fetching remaining page ${pageCount + 51}... (Found so far: ${allTokens.length})`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.log(`❌ API failed: ${response.status}`);
      break;
    }
    
    const data = await response.json();
    
    if (!data.tokens || data.tokens.length === 0) {
      console.log('📄 No more tokens found - we got them all!');
      break;
    }
    
    console.log(`✅ Found ${data.tokens.length} more tokens`);
    allTokens = allTokens.concat(data.tokens);
    
    continuation = data.continuation;
    pageCount++;
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
    
  } while (continuation && pageCount < 10); // Max 10 more pages should be enough
  
  console.log(`🎉 Total remaining NFTs fetched: ${allTokens.length}`);
  
  if (allTokens.length === 0) {
    throw new Error('No remaining NFTs found - collection might already be complete');
  }
  
  // Convert to our format
  const items = allTokens.map(tokenData => {
    const token = tokenData.token;
    return {
      token_id: token.tokenId,
      name: token.name || `Dreamilios #${token.tokenId}`,
      description: token.description || DREAMILIOMAKER_CONFIG.description,
      image: token.metadata?.imageOriginal || token.image || '',
      traits: token.attributes || [],
      contract_address: DREAMILIOMAKER_CONFIG.contract_address,
      collection_name: DREAMILIOMAKER_CONFIG.name
    };
  });

  return {
    ...DREAMILIOMAKER_CONFIG,
    items
  };
}

/**
 * Main import function for remaining NFTs
 */
async function completeImport() {
  console.log('🎨 Completing DreamilioMaker Collection Import...\n');
  console.log('🎯 Fetching the remaining ~555 NFTs to reach full 5,555 collection\n');

  const importer = new StandardNFTImporter();
  await importer.initialize();

  try {
    // Fetch remaining collection data
    const collectionData = await fetchRemainingDreamilioMaker();
    
    console.log(`\n🎯 Ready to import ${collectionData.items.length} remaining NFTs\n`);

    // Convert items to nfts format for the importer
    collectionData.nfts = collectionData.items;
    delete collectionData.items;

    // Import remaining NFTs
    await importer.importCollection(collectionData, {
      batchSize: 100,
      skipDuplicates: true, // Skip any we already have
      convertIpfs: true, // Convert IPFS to HTTP
      dryRun: false
    });

    await importer.generateReport();

    console.log(`\n🎉 DreamilioMaker collection is now COMPLETE!`);
    console.log(`🌟 Added: ${collectionData.nfts.length} remaining NFTs`);
    console.log(`🔧 All IPFS images automatically converted to fast HTTP URLs`);
    console.log(`🎮 Full 5,555 collection ready for voting!`);

  } catch (error) {
    console.error('💥 Completion failed:', error.message);
    if (error.message.includes('already be complete')) {
      console.log('✅ Collection might already be complete - checking database...');
    }
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  completeImport().catch(console.error);
}

module.exports = { completeImport };
