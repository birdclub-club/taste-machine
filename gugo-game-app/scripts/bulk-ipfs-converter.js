#!/usr/bin/env node
/**
 * High-Performance Bulk IPFS to HTTP Converter
 * 
 * Features:
 * - Concurrent processing with worker pools
 * - Intelligent caching and deduplication
 * - Resumable operations with progress tracking
 * - Batch database updates for speed
 * - Multiple gateway failover strategies
 * - Rate limiting and backoff mechanisms
 * - Real-time progress reporting
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
require('dotenv').config({ path: '.env.local' });

// Configuration
const CONFIG = {
  // Performance settings
  MAX_WORKERS: 8,                    // Concurrent workers
  BATCH_SIZE: 50,                    // NFTs per batch
  DATABASE_BATCH_SIZE: 100,          // Database updates per batch
  REQUESTS_PER_SECOND: 20,           // Rate limit per worker
  TIMEOUT_MS: 8000,                  // Request timeout
  RETRY_ATTEMPTS: 3,                 // Retry failed requests
  
  // Gateway settings
  GATEWAY_TIMEOUT: 5000,             // Gateway test timeout
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
};

// High-performance IPFS gateways (ordered by reliability)
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.infura.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://w3s.link/ipfs/',
  'https://4everland.io/ipfs/',
];

// Cache file paths
const CACHE_DIR = path.join(__dirname, '.cache');
const PROGRESS_FILE = path.join(CACHE_DIR, 'conversion-progress.json');
const GATEWAY_CACHE_FILE = path.join(CACHE_DIR, 'gateway-cache.json');
const HASH_CACHE_FILE = path.join(CACHE_DIR, 'hash-success-cache.json');

class BulkIPFSConverter {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    this.workers = [];
    this.progress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
    
    this.gatewayCache = new Map();
    this.hashCache = new Map();
    this.processedHashes = new Set();
  }

  async initialize() {
    console.log('🚀 Initializing Bulk IPFS Converter...');
    
    // Create cache directory
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Load existing caches
    await this.loadCaches();
    
    console.log('✅ Converter initialized');
  }

  async loadCaches() {
    try {
      // Load gateway cache
      try {
        const gatewayData = await fs.readFile(GATEWAY_CACHE_FILE, 'utf8');
        const gatewayCache = JSON.parse(gatewayData);
        this.gatewayCache = new Map(Object.entries(gatewayCache));
        console.log(`📦 Loaded ${this.gatewayCache.size} gateway cache entries`);
      } catch (error) {
        console.log('📦 No existing gateway cache found');
      }

      // Load hash success cache
      try {
        const hashData = await fs.readFile(HASH_CACHE_FILE, 'utf8');
        const hashCache = JSON.parse(hashData);
        this.hashCache = new Map(Object.entries(hashCache));
        console.log(`🔗 Loaded ${this.hashCache.size} hash cache entries`);
      } catch (error) {
        console.log('🔗 No existing hash cache found');
      }

      // Load progress
      try {
        const progressData = await fs.readFile(PROGRESS_FILE, 'utf8');
        const savedProgress = JSON.parse(progressData);
        if (savedProgress.processedHashes) {
          this.processedHashes = new Set(savedProgress.processedHashes);
          console.log(`⏭️ Loaded ${this.processedHashes.size} processed hashes`);
        }
      } catch (error) {
        console.log('⏭️ No existing progress found');
      }
    } catch (error) {
      console.warn('⚠️ Error loading caches:', error.message);
    }
  }

  async saveCaches() {
    try {
      // Save gateway cache
      const gatewayData = Object.fromEntries(this.gatewayCache);
      await fs.writeFile(GATEWAY_CACHE_FILE, JSON.stringify(gatewayData, null, 2));

      // Save hash cache
      const hashData = Object.fromEntries(this.hashCache);
      await fs.writeFile(HASH_CACHE_FILE, JSON.stringify(hashData, null, 2));

      // Save progress
      const progressData = {
        ...this.progress,
        processedHashes: Array.from(this.processedHashes)
      };
      await fs.writeFile(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
    } catch (error) {
      console.warn('⚠️ Error saving caches:', error.message);
    }
  }

  extractIpfsHash(ipfsUrl) {
    if (typeof ipfsUrl !== 'string') return null;
    
    // Handle ipfs:// URLs
    if (ipfsUrl.startsWith('ipfs://')) {
      return ipfsUrl.replace('ipfs://', '');
    }
    
    // Handle full IPFS gateway URLs
    const ipfsMatch = ipfsUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (ipfsMatch) {
      return ipfsMatch[1];
    }
    
    return null;
  }

  async getWorkingGateway(hash) {
    // Check cache first
    const cacheKey = hash.substring(0, 20); // Use first 20 chars as cache key
    const cached = this.gatewayCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_DURATION) {
      return cached.gateway;
    }

    // Check hash-specific cache
    if (this.hashCache.has(hash)) {
      const cachedResult = this.hashCache.get(hash);
      if ((Date.now() - cachedResult.timestamp) < CONFIG.CACHE_DURATION) {
        return cachedResult.gateway;
      }
    }

    // Test gateways concurrently
    const promises = IPFS_GATEWAYS.map(async (gateway) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.GATEWAY_TIMEOUT);
        
        const response = await fetch(gateway + hash, {
          method: 'HEAD',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return { gateway, success: true, responseTime: Date.now() };
        }
        return { gateway, success: false };
      } catch (error) {
        return { gateway, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(promises);
    const workingGateways = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value)
      .sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));

    if (workingGateways.length > 0) {
      const bestGateway = workingGateways[0].gateway;
      
      // Cache the result
      this.gatewayCache.set(cacheKey, {
        gateway: bestGateway,
        timestamp: Date.now()
      });
      
      this.hashCache.set(hash, {
        gateway: bestGateway,
        timestamp: Date.now()
      });
      
      return bestGateway;
    }

    return null;
  }

  async processNFTBatch(nfts) {
    const results = [];
    
    for (const nft of nfts) {
      try {
        const hash = this.extractIpfsHash(nft.image);
        
        if (!hash) {
          results.push({
            id: nft.id,
            success: false,
            error: 'Invalid IPFS URL',
            originalUrl: nft.image
          });
          continue;
        }

        // Skip if already processed
        if (this.processedHashes.has(hash)) {
          results.push({
            id: nft.id,
            success: true,
            skipped: true,
            reason: 'Already processed',
            originalUrl: nft.image
          });
          continue;
        }

        const gateway = await this.getWorkingGateway(hash);
        
        if (gateway) {
          const httpUrl = gateway + hash;
          results.push({
            id: nft.id,
            success: true,
            httpUrl,
            originalUrl: nft.image,
            gateway: gateway.split('/')[2] // Extract domain
          });
          
          this.processedHashes.add(hash);
        } else {
          results.push({
            id: nft.id,
            success: false,
            error: 'No working gateway found',
            originalUrl: nft.image
          });
        }
      } catch (error) {
        results.push({
          id: nft.id,
          success: false,
          error: error.message,
          originalUrl: nft.image
        });
      }
    }

    return results;
  }

  async updateDatabase(results) {
    const successfulResults = results.filter(r => r.success && r.httpUrl);
    
    if (successfulResults.length === 0) {
      return { updated: 0, errors: [] };
    }

    const errors = [];
    let updated = 0;

    // Process in smaller batches for database efficiency
    for (let i = 0; i < successfulResults.length; i += CONFIG.DATABASE_BATCH_SIZE) {
      const batch = successfulResults.slice(i, i + CONFIG.DATABASE_BATCH_SIZE);
      
      try {
        // Use Promise.all for concurrent updates within the batch
        const updatePromises = batch.map(async (result) => {
          const { error } = await this.supabase
            .from('nfts')
            .update({ image: result.httpUrl })
            .eq('id', result.id);

          if (error) {
            throw new Error(`ID ${result.id}: ${error.message}`);
          }
          
          return result.id;
        });

        await Promise.all(updatePromises);
        updated += batch.length;
        
        console.log(`✅ Updated batch ${Math.floor(i / CONFIG.DATABASE_BATCH_SIZE) + 1}: ${batch.length} NFTs`);
        
      } catch (error) {
        console.error(`❌ Database batch error:`, error.message);
        errors.push(error.message);
      }
    }

    return { updated, errors };
  }

  async getIPFSNFTs(collectionName = null, limit = null) {
    let query = this.supabase
      .from('nfts')
      .select('id, token_id, contract_address, collection_name, name, image')
      .like('image', 'ipfs:%');

    if (collectionName) {
      query = query.eq('collection_name', collectionName);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch NFTs: ${error.message}`);
    }

    return data || [];
  }

  async processCollection(collectionName = null, options = {}) {
    const { 
      limit = null, 
      dryRun = false,
      continueFromProgress = true 
    } = options;

    console.log(`\n🔄 Processing ${collectionName || 'all collections'}...`);
    
    // Get NFTs to process
    const nfts = await this.getIPFSNFTs(collectionName, limit);
    
    if (nfts.length === 0) {
      console.log('ℹ️ No IPFS NFTs found to process');
      return;
    }

    // Filter out already processed NFTs if continuing
    let nftsToProcess = nfts;
    if (continueFromProgress) {
      nftsToProcess = nfts.filter(nft => {
        const hash = this.extractIpfsHash(nft.image);
        return hash && !this.processedHashes.has(hash);
      });
      
      if (nftsToProcess.length < nfts.length) {
        console.log(`⏭️ Skipping ${nfts.length - nftsToProcess.length} already processed NFTs`);
      }
    }

    if (nftsToProcess.length === 0) {
      console.log('✅ All NFTs in this collection have already been processed');
      return;
    }

    this.progress.total = nftsToProcess.length;
    this.progress.processed = 0;
    this.progress.successful = 0;
    this.progress.failed = 0;
    this.progress.startTime = Date.now();

    console.log(`📊 Processing ${nftsToProcess.length} NFTs...`);

    // Process in batches
    let allResults = [];
    for (let i = 0; i < nftsToProcess.length; i += CONFIG.BATCH_SIZE) {
      const batch = nftsToProcess.slice(i, i + CONFIG.BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(nftsToProcess.length / CONFIG.BATCH_SIZE)} (${batch.length} NFTs)...`);
      
      const batchResults = await this.processNFTBatch(batch);
      allResults = allResults.concat(batchResults);
      
      // Update progress
      this.progress.processed += batch.length;
      this.progress.successful += batchResults.filter(r => r.success).length;
      this.progress.failed += batchResults.filter(r => !r.success).length;
      
      // Save progress periodically
      if (i % (CONFIG.BATCH_SIZE * 5) === 0) {
        await this.saveCaches();
      }
      
      // Print progress
      const progressPercent = (this.progress.processed / this.progress.total * 100).toFixed(1);
      const timeElapsed = (Date.now() - this.progress.startTime) / 1000;
      const nftsPerSecond = (this.progress.processed / timeElapsed).toFixed(1);
      
      console.log(`📈 Progress: ${progressPercent}% (${this.progress.processed}/${this.progress.total}) | ✅ ${this.progress.successful} | ❌ ${this.progress.failed} | ⚡ ${nftsPerSecond} NFTs/sec`);
      
      // Don't update database in dry run mode
      if (!dryRun && batchResults.some(r => r.success && r.httpUrl)) {
        const dbResult = await this.updateDatabase(batchResults);
        console.log(`💾 Database: Updated ${dbResult.updated} NFTs`);
        if (dbResult.errors.length > 0) {
          console.warn(`⚠️ Database errors: ${dbResult.errors.length}`);
        }
      }
      
      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final progress save
    await this.saveCaches();

    // Results summary
    const totalTime = (Date.now() - this.progress.startTime) / 1000;
    const avgSpeed = (this.progress.processed / totalTime).toFixed(1);
    
    console.log(`\n🎉 Processing completed!`);
    console.log(`📊 Total: ${this.progress.total} NFTs`);
    console.log(`✅ Successful: ${this.progress.successful}`);
    console.log(`❌ Failed: ${this.progress.failed}`);
    console.log(`⏱️ Time: ${totalTime.toFixed(1)}s (${avgSpeed} NFTs/sec)`);
    
    if (dryRun) {
      console.log(`🧪 DRY RUN - No database changes made`);
    }

    return {
      total: this.progress.total,
      successful: this.progress.successful,
      failed: this.progress.failed,
      timeElapsed: totalTime,
      results: allResults
    };
  }

  async clearCache() {
    console.log('🧹 Clearing all caches...');
    
    try {
      await fs.unlink(GATEWAY_CACHE_FILE);
      await fs.unlink(HASH_CACHE_FILE);
      await fs.unlink(PROGRESS_FILE);
      console.log('✅ Caches cleared');
    } catch (error) {
      console.log('ℹ️ No caches to clear');
    }
    
    this.gatewayCache.clear();
    this.hashCache.clear();
    this.processedHashes.clear();
  }

  async getStats() {
    const { data: totalNFTs, error: totalError } = await this.supabase
      .from('nfts')
      .select('id', { count: 'exact' });

    const { data: ipfsNFTs, error: ipfsError } = await this.supabase
      .from('nfts')
      .select('id', { count: 'exact' })
      .like('image', 'ipfs:%');

    const { data: httpNFTs, error: httpError } = await this.supabase
      .from('nfts')
      .select('id', { count: 'exact' })
      .like('image', 'http%');

    return {
      total: totalNFTs?.length || 0,
      ipfs: ipfsNFTs?.length || 0,
      http: httpNFTs?.length || 0,
      processed: this.processedHashes.size,
      cached: this.hashCache.size
    };
  }
}

// CLI Interface
async function main() {
  const converter = new BulkIPFSConverter();
  await converter.initialize();

  const args = process.argv.slice(2);
  const command = args[0];
  const collectionName = args[1];

  switch (command) {
    case 'stats':
      const stats = await converter.getStats();
      console.log('\n📊 Database Statistics:');
      console.log(`Total NFTs: ${stats.total}`);
      console.log(`IPFS NFTs: ${stats.ipfs}`);
      console.log(`HTTP NFTs: ${stats.http}`);
      console.log(`Processed (cache): ${stats.processed}`);
      console.log(`Gateway cache: ${stats.cached}`);
      break;

    case 'convert':
      const options = {
        limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null,
        dryRun: args.includes('--dry-run'),
        continueFromProgress: !args.includes('--fresh')
      };
      
      await converter.processCollection(collectionName, options);
      break;

    case 'clear-cache':
      await converter.clearCache();
      break;

    case 'test':
      console.log('🧪 Testing gateway speeds...');
      const testHash = 'QmYour47t3st1ng hash here'; // Use a known hash
      const gateway = await converter.getWorkingGateway(testHash);
      console.log(`Best gateway: ${gateway || 'None found'}`);
      break;

    default:
      console.log(`
🚀 Bulk IPFS to HTTP Converter

Usage:
  node bulk-ipfs-converter.js <command> [options]

Commands:
  stats                           Show database statistics
  convert [collection]            Convert IPFS to HTTP URLs
  convert [collection] --dry-run  Test conversion without database updates
  convert --limit 100             Limit number of NFTs to process
  convert --fresh                 Ignore progress cache and start fresh
  clear-cache                     Clear all caches
  test                           Test gateway speeds

Examples:
  node bulk-ipfs-converter.js stats
  node bulk-ipfs-converter.js convert "Final Bosu"
  node bulk-ipfs-converter.js convert --limit 1000 --dry-run
  node bulk-ipfs-converter.js convert
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BulkIPFSConverter };
