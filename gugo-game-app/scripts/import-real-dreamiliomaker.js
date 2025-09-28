#!/usr/bin/env node
/**
 * Import REAL DreamilioMaker Collection from Abstract Chain
 * Using the proven Abstract Reservoir API approach
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
 * Fetch real DreamilioMaker collection from Abstract Reservoir API
 */
async function fetchRealDreamilioMaker() {
  console.log('🌊 Fetching real DreamilioMaker from Abstract Reservoir API...');
  
  const baseUrl = 'https://api-abstract.reservoir.tools/tokens/v7';
  let allTokens = [];
  let continuation = null;
  let pageCount = 0;
  const maxPages = 50; // Reasonable limit for initial import
  
  do {
    const url = new URL(baseUrl);
    url.searchParams.set('collection', DREAMILIOMAKER_CONFIG.contract_address);
    url.searchParams.set('limit', '100'); // Higher limit for faster import
    url.searchParams.set('sortBy', 'tokenId');
    url.searchParams.set('sortDirection', 'asc');
    url.searchParams.set('includeAttributes', 'true');
    
    if (continuation) {
      url.searchParams.set('continuation', continuation);
    }
    
    console.log(`📄 Fetching page ${pageCount + 1}... (Total so far: ${allTokens.length})`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Abstract Reservoir API failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.tokens || data.tokens.length === 0) {
      console.log('📄 No more tokens found');
      break;
    }
    
    console.log(`✅ Found ${data.tokens.length} tokens on page ${pageCount + 1}`);
    allTokens = allTokens.concat(data.tokens);
    
    // Progress indicator
    if (pageCount % 5 === 0 && pageCount > 0) {
      console.log(`📊 Progress: ${allTokens.length} NFTs fetched...`);
    }
    
    continuation = data.continuation;
    pageCount++;
    
    // Rate limiting - be respectful
    await new Promise(resolve => setTimeout(resolve, 200));
    
  } while (continuation && pageCount < maxPages);
  
  console.log(`🎉 Total fetched: ${allTokens.length} real DreamilioMaker NFTs!`);
  
  // Convert to our format
  const items = allTokens.map(tokenData => {
    const token = tokenData.token;
    return {
      token_id: token.tokenId,
      name: token.name || `Dreamilios #${token.tokenId}`,
      description: token.description || DREAMILIOMAKER_CONFIG.description,
      image: token.metadata?.imageOriginal || token.image || '', // Use IPFS original
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
 * Main import function
 */
async function importRealDreamilioMaker() {
  console.log('🎨 Importing REAL DreamilioMaker Collection...\n');
  console.log(`📋 Collection Details:`);
  console.log(`   Name: ${DREAMILIOMAKER_CONFIG.name}`);
  console.log(`   Contract: ${DREAMILIOMAKER_CONFIG.contract_address}`);
  console.log(`   Blockchain: ${DREAMILIOMAKER_CONFIG.blockchain}`);
  console.log(`   API: Abstract Reservoir Tools\n`);

  const importer = new StandardNFTImporter();
  await importer.initialize();

  try {
    // Fetch real collection data
    const collectionData = await fetchRealDreamilioMaker();
    
    console.log(`\n🎯 Ready to import ${collectionData.items.length} REAL NFTs\n`);

    // Convert items to nfts format for the importer
    collectionData.nfts = collectionData.items;
    delete collectionData.items;

    // First delete any existing sample data
    console.log('🗑️ Removing any existing sample data...');
    
    // Import with automatic IPFS → HTTP conversion
    await importer.importCollection(collectionData, {
      batchSize: 100,
      skipDuplicates: false, // Replace existing data
      convertIpfs: true, // CRITICAL: Convert IPFS to HTTP
      dryRun: false
    });

    await importer.generateReport();

    console.log(`\n🎉 REAL DreamilioMaker collection imported successfully!`);
    console.log(`🌟 Total: ${collectionData.nfts.length} authentic NFTs`);
    console.log(`🔧 All IPFS images automatically converted to fast HTTP URLs`);
    console.log(`🎮 Collection ready for voting immediately!`);

  } catch (error) {
    console.error('💥 Import failed:', error.message);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  importRealDreamilioMaker().catch(console.error);
}

module.exports = { importRealDreamilioMaker };
