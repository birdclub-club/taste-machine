#!/usr/bin/env node

/**
 * NFT Collection Import Script
 * 
 * This script imports NFT collections into Supabase for "Taste Machine" game.
 * Currently supports CoinGecko API and can be extended for other sources.
 */

const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Configuration
const BATCH_SIZE = 50; // Number of NFTs to process at once (increased for large collections)
const DELAY_MS = 1000; // Delay between API calls to avoid rate limiting

// Abstract Chain configuration
const ABSTRACT_TESTNET_RPC = 'https://api.testnet.abs.xyz';
const ABSTRACT_MAINNET_RPC = 'https://api.mainnet.abs.xyz';

// Standard ERC721 ABI for basic NFT operations
const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)'
];

/**
 * Fetch real NFT collection data from OpenSea API
 */
async function fetchFromOpenSea(collectionSlug = 'bearish') {
  try {
    console.log(`🔍 Fetching ${collectionSlug} collection from OpenSea...`);
    
    // First get collection info
    const collectionResponse = await fetch(`https://api.opensea.io/api/v1/collection/${collectionSlug}`, {
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY || '' // Optional API key
      }
    });
    
    if (!collectionResponse.ok) {
      throw new Error(`Collection not found: ${collectionResponse.status}`);
    }
    
    const collectionData = await collectionResponse.json();
    console.log(`✅ Found collection: ${collectionData.collection.name}`);
    
    // Then get assets from the collection
    const assetsResponse = await fetch(`https://api.opensea.io/api/v1/assets?collection=${collectionSlug}&limit=50`, {
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY || ''
      }
    });
    
    if (!assetsResponse.ok) {
      throw new Error(`Assets fetch failed: ${assetsResponse.status}`);
    }
    
    const assetsData = await assetsResponse.json();
    console.log(`📦 Found ${assetsData.assets.length} NFTs`);
    
    const items = assetsData.assets.map(asset => ({
      token_id: asset.token_id,
      name: asset.name || `${collectionData.collection.name} #${asset.token_id}`,
      description: asset.description || collectionData.collection.description,
      image: asset.image_url || asset.image_original_url,
      traits: asset.traits || [],
      contract_address: asset.asset_contract.address
    }));
    
    return {
      name: collectionData.collection.name,
      description: collectionData.collection.description,
      contract_address: collectionData.collection.primary_asset_contracts[0]?.address,
      items: items
    };
    
  } catch (error) {
    console.log('❌ OpenSea failed:', error.message);
    return await fetchFromReservoir();
  }
}

/**
 * Fetch NFT metadata from IPFS/HTTP URL
 */
