// Convert IPFS images to HTTP for Abstract chain collections
// Focus on Final Bosu, Fugz, and other collections with IPFS images

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Alternative HTTP gateways and CDN services for IPFS content
const HTTP_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.ipfs.io/ipfs/', 
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.infura.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/'
];

// NFT-specific APIs that might have cached HTTP versions
const NFT_APIS = {
  reservoir: {
    base: 'https://api.reservoir.tools/tokens/v7',
    headers: {}
  },
  opensea: {
    base: 'https://api.opensea.io/api/v2',
    headers: {
      'X-API-KEY': process.env.OPENSEA_API_KEY || ''
    }
  },
  moralis: {
    base: 'https://deep-index.moralis.io/api/v2.2',
    headers: {
      'X-API-Key': process.env.MORALIS_API_KEY || ''
    }
  }
};

function extractIpfsHash(ipfsUrl) {
  // Extract hash from ipfs://QmXXX or ipfs://bafyXXX format
  if (ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl.replace('ipfs://', '');
  }
  return null;
}

async function testHttpUrl(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD', // Just check if accessible, don't download
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function findWorkingHttpUrl(ipfsUrl) {
  const hash = extractIpfsHash(ipfsUrl);
  if (!hash) {
    console.log(`⚠️ Invalid IPFS URL: ${ipfsUrl}`);
    return null;
  }

  console.log(`🔍 Testing gateways for hash: ${hash.substring(0, 20)}...`);

  // Test each gateway
  for (const gateway of HTTP_GATEWAYS) {
    const httpUrl = gateway + hash;
    console.log(`  Testing: ${gateway.split('/')[2]}...`);
    
    const works = await testHttpUrl(httpUrl);
    if (works) {
      console.log(`  ✅ Working gateway found: ${gateway.split('/')[2]}`);
      return httpUrl;
    }
  }

  console.log(`  ❌ No working gateway found for ${hash.substring(0, 20)}...`);
  return null;
}

async function searchNftApis(nft) {
  const { contract_address, token_id, collection_name } = nft;
  
  // Try Reservoir first (best for NFT metadata)
  try {
    console.log(`🔍 Checking Reservoir for ${collection_name} #${token_id}...`);
    
    const response = await fetch(
      `${NFT_APIS.reservoir.base}?contract=${contract_address}&tokenId=${token_id}`,
      { headers: NFT_APIS.reservoir.headers }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.tokens && data.tokens[0] && data.tokens[0].token.image) {
        const imageUrl = data.tokens[0].token.image;
        if (imageUrl.startsWith('http')) {
          console.log(`✅ Reservoir found HTTP URL: ${imageUrl}`);
          return imageUrl;
        }
      }
    }
  } catch (error) {
    console.log(`⚠️ Reservoir failed: ${error.message}`);
  }

  // Try OpenSea (might have Abstract chain support)
  try {
    console.log(`🔍 Checking OpenSea for ${collection_name} #${token_id}...`);
    
    // Try both Ethereum and Abstract chain endpoints
    const chains = ['ethereum', 'abstract-testnet'];
    
    for (const chain of chains) {
      try {
        const response = await fetch(
          `${NFT_APIS.opensea.base}/chain/${chain}/contract/${contract_address}/nfts/${token_id}`,
          { headers: NFT_APIS.opensea.headers }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.nft && data.nft.image_url && data.nft.image_url.startsWith('http')) {
            console.log(`✅ OpenSea (${chain}) found HTTP URL: ${data.nft.image_url}`);
            return data.nft.image_url;
          }
        }
      } catch (chainError) {
        // Continue to next chain
      }
    }
  } catch (error) {
    console.log(`⚠️ OpenSea failed: ${error.message}`);
  }

  return null;
}

async function updateNftImage(nftId, newImageUrl, originalUrl) {
  try {
    const { error } = await supabase
      .from('nfts')
      .update({ image: newImageUrl })
      .eq('id', nftId);

    if (error) {
      console.error(`❌ Failed to update NFT ${nftId}:`, error);
      return false;
    }

    console.log(`✅ Updated ${nftId}: ${originalUrl.substring(0, 30)}... → ${newImageUrl.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error(`❌ Exception updating NFT ${nftId}:`, error);
    return false;
  }
}

async function processCollection(collectionName) {
  console.log(`\n🔄 Processing collection: ${collectionName}`);
  
  // Get NFTs with IPFS images from this collection
  const { data: nfts, error } = await supabase
    .from('nfts')
    .select('id, token_id, contract_address, collection_name, name, image')
    .eq('collection_name', collectionName)
    .like('image', 'ipfs:%')
    .limit(20); // Start with smaller batches

  if (error) {
    console.error(`❌ Failed to fetch NFTs for ${collectionName}:`, error);
    return;
  }

  if (!nfts || nfts.length === 0) {
    console.log(`ℹ️ No IPFS images found for ${collectionName}`);
    return;
  }

  console.log(`📊 Found ${nfts.length} NFTs with IPFS images`);

  let updated = 0;
  let failed = 0;

  for (const nft of nfts) {
    try {
      console.log(`\n🎯 Processing: ${nft.collection_name} #${nft.token_id}`);
      
      // First try to find HTTP version via APIs
      let httpUrl = await searchNftApis(nft);
      
      // If APIs don't work, try converting IPFS to working HTTP gateway
      if (!httpUrl) {
        httpUrl = await findWorkingHttpUrl(nft.image);
      }
      
      if (httpUrl) {
        const success = await updateNftImage(nft.id, httpUrl, nft.image);
        if (success) {
          updated++;
        } else {
          failed++;
        }
      } else {
        console.log(`❌ No working HTTP URL found for ${nft.collection_name} #${nft.token_id}`);
        failed++;
      }

      // Rate limiting - be nice to APIs
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Error processing NFT ${nft.id}:`, error);
      failed++;
    }
  }

  console.log(`\n📊 Collection ${collectionName} results:`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${nfts.length}`);
}

async function main() {
  console.log('🔄 Converting IPFS images to HTTP URLs for Abstract chain collections...\n');

  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('nfts').select('count').limit(1);
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    console.log('✅ Connected to Supabase');

    // Get collections that have IPFS images
    const { data: ipfsCollections, error: collectionsError } = await supabase
      .from('nfts')
      .select('collection_name, image')
      .like('image', 'ipfs:%');

    if (collectionsError) {
      throw new Error(`Failed to get collections: ${collectionsError.message}`);
    }

    const uniqueCollections = [...new Set(ipfsCollections.map(c => c.collection_name))];
    console.log(`📋 Collections with IPFS images: ${uniqueCollections.join(', ')}\n`);

    // Process each collection
    for (const collectionName of uniqueCollections) {
      await processCollection(collectionName);
    }

    console.log('\n🎉 IPFS to HTTP conversion completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Check the console output for conversion results');
    console.log('2. Test the app to see if images load faster');
    console.log('3. Monitor for any remaining IPFS URLs that need conversion');

  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Command line usage
if (require.main === module) {
  const collectionName = process.argv[2];
  
  if (collectionName) {
    console.log(`🎯 Processing specific collection: ${collectionName}`);
    processCollection(collectionName).catch(console.error);
  } else {
    main().catch(console.error);
  }
}