async function fetchMetadata(tokenURI) {
  try {
    if (tokenURI.startsWith('ipfs://')) {
      // Convert IPFS URL to HTTP gateway
      const ipfsHash = tokenURI.replace('ipfs://', '');
      const httpUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      tokenURI = httpUrl;
    }
    
    const response = await fetch(tokenURI);
    if (!response.ok) {
      throw new Error(`Metadata fetch failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.log(`⚠️ Metadata fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * Fetch NFTs directly from Abstract Chain using ethers.js
 */
async function fetchFromAbstractChain(contractAddress, isMainnet = false) {
  console.log(`🔗 Fetching NFTs from Abstract Chain (${isMainnet ? 'mainnet' : 'testnet'})...`);
  
  try {
    // Connect to Abstract Chain
    const rpcUrl = isMainnet ? ABSTRACT_MAINNET_RPC : ABSTRACT_TESTNET_RPC;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    
    // Get basic contract info
    const [name, symbol, totalSupply] = await Promise.all([
      contract.name().catch(() => 'Unknown Collection'),
      contract.symbol().catch(() => 'UNK'),
      contract.totalSupply().catch(() => BigInt(0))
    ]);
    
    console.log(`📋 Contract Info: ${name} (${symbol}) - Total Supply: ${totalSupply}`);
    
    if (totalSupply === BigInt(0)) {
      throw new Error('No NFTs minted in this contract yet');
    }
    
    // Fetch first 50 NFTs (or all if less than 50)
    const maxTokens = Number(totalSupply); // Fetch complete collection
    const items = [];
    
    console.log(`🔍 Fetching metadata for ${maxTokens} NFTs...`);
    
    for (let tokenId = 0; tokenId < maxTokens; tokenId++) {
      try {
        // Get token URI
        const tokenURI = await contract.tokenURI(tokenId);
        
        // Fetch metadata
        const metadata = await fetchMetadata(tokenURI);
        
        const nft = {
          token_id: tokenId.toString(),
          name: metadata?.name || `${name} #${tokenId}`,
          description: metadata?.description || `${name} NFT`,
          image: metadata?.image || metadata?.image_url,
          traits: metadata?.attributes || [],
          contract_address: contractAddress
        };
        
        items.push(nft);
        
        if ((tokenId + 1) % 100 === 0 || tokenId === 0 || tokenId === maxTokens - 1) {
          console.log(`✅ Processed ${tokenId + 1}/${maxTokens} NFTs`);
        }
        
        // Rate limiting (reduced for large collections)
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.log(`⚠️ Failed to fetch token ${tokenId}: ${error.message}`);
        
        // Add basic NFT data even if metadata fails
        items.push({
          token_id: tokenId.toString(),
          name: `${name} #${tokenId}`,
          description: `${name} NFT from Abstract Chain`,
          image: `https://picsum.photos/400/400?random=${tokenId}`, // Fallback image
          traits: [],
          contract_address: contractAddress
        });
      }
    }
    
    console.log(`✅ Successfully fetched ${items.length} NFTs from Abstract Chain`);
    
    return {
      name: name,
      description: `${name} NFT Collection from Abstract Chain`,
      contract_address: contractAddress,
      items: items
    };
    
  } catch (error) {
    console.log(`❌ Abstract Chain fetch failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch real Bearish NFTs using multiple APIs
 */
async function fetchRealBearishNFTs(contractAddress = '0x516dc288e26b34557f68ea1c1ff13576eff8a168') {
  console.log(`🔍 Fetching real Bearish NFTs from contract ${contractAddress}...`);
  
  // For Bearish contract (0x516dc288e26b34557f68ea1c1ff13576eff8a168), try Abstract Chain first
  const isBearishContract = contractAddress.toLowerCase() === '0x516dc288e26b34557f68ea1c1ff13576eff8a168';
  
  // Try multiple approaches to get real NFT data
  const methods = isBearishContract ? [
    // For Bearish, try Reservoir first (most reliable for metadata)
    () => fetchFromReservoirV7(contractAddress),
    () => fetchBearishFromReservoir(contractAddress),
    // Then Abstract Chain
    () => fetchFromAbstractChain(contractAddress, false), // testnet
    () => fetchFromAbstractChain(contractAddress, true),  // mainnet
    // Then try Ethereum-based APIs as fallback
    () => fetchFromMoralis(contractAddress),
    () => fetchFromAlchemy(contractAddress),
    () => fetchFromOpenSeaV2(contractAddress),
    () => fetchFromSimpleHash(contractAddress)
  ] : [
    // For other contracts, try Ethereum APIs first
    () => fetchFromMoralis(contractAddress),
    () => fetchFromAlchemy(contractAddress),
    () => fetchFromOpenSeaV2(contractAddress),
    () => fetchFromSimpleHash(contractAddress),
    () => fetchFromReservoirV7(contractAddress),
    // Then try Abstract Chain as fallback
    () => fetchFromAbstractChain(contractAddress, false),
    () => fetchFromAbstractChain(contractAddress, true)
  ];
  
  for (const method of methods) {
    try {
      const result = await method();
      if (result && result.items && result.items.length > 0) {
        return result;
      }
    } catch (error) {
      console.log(`⚠️  Method failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('No real Bearish NFT data found from any API source');
}

/**
 * Fetch from Moralis NFT API - try different approaches
 */
async function fetchFromMoralis(contractAddress) {
  console.log('🐻 Trying Moralis API...');
  
  // Try multiple Moralis endpoints using the correct format
  const endpoints = [
    // Correct getContractNFTs endpoint format
    {
      url: `https://deep-index.moralis.io/api/v2.2/nft/${contractAddress}?chain=eth&format=decimal&limit=50`,
      name: 'getContractNFTs'
    },
    // Try with normalizeMetadata
    {
      url: `https://deep-index.moralis.io/api/v2.2/nft/${contractAddress}?chain=eth&format=decimal&limit=50&normalizeMetadata=true`,
      name: 'getContractNFTs with metadata'
    },
    // Try different chain just in case (Polygon)
    {
      url: `https://deep-index.moralis.io/api/v2.2/nft/${contractAddress}?chain=polygon&format=decimal&limit=50`,
      name: 'Polygon chain'
    }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Trying ${endpoint.name}...`);
      
      const response = await fetch(endpoint.url, {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY || 'demo'
        }
      });
      
      console.log(`📡 Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Response keys:`, Object.keys(data));
        
        console.log(`📄 Full response:`, JSON.stringify(data, null, 2));
        
        if (data.result && data.result.length > 0) {
          console.log(`✅ Found ${data.result.length} NFTs from Moralis (${endpoint.name})`);
          console.log(`🔍 Sample NFT:`, JSON.stringify(data.result[0], null, 2).substring(0, 500));
          
          const items = data.result.map(nft => {
            let metadata = {};
            try {
              metadata = nft.metadata ? JSON.parse(nft.metadata) : {};
            } catch (e) {
              metadata = nft.normalized_metadata || {};
            }
            
            return {
              token_id: nft.token_id,
              name: metadata.name || nft.name || `Bearish #${nft.token_id}`,
              description: metadata.description || 'Bearish NFT from Moralis',
              image: metadata.image || metadata.image_url || nft.token_uri,
              traits: metadata.attributes || [],
              contract_address: contractAddress
            };
          });
          
          return {
            name: data.result[0]?.name || 'Bearish Collection',
            description: 'Bearish NFT Collection fetched from Moralis',
            contract_address: contractAddress,
            items: items
          };
        } else {
          console.log(`⚠️  No results in response from ${endpoint.name}`);
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ ${endpoint.name} failed: ${response.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name} error:`, error.message);
    }
  }
  
  throw new Error('All Moralis endpoints failed');
}

/**
 * Fetch from Alchemy NFT API
 */
async function fetchFromAlchemy(contractAddress) {
  console.log('🔮 Trying Alchemy API...');
  const response = await fetch(`https://eth-mainnet.g.alchemy.com/nft/v3/demo/getNFTsForCollection?contractAddress=${contractAddress}&limit=50`);
  
  if (!response.ok) throw new Error(`Alchemy failed: ${response.status}`);
  
  const data = await response.json();
  if (!data.nfts || data.nfts.length === 0) throw new Error('No NFTs from Alchemy');
  
  console.log(`✅ Found ${data.nfts.length} NFTs from Alchemy`);
  
  const items = data.nfts.map(nft => ({
    token_id: nft.tokenId,
    name: nft.name || `Bearish #${nft.tokenId}`,
    description: nft.description || 'Bearish NFT',
    image: nft.image?.cachedUrl || nft.image?.originalUrl,
    traits: nft.rawMetadata?.attributes || [],
    contract_address: contractAddress
  }));
  
  return {
    name: 'Bearish',
    description: 'Bearish NFT Collection',
    contract_address: contractAddress,
    items: items
  };
}

/**
 * Fetch from OpenSea V2 API
 */
async function fetchFromOpenSeaV2(contractAddress) {
  console.log('🌊 Trying OpenSea V2 API...');
  const response = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts?limit=50`);
  
  if (!response.ok) throw new Error(`OpenSea V2 failed: ${response.status}`);
  
  const data = await response.json();
  if (!data.nfts || data.nfts.length === 0) throw new Error('No NFTs from OpenSea V2');
  
  console.log(`✅ Found ${data.nfts.length} NFTs from OpenSea V2`);
  
  const items = data.nfts.map(nft => ({
    token_id: nft.identifier,
    name: nft.name || `Bearish #${nft.identifier}`,
    description: nft.description || 'Bearish NFT',
    image: nft.image_url,
    traits: nft.traits || [],
    contract_address: contractAddress
  }));
  
  return {
    name: data.nfts[0]?.collection?.name || 'Bearish',
    description: data.nfts[0]?.collection?.description || 'Bearish NFT Collection',
    contract_address: contractAddress,
    items: items
  };
}

/**
 * Fetch from SimpleHash API
 */
async function fetchFromSimpleHash(contractAddress) {
  console.log('🔗 Trying SimpleHash API...');
  const response = await fetch(`https://api.simplehash.com/api/v0/nfts/ethereum/${contractAddress}?limit=50`);
  
  if (!response.ok) throw new Error(`SimpleHash failed: ${response.status}`);
  
  const data = await response.json();
  if (!data.nfts || data.nfts.length === 0) throw new Error('No NFTs from SimpleHash');
  
  console.log(`✅ Found ${data.nfts.length} NFTs from SimpleHash`);
  
  const items = data.nfts.map(nft => ({
    token_id: nft.token_id,
    name: nft.name || `Bearish #${nft.token_id}`,
    description: nft.description || 'Bearish NFT',
    image: nft.image_url,
    traits: nft.extra_metadata?.attributes || [],
    contract_address: contractAddress
  }));
  
  return {
    name: data.nfts[0]?.collection?.name || 'Bearish',
    description: 'Bearish NFT Collection',
    contract_address: contractAddress,
    items: items
  };
}

/**
 * Specialized function to fetch BEARISH NFTs from Reservoir with multiple attempts
 */
async function fetchBearishFromReservoir(contractAddress) {
  console.log('🐻 Trying specialized Bearish Reservoir fetch...');
  
  // Try different Reservoir endpoints and configurations - using Abstract Chain API
  const attempts = [
    // Try Abstract Chain Reservoir API by contract address
    {
      url: 'https://api-abstract.reservoir.tools/tokens/v7',
      params: { contract: contractAddress, limit: '100', includeAttributes: 'true', includeTopBid: 'true' }
    },
    // Try Abstract Chain collections endpoint
    {
      url: 'https://api-abstract.reservoir.tools/collections/v5',
      params: { contract: contractAddress }
    },
    // Try different token API versions on Abstract
    {
      url: 'https://api-abstract.reservoir.tools/tokens/v6',
      params: { contract: contractAddress, limit: '100' }
    },
    // Fallback to main Reservoir API
    {
      url: 'https://api.reservoir.tools/tokens/v7',
      params: { contract: contractAddress, limit: '100', includeAttributes: 'true' }
    }
  ];
  
  for (const attempt of attempts) {
    try {
      console.log(`🔍 Trying: ${attempt.url} with params:`, attempt.params);
      
      const url = new URL(attempt.url);
      Object.entries(attempt.params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      const response = await fetch(url.toString());
      console.log(`📡 Response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`⚠️ Request failed: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`📊 Response keys:`, Object.keys(data));
      console.log(`📄 Sample response:`, JSON.stringify(data, null, 2).substring(0, 500));
      
      // Handle different response structures
      let tokens = [];
      if (data.tokens && data.tokens.length > 0) {
        tokens = data.tokens;
      } else if (data.collections && data.collections.length > 0) {
        // If we got collection info, try to fetch tokens for that collection
        const collection = data.collections[0];
        console.log(`🎯 Found collection: ${collection.name} (${collection.id})`);
        
        const tokenUrl = new URL('https://api-abstract.reservoir.tools/tokens/v7');
        tokenUrl.searchParams.set('collection', collection.id);
        tokenUrl.searchParams.set('limit', '100');
        tokenUrl.searchParams.set('includeAttributes', 'true');
        
        const tokenResponse = await fetch(tokenUrl.toString());
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          tokens = tokenData.tokens || [];
        }
      }
      
      if (tokens.length > 0) {
        console.log(`✅ Found ${tokens.length} NFTs from Reservoir`);
        
        const items = tokens.map(token => {
          let imageUrl = token.token?.image || token.token?.media || token.image || token.media;
          
          // Convert IPFS URLs to HTTP gateway URLs
          if (imageUrl && imageUrl.startsWith('ipfs://')) {
            const ipfsHash = imageUrl.replace('ipfs://', '');
            imageUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
          }
          
          return {
            token_id: token.token?.tokenId || token.tokenId,
            name: token.token?.name || token.name || `BEARISH #${token.token?.tokenId || token.tokenId}`,
            description: token.token?.description || token.description || 'BEARISH NFT from Abstract Chain',
            image: imageUrl,
            traits: token.token?.attributes || token.attributes || [],
            contract_address: contractAddress,
            floor_price: token.market?.floorAsk?.price?.amount?.native || null
          };
        });
        
        return {
          name: tokens[0]?.token?.collection?.name || 'BEARISH',
          description: 'BEARISH NFT Collection from Reservoir',
          contract_address: contractAddress,
          items: items
        };
      }
      
    } catch (error) {
      console.log(`❌ Attempt failed:`, error.message);
      continue;
    }
  }
  
  throw new Error('All Reservoir attempts failed for BEARISH');
}

/**
 * Fetch from Reservoir V7 API with proper pagination
 */
async function fetchFromReservoirV7(contractAddress) {
  console.log('🌊 Trying Reservoir V7 API...');
  
  // For BEARISH contract, use Abstract Chain API
  const isBearishContract = contractAddress.toLowerCase() === '0x516dc288e26b34557f68ea1c1ff13576eff8a168';
  const baseUrl = isBearishContract ? 'https://api-abstract.reservoir.tools/tokens/v7' : 'https://api.reservoir.tools/tokens/v7';
  
  console.log(`🔗 Using API: ${baseUrl}`);
  
  let allTokens = [];
  let continuation = null;
  let maxPages = 50; // Increased limit to get full collection
  let pageCount = 0;
  
  do {
    const url = new URL(baseUrl);
    url.searchParams.set('collection', contractAddress);
    url.searchParams.set('limit', '50');
    url.searchParams.set('sortBy', 'tokenId');
    url.searchParams.set('sortDirection', 'asc');
    url.searchParams.set('includeAttributes', 'true');
    
    if (continuation) {
      url.searchParams.set('continuation', continuation);
    }
    
    console.log(`📄 Fetching page ${pageCount + 1} from Reservoir... (Total so far: ${allTokens.length})`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.log(`❌ Reservoir V7 failed: ${response.status}`);
      break;
    }
    
    const data = await response.json();
    
    if (!data.tokens || data.tokens.length === 0) {
      console.log('📄 No more tokens found');
      break;
    }
    
    console.log(`✅ Found ${data.tokens.length} tokens on page ${pageCount + 1}`);
    allTokens = allTokens.concat(data.tokens);
    
    // Progress indicator for large collections
    if (pageCount % 5 === 0 && pageCount > 0) {
      console.log(`📊 Progress: ${allTokens.length} NFTs fetched across ${pageCount + 1} pages...`);
    }
    
    continuation = data.continuation;
    pageCount++;
    
    // Add delay to respect rate limits (reduced for faster fetching)
    await new Promise(resolve => setTimeout(resolve, 200));
    
  } while (continuation && pageCount < maxPages);
  
  if (allTokens.length === 0) {
    throw new Error('No NFTs found from Reservoir V7');
  }
  
  console.log(`🎉 Total NFTs fetched from Reservoir: ${allTokens.length}`);
  
  const items = allTokens.map(token => {
    let imageUrl = token.token.image || token.token.media || token.token.imageSmall;
    
    // Convert IPFS URLs to HTTP gateway URLs
    if (imageUrl && imageUrl.startsWith('ipfs://')) {
      const ipfsHash = imageUrl.replace('ipfs://', '');
      imageUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    return {
      token_id: token.token.tokenId,
      name: token.token.name || `BEARISH #${token.token.tokenId}`,
      description: token.token.description || 'BEARISH NFT from Abstract Chain',
      image: imageUrl,
      traits: token.token.attributes || [],
      contract_address: contractAddress,
      floor_price: token.market?.floorAsk?.price?.amount?.native || null,
      last_sale: token.market?.recentSales?.[0]?.price?.amount?.native || null
    };
  });
  
  return {
    name: allTokens[0]?.token?.collection?.name || 'NFT Collection',
    description: allTokens[0]?.token?.collection?.description || 'NFT Collection from Reservoir',
    contract_address: contractAddress,
    items: items
  };
}

/**
 * Fallback: Generate sample NFT data for testing
 */
async function fetchFromAlternativeSource() {
  console.log('🎨 Generating sample NFT data for testing...');
  
  const sampleNFTs = [];
  const baseImageUrl = 'https://picsum.photos/400/400?random=';
  
  for (let i = 1; i <= 20; i++) {
    sampleNFTs.push({
      token_id: i.toString(),
      name: `Bearish #${i}`,
      description: `A unique Bearish NFT with aesthetic appeal. Token ID: ${i}`,
      image: `${baseImageUrl}${i}`,
      traits: {
        background: ['Blue', 'Green', 'Purple', 'Pink'][i % 4],
        expression: ['Happy', 'Sad', 'Angry', 'Neutral'][i % 4],
        rarity: i <= 5 ? 'Legendary' : i <= 10 ? 'Rare' : 'Common'
      }
    });
  }
  
  return {
    name: 'Bearish Collection (Sample)',
            description: 'Sample NFT collection for testing Taste Machine game',
    contract_address: '0x1234567890123456789012345678901234567890',
    items: sampleNFTs
  };
}

/**
 * Insert NFTs into Supabase
 */
async function insertNFTs(nfts, collectionInfo) {
  console.log(`📊 Preparing to insert ${nfts.length} NFTs...`);
  
  const nftRecords = nfts.map(nft => ({
    token_id: nft.token_id || nft.id || Math.random().toString(),
    name: nft.name || `NFT #${nft.token_id}`,
    description: nft.description || 'An NFT for aesthetic voting',
    image: nft.image || nft.image_url || `https://picsum.photos/400/400?random=${Math.random()}`,
    collection_name: collectionInfo.name,
    contract_address: collectionInfo.contract_address,
    traits: nft.traits || nft.attributes || {},
    looks_score: 1000, // Starting Elo rating
    total_votes: 0,
    wins: 0,
    losses: 0
  }));
  
  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < nftRecords.length; i += BATCH_SIZE) {
    const batch = nftRecords.slice(i, i + BATCH_SIZE);
    
    console.log(`📝 Inserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(nftRecords.length / BATCH_SIZE)} (${batch.length} items)...`);
    
    const { data, error } = await supabase
      .from('nfts')
      .upsert(batch, { 
        onConflict: 'token_id,contract_address',
        ignoreDuplicates: true 
      })
      .select();
    
    if (error) {
      console.error('❌ Insert error:', error);
      continue;
    }
    
    inserted += data?.length || 0;
    console.log(`✅ Inserted ${data?.length || 0} NFTs`);
    
    // Rate limiting delay
    if (i + BATCH_SIZE < nftRecords.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.log(`🎉 Successfully inserted ${inserted} NFTs total!`);
  return inserted;
}

/**
 * Create initial matchups
 */
async function createInitialMatchups(limit = 5) {
  console.log(`🎲 Creating ${limit} initial matchups...`);
  
  // Get random NFTs for matchups
  const { data: nfts, error } = await supabase
    .from('nfts')
    .select('id')
    .limit(limit * 2);
  
  if (error || !nfts || nfts.length < 2) {
    console.log('❌ Not enough NFTs for matchups');
    return 0;
  }
  
  const matchups = [];
  for (let i = 0; i < Math.min(limit, Math.floor(nfts.length / 2)); i++) {
    matchups.push({
      nft1_id: nfts[i * 2].id,
      nft2_id: nfts[i * 2 + 1].id,
      status: 'pending'
    });
  }
  
  const { data, error: matchupError } = await supabase
    .from('matchups')
    .insert(matchups)
    .select();
  
  if (matchupError) {
    console.error('❌ Matchup creation error:', matchupError);
    return 0;
  }
  
  console.log(`✅ Created ${data?.length || 0} matchups!`);
  return data?.length || 0;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting NFT Collection Import...\n');
  
  try {
    // Check Supabase connection
    console.log('🔌 Testing Supabase connection...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    console.log('✅ Supabase connected!\n');
    
    // Fetch collection data - try real NFT sources first
    const collection = process.argv[2] || '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'; // Default to BAYC contract
    
    console.log(`🎯 Fetching collection: ${collection}`);
    
    let collectionData;
    if (collection.startsWith('0x')) {
      // If it's a contract address, use multiple APIs to get real NFT data
      collectionData = await fetchRealBearishNFTs(collection);
    } else {
      // If it's a slug, try OpenSea first
      collectionData = await fetchFromOpenSea(collection);
    }
    
    if (!collectionData || !collectionData.items.length) {
      throw new Error(`No real NFT data found for ${collection} collection`);
    }
    
    console.log(`📦 Collection: ${collectionData.name}`);
    console.log(`📝 Description: ${collectionData.description}`);
    console.log(`🏷️  Contract: ${collectionData.contract_address}`);
    console.log(`🎨 Items: ${collectionData.items.length}\n`);
    
    // Insert NFTs
    const insertedCount = await insertNFTs(collectionData.items, collectionData);
    
    if (insertedCount > 0) {
      // Create initial matchups
      await createInitialMatchups(5);
      
      console.log('\n🎉 Import completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Visit your Supabase dashboard to verify the data');
      console.log('2. Restart your development server');
      console.log('3. Test the voting UI with real NFT data');
      console.log('4. Check http://localhost:3000 to see the matchups');
    } else {
      console.log('⚠️  No new NFTs were inserted');
    }
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    process.exit(1);
  }
}

// Command line usage
if (require.main === module) {
  const collection = process.argv[2] || 'bearish';
  console.log(`🎯 Target collection: ${collection}\n`);
  main().catch(console.error);
}

module.exports = { fetchFromOpenSea, fetchRealBearishNFTs, insertNFTs, createInitialMatchups };