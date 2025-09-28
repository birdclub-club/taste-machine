// 🚀 Ultra-fast voting preloader system
// Preloads voting sessions with images for instant transitions

import { supabase } from './supabase';
import { VotingSession } from '@/types/voting';
import { fixImageUrl, getNextIPFSGateway, ipfsGatewayManager } from './ipfs-gateway-manager';
import { enhancedMatchupIntegration, type EnhancedMatchupOptions } from './enhanced-matchup-integration';
import { cacheVersionManager } from '@/lib/cache-version-manager';
import { databaseErrorHandler } from '@/lib/database-error-handler';

class VotingPreloader {
  private static instance: VotingPreloader;
  private sessionStack: VotingSession[] = []; // 🚀 LIFO stack for instant access
  private isPreloading = false;
  private readonly TARGET_STACK_SIZE = 20; // 🚀 Increased for better variety
  private readonly MINIMUM_STACK_SIZE = 10; // Never go below 10 sessions
  private readonly REFILL_TRIGGER = 12; // Refill when stack drops to 12 sessions (more aggressive)
  private readonly MAX_PARALLEL_PRELOAD = 4; // Slightly increased for better throughput
  private imagePreloadCache = new Map<string, boolean>();
  private seenNFTIds = new Set<string>(); // Track NFTs shown in current session
  private seenNFTPairs = new Set<string>(); // Track NFT pairs to prevent exact duplicates
  private readonly MAX_SEEN_NFTS = 200; // Increased tracking for better variety
  private readonly MAX_SEEN_PAIRS = 500; // Increased pair tracking significantly
  
  // 🎯 Progressive Discovery System
  private sessionCounter = 0;
  private readonly COLD_START_FREQUENCY = 4; // Every 4th session is cold start (25%)
  
  // 🧠 Enhanced system settings (PERFORMANCE OPTIMIZED)
  private useEnhancedEngine = true; // Re-enabled with optimized V2 SQL functions
  private enhancedSuccessRate = 0; // Track enhanced system performance
  private enhancedAttempts = 0;
  private enhancedTimeout = 800; // Reduced to 800ms for faster fallbacks
  private enhancedRatio = 0.5; // 50% enhanced, 50% legacy - balanced performance

  static getInstance(): VotingPreloader {
    if (!VotingPreloader.instance) {
      VotingPreloader.instance = new VotingPreloader();
      // Initialize cache version manager
      VotingPreloader.instance.initializeCacheVersioning();
    }
    return VotingPreloader.instance;
  }

  // 🔄 Initialize cache version management
  private async initializeCacheVersioning(): Promise<void> {
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      console.log('🔄 Preloader: Server-side, skipping cache version initialization');
      return;
    }

    try {
      await cacheVersionManager.initialize();
      
      // Listen for cache invalidation events
      window.addEventListener('cache-invalidated', (event: any) => {
        console.log('🔄 Cache invalidated, clearing preloader sessions...', event.detail);
        this.clearAllSessions();
        // Immediately start preloading fresh sessions
        this.preloadSessions();
      });
      
      // Make preloader globally accessible for cache manager
      (window as any).votingPreloader = this;
      
      console.log('✅ Cache version management initialized');
    } catch (error) {
      console.warn('⚠️ Could not initialize cache versioning:', error);
    }
  }

  // 🧹 Clear all cached sessions (useful when collection settings change)
  clearAllSessions(): void {
    const oldStackSize = this.sessionStack.length;
    const oldSeenNFTs = this.seenNFTIds.size;
    const oldSeenPairs = this.seenNFTPairs.size;
    
    this.sessionStack = [];
    this.seenNFTIds.clear();
    this.seenNFTPairs.clear();
    
    // 🎯 Reset Progressive Discovery counter to ensure fresh cold start rotation
    this.sessionCounter = 0;
    
    console.log(`🧹 EMERGENCY CACHE CLEAR: Removed ${oldStackSize} sessions, ${oldSeenNFTs} NFTs, ${oldSeenPairs} pairs`);
    console.log('🎯 Progressive Discovery counter reset - next session will be fresh');
  }

  // 🧹 Clear duplicate tracking only (useful for testing or when experiencing too many repeats)
  clearDuplicateTracking(): void {
    this.seenNFTIds.clear();
    this.seenNFTPairs.clear();
    console.log('🧹 Cleared duplicate tracking - fresh start for variety');
  }

  // 🚀 Force aggressive refill during prize breaks for maximum performance
  forceRefillStack(): void {
    if (!this.isPreloading) {
      console.log('🚀 Force refill: Aggressively preloading sessions during prize break...');
      // Don't await - let it run in background during prize animation
      this.preloadSessions(this.TARGET_STACK_SIZE);
    } else {
      console.log('🔄 Force refill: Already preloading, skipping duplicate request');
    }
  }

  // 🧹 Force clear all cached sessions and regenerate (for fixing filtering issues)
  forceClearAndRegenerate(): void {
    console.log('🧹 FORCE CLEAR: Clearing all cached sessions to apply updated filtering...');
    
    // Clear all cached data
    this.sessionStack = [];
    this.seenNFTIds.clear();
    this.seenNFTPairs.clear();
    
    console.log('✨ Cleared seen NFTs - fresh duplicates possible again');
    console.log('✨ Cleared seen pairs - duplicate pairs possible again');
    console.log('🔄 FORCE RESET: Cleared stack, seen NFTs, and image cache');
    console.log('🔄 Rebuilding session stack with fresh data...');
    
    // Regenerate fresh sessions with current filtering
    this.preloadSessions(this.TARGET_STACK_SIZE);
  }

  // 🖼️ Preload images in background with robust fallback
  private async preloadImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl) return false;
    
    // Check cache first
    if (this.imagePreloadCache.has(imageUrl)) {
      return this.imagePreloadCache.get(imageUrl)!;
    }

    return new Promise((resolve) => {
      let attemptCount = 0;
      const maxAttempts = 4; // Increased to 4 for better reliability
      let currentUrl = fixImageUrl(imageUrl);

      const tryLoadImage = () => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || typeof Image === 'undefined') {
          console.log(`⚠️ Server-side environment detected, skipping image preload for: ${currentUrl.substring(0, 60)}...`);
          resolve(true); // Assume success on server-side
          return;
        }
        
        const img = new Image();
        
        const timeout = setTimeout(() => {
          console.log(`⏰ Preload timeout ${attemptCount + 1}: ${currentUrl.substring(0, 60)}...`);
          tryNextGateway();
        }, 1000); // Reduced to 1 second for faster fallbacks

        img.onload = () => {
          clearTimeout(timeout);
          
          // Track gateway success
          const currentGateway = currentUrl.split('/ipfs/')[0] + '/ipfs/';
          ipfsGatewayManager.recordSuccess(currentGateway);
          
          this.imagePreloadCache.set(imageUrl, true);
          console.log(`✅ Preloaded: ${imageUrl.substring(0, 50)}...`);
          resolve(true);
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          
          // Track gateway failure
          const currentGateway = currentUrl.split('/ipfs/')[0] + '/ipfs/';
          ipfsGatewayManager.recordFailure(currentGateway, 'Preloader image load failed');
          
          console.log(`❌ Failed attempt ${attemptCount + 1}: ${currentUrl.substring(0, 60)}...`);
          tryNextGateway();
        };
        
        img.src = currentUrl;
      };

      const tryNextGateway = () => {
        attemptCount++;
        if (attemptCount >= maxAttempts) {
          console.log(`🚫 All attempts failed for: ${imageUrl.substring(0, 50)}...`);
          this.imagePreloadCache.set(imageUrl, false);
          resolve(false);
          return;
        }
        
        const nextUrl = getNextIPFSGateway(currentUrl, imageUrl);
        if (!nextUrl) {
          console.log(`🚫 No more gateways to try for: ${imageUrl.substring(0, 50)}...`);
          this.imagePreloadCache.set(imageUrl, false);
          resolve(false);
          return;
        }
        
        currentUrl = nextUrl;
        console.log(`🔄 Trying gateway ${attemptCount + 1}: ${currentUrl.substring(0, 60)}...`);
        tryLoadImage();
      };

      tryLoadImage();
    });
  }



  // 🔢 Simple hash function for consistent placeholders
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // 📊 Vote type distribution - Matchup-focused for maximum fun!
  private decideVoteType(): 'slider' | 'same_coll' | 'cross_coll' {
    const rand = Math.random();
    if (rand < 0.1) return 'slider';     // 10% slider votes (1 out of 10)
    if (rand < 0.7) return 'same_coll';  // 60% same collection matchups
    return 'cross_coll';                 // 30% cross collection matchups
  }

  // 🎚️ Generate slider session (with duplicate prevention and collection filtering)
  private async generateSliderSession(collectionFilter?: string, retryCount: number = 0): Promise<VotingSession | null> {
    try {
      // 🎛️ First, get active collections from collection management
      const { data: activeCollections } = await supabase
        .from('collection_management')
        .select('collection_name')
        .eq('active', true);
      
      const activeCollectionNames = activeCollections?.map(c => c.collection_name) || [];
      console.log(`🎛️ [PRELOADER] Active collections for slider: ${activeCollectionNames.join(', ')}`);
      
      // 🚫 RESTORED: Proper unrevealed trait filtering (essential for preventing unrevealed NFTs)
      let query = supabase
        .from('nfts')
        .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count, traits')
        .lt('slider_count', 5)
        .not('image', 'ilike', '%.mp4%')
        .not('image', 'ilike', '%.mov%')
        .not('image', 'ilike', '%.avi%')
        .not('image', 'ilike', '%.webm%')
        .not('image', 'ilike', '%.mkv%')
        // 🚫 Essential unrevealed filtering - DO NOT REMOVE
        .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // General unrevealed
        .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu unrevealed
        .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // BEARISH unrevealed
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // BEEISH unrevealed
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // BEEISH unrevealed
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // BEEISH unrevealed
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]');     // BEEISH unrevealed

      // 🎛️ Filter by active collections only (unless specific collection filter is provided)
      if (!collectionFilter && activeCollectionNames.length > 0) {
        query = query.in('collection_name', activeCollectionNames);
        console.log(`🎯 [PRELOADER] Filtering slider to active collections only`);
        console.log(`🎯 [PRELOADER] Active collections: ${activeCollectionNames.join(', ')}`);
      }
      
      // 🚫 No hardcoded exclusions - rely on database active status only

      // Apply collection filter if specified
      if (collectionFilter) {
        query = query.eq('collection_name', collectionFilter);
      }

      // Add retry logic for network errors
      let nfts: any[] | null = null, error: any = null;
      let retryAttempts = 0;
      const maxRetries = 2;

      while (retryAttempts <= maxRetries) {
        try {
          const result = await query
            .order('slider_count', { ascending: true })
            .order('total_votes', { ascending: true })
            .order('id', { ascending: false })  // 🎲 Diverse collection sampling
            .limit(20); // Get more to filter out seen ones
          
          nfts = result.data;
          error = result.error;
          break; // Success, exit retry loop
        } catch (networkError) {
          retryAttempts++;
          console.warn(`⚠️ Network error in slider query (attempt ${retryAttempts}/${maxRetries + 1}):`, networkError);
          
          if (retryAttempts <= maxRetries) {
            // Wait before retry with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryAttempts - 1), 3000);
            console.log(`🔄 Retrying slider query in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('❌ Max retries exceeded for slider query');
            return null;
          }
        }
      }

      // Debug logging for filter effectiveness
      console.log(`🔍 Found ${nfts?.length || 0} slider NFTs after unrevealed filters`);

      // Debug: Log NFTs that passed slider filter
      if (nfts?.length) {
        const kabuNfts = nfts.filter(nft => nft.collection_name === 'Kabu');
        const beeishNfts = nfts.filter(nft => nft.collection_name === 'Beeish');
        
        if (kabuNfts.length > 0) {
          console.log(`🚨 SLIDER: ${kabuNfts.length} Kabu NFTs passed filters:`);
          if (kabuNfts[0]) {
            console.log(`  Slider-Kabu: ${kabuNfts[0].name}`);
            console.log(`    Traits:`, kabuNfts[0].traits);
            console.log(`    Traits JSON:`, JSON.stringify(kabuNfts[0].traits, null, 2));
          }
        }
        
        if (beeishNfts.length > 0) {
          console.log(`🚨 SLIDER: ${beeishNfts.length} Beeish NFTs passed filters:`);
          if (beeishNfts[0]) {
            console.log(`  Slider-Beeish: ${beeishNfts[0].name}`);
            console.log(`    Traits:`, beeishNfts[0].traits);
            console.log(`    Traits JSON:`, JSON.stringify(beeishNfts[0].traits, null, 2));
          }
        }
      }

      // Filter out already seen NFTs
      let filteredNfts = nfts;
      if (filteredNfts?.length) {
        const beforeFilter = filteredNfts.length;
        filteredNfts = filteredNfts.filter(nft => !this.seenNFTIds.has(nft.id));
        console.log(`🔍 Filtered seen NFTs: ${beforeFilter} → ${filteredNfts.length}`);
      }

      // Fallback to random NFTs if no unseen low-count NFTs found
      if (error || !filteredNfts?.length) {
        console.log('📦 No unseen low slider count NFTs, trying random...');
        if (error) console.log('❌ Slider query error:', error);
        
        // 🚫 RESTORED: Proper fallback query with essential unrevealed filtering
        let fallbackQuery = supabase
          .from('nfts')
          .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count, traits')
          .not('image', 'ilike', '%.mp4%')
          .not('image', 'ilike', '%.mov%')
          .not('image', 'ilike', '%.avi%')
          .not('image', 'ilike', '%.webm%')
          .not('image', 'ilike', '%.mkv%')
          // 🚫 Essential unrevealed filtering - DO NOT REMOVE
          .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // General unrevealed
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu unrevealed
          .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // BEARISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]');     // BEEISH unrevealed
          
        // Apply active collection filtering
        if (activeCollectionNames.length > 0) {
          fallbackQuery = fallbackQuery.in('collection_name', activeCollectionNames);
        }

        // Apply collection filter to fallback query as well
        if (collectionFilter) {
          fallbackQuery = fallbackQuery.eq('collection_name', collectionFilter);
        }

        const result = await fallbackQuery.limit(500); // Increased limit for collection-specific queries
        
        if (result.error || !result.data?.length) {
          console.error('❌ Failed to fetch any NFTs for slider:', result.error);
          return null;
        }
        
        // Debug: Check fallback slider NFTs  
        const fallbackKabu = result.data.filter(nft => nft.collection_name === 'Kabu');
        const fallbackBeeish = result.data.filter(nft => nft.collection_name === 'Beeish');
        
        if (fallbackKabu.length > 0) {
          console.log(`🚨 FALLBACK SLIDER: ${fallbackKabu.length} Kabu NFTs passed filters`);
        }
        if (fallbackBeeish.length > 0) {
          console.log(`🚨 FALLBACK SLIDER: ${fallbackBeeish.length} Beeish NFTs passed filters`);
        }
        
        // Filter out seen NFTs and pick random from remaining
        const unseenNFTs = result.data.filter(nft => !this.seenNFTIds.has(nft.id));
        
        if (unseenNFTs.length === 0) {
          console.log('🔄 All NFTs seen, clearing history and retrying...');
          this.clearSeenNFTs();
          filteredNfts = [result.data[Math.floor(Math.random() * result.data.length)]];
        } else {
          filteredNfts = [unseenNFTs[Math.floor(Math.random() * unseenNFTs.length)]];
        }
      } else {
        // Use the filtered NFTs from the first query
        if (!filteredNfts?.length) {
          console.error('❌ No filtered NFTs available for slider');
          return null;
        }
        
        // Select a random NFT from filtered results
        filteredNfts = [filteredNfts[Math.floor(Math.random() * filteredNfts.length)]];
      }

      const rawNft = filteredNfts[0];
      
      // Map database result to NFT type
      const nft = {
        ...rawNft,
        collection_address: rawNft.contract_address,
        token_address: rawNft.contract_address
      };
      
      // Debug: Alert if selected NFT is unrevealed
      if (nft.collection_name === 'Kabu' || nft.collection_name === 'Beeish') {
        console.log(`🚨 SELECTED UNREVEALED: ${nft.collection_name} - ${nft.name}`);
        console.log(`    Traits:`, nft.traits);
        console.log(`    Traits JSON:`, JSON.stringify(nft.traits, null, 2));
      }
      
      // Mark as seen
      this.markNFTAsSeen(nft.id);
      
      // 🔥 FIRE VOTE PRIORITY: Check if this NFT has FIRE votes before rejecting
      const hasFireVotes = await this.checkFireVotes(nft.id);
      
      // Preload image and validate it loads successfully
      const imageLoaded = await this.preloadImage(nft.image);
      
      if (!imageLoaded) {
        if (hasFireVotes) {
          console.log(`🔥 FIRE OVERRIDE: Including slider NFT despite image failure - ${nft.name} (🔥 FIRE votes)`);
          // Continue with original image even if it fails to load - let the frontend handle fallbacks
        } else {
          console.log(`🚫 Skipping NFT ${nft.id} - image failed to load: ${nft.image.substring(0, 50)}...`);
          
          // Prevent infinite recursion - limit retries
          if (retryCount >= 3) {
            console.log(`⚠️ Max retries (${retryCount}) reached for slider session generation, allowing session with failed image to prevent infinite loop`);
            // Continue with the session even if image failed - let frontend handle fallbacks
          } else {
            // Try again with a different NFT
            return await this.generateSliderSession(collectionFilter, retryCount + 1);
          }
        }
      }
      
      return {
        nft: nft,
        vote_type: 'slider'
      };
    } catch (error) {
      console.error('❌ Error generating slider session:', error);
      return null;
    }
  }

  // 🥊 Generate matchup session (collection-aware)
  private async generateMatchupSession(voteType: 'same_coll' | 'cross_coll', collectionFilter?: string, retryCount: number = 0): Promise<VotingSession | null> {
    try {
      // 🎛️ First, get active collections from collection management
      const { data: activeCollections } = await supabase
        .from('collection_management')
        .select('collection_name')
        .eq('active', true);
      
      const activeCollectionNames = activeCollections?.map(c => c.collection_name) || [];
      console.log(`🎛️ [PRELOADER] Active collections for ${voteType}: ${activeCollectionNames.join(', ')}`);
      
      let nfts: any[] = [];
      
      if (voteType === 'same_coll') {
        // Simplified same collection logic - get NFTs from a random collection, excluding videos and unrevealed
        let sameCollQuery = supabase
          .from('nfts')
          .select('id, name, image, token_id, contract_address, collection_name, current_elo, traits')
          .not('collection_name', 'is', null)
          .not('image', 'ilike', '%.mp4%')
          .not('image', 'ilike', '%.mov%')
          .not('image', 'ilike', '%.avi%')
          .not('image', 'ilike', '%.webm%')
          .not('image', 'ilike', '%.mkv%')
          .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // General unrevealed
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu unrevealed
          .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // BEARISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]');     // BEEISH unrevealed

        // 🎛️ Filter by active collections only (unless specific collection filter is provided)
        if (!collectionFilter && activeCollectionNames.length > 0) {
          sameCollQuery = sameCollQuery.in('collection_name', activeCollectionNames);
          console.log(`🎯 [PRELOADER] Filtering same_coll to active collections only`);
        }

        // Apply collection filter if specified
        if (collectionFilter) {
          sameCollQuery = sameCollQuery.eq('collection_name', collectionFilter);
        }

        // Add retry logic for network errors
        let allNfts: any[] | null = null, sameCollError: any = null;
        let retryAttempts = 0;
        const maxRetries = 2;

        while (retryAttempts <= maxRetries) {
          try {
            const result = await sameCollQuery
              .order('id', { ascending: false })  // 🎲 Diverse collection sampling
              .limit(2000); // Increased limit for diverse collection sampling
            
            allNfts = result.data;
            sameCollError = result.error;
            break; // Success, exit retry loop
          } catch (networkError) {
            retryAttempts++;
            console.warn(`⚠️ Network error in same-collection query (attempt ${retryAttempts}/${maxRetries + 1}):`, networkError);
            
            if (retryAttempts <= maxRetries) {
              // Wait before retry with exponential backoff
              const delay = Math.min(1000 * Math.pow(2, retryAttempts - 1), 3000);
              console.log(`🔄 Retrying same-collection query in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              console.error('❌ Max retries exceeded for same-collection query');
              return null;
            }
          }
        }

        console.log(`🔍 Found ${allNfts?.length || 0} same-collection NFTs after unrevealed filters`);
        
        // Enhanced error logging for same-collection
        if (sameCollError) {
          console.error('❌ Supabase error in same-collection matchup:', {
            error: sameCollError,
            message: sameCollError?.message || 'Unknown error',
            details: sameCollError?.details || 'No details available',
            hint: sameCollError?.hint || 'No hint available',
            code: sameCollError?.code || 'No error code',
            retryAttempts: retryAttempts
          });
          return null;
        }
        
        if (!allNfts?.length) {
          console.error('❌ No NFTs found for same-collection matchup:', {
            activeCollections: activeCollectionNames,
            collectionFilter,
            hasCollectionFilter: !!collectionFilter
          });
          return null;
        }

        // Filter out already seen NFTs
        const unseenNfts = allNfts.filter(nft => !this.seenNFTIds.has(nft.id));
        const nftsToUse = unseenNfts.length >= 2 ? unseenNfts : allNfts; // Fallback if not enough unseen
        console.log(`🔍 Same-collection: ${allNfts.length} total → ${unseenNfts.length} unseen → using ${nftsToUse.length}`);

        // Debug: Log all collections that passed the filter
        const collectionBreakdown: Record<string, number> = {};
        nftsToUse.forEach(nft => {
          collectionBreakdown[nft.collection_name] = (collectionBreakdown[nft.collection_name] || 0) + 1;
        });
        
        console.log(`🎨 Collections found for same-collection matchups:`, collectionBreakdown);
        
        // Log BEARISH specifically since that's what we care about
        const bearishNfts = nftsToUse.filter(nft => nft.collection_name === 'BEARISH');
        if (bearishNfts.length > 0) {
          console.log(`🐻 ${bearishNfts.length} BEARISH NFTs available for matchups`);
        }

        // Group by collection and find collections with 2+ NFTs
        const collectionGroups = nftsToUse.reduce((groups, nft) => {
          const collection = nft.collection_name;
          if (!groups[collection]) groups[collection] = [];
          groups[collection].push(nft);
          return groups;
        }, {} as Record<string, any[]>);

        const validCollections = Object.entries(collectionGroups)
          .filter(([_, nfts]) => (nfts as any[]).length >= 2);

        if (!validCollections.length) return null;

        // Pick random collection with 2+ NFTs
        const [_, collectionNfts] = validCollections[Math.floor(Math.random() * validCollections.length)];
        
        // Pick two random NFTs from that collection, avoiding duplicate pairs
        let attempts = 0;
        const maxAttempts = 10;
        
        while (nfts.length === 0 && attempts < maxAttempts) {
          const shuffled = (collectionNfts as any[]).sort(() => 0.5 - Math.random());
          const candidatePair = shuffled.slice(0, 2);
          
          // Check if this pair has been seen before
          if (!this.hasPairBeenSeen(candidatePair[0].id, candidatePair[1].id)) {
            nfts = candidatePair;
          } else {
            console.log(`🔄 Same-coll pair already seen: ${candidatePair[0].name} vs ${candidatePair[1].name}, trying again...`);
            attempts++;
          }
        }
        
        if (nfts.length === 0) {
          console.log(`⚠️ Could not find unique same-coll pair after ${maxAttempts} attempts, allowing duplicate`);
          const shuffled = (collectionNfts as any[]).sort(() => 0.5 - Math.random());
          nfts = shuffled.slice(0, 2);
        }
      } else {
        // Cross collection - random NFTs, excluding videos and unrevealed
        let crossCollQuery = supabase
          .from('nfts')
          .select('id, name, image, token_id, contract_address, collection_name, current_elo, traits')
          .not('image', 'ilike', '%.mp4%')
          .not('image', 'ilike', '%.mov%')
          .not('image', 'ilike', '%.avi%')
          .not('image', 'ilike', '%.webm%')
          .not('image', 'ilike', '%.mkv%')
          .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // General unrevealed
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu unrevealed
          .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // BEARISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // BEEISH unrevealed
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]');     // BEEISH unrevealed

        // 🎛️ Filter by active collections only (unless specific collection filter is provided)
        if (!collectionFilter && activeCollectionNames.length > 0) {
          crossCollQuery = crossCollQuery.in('collection_name', activeCollectionNames);
          console.log(`🎯 [PRELOADER] Filtering cross_coll to active collections only`);
        }

        // Apply collection filter if specified
        if (collectionFilter) {
          crossCollQuery = crossCollQuery.eq('collection_name', collectionFilter);
        }

        // Add retry logic for network errors
        let randomNfts: any[] | null = null, error: any = null;
        let retryAttempts = 0;
        const maxRetries = 2;

        while (retryAttempts <= maxRetries) {
          try {
            const result = await crossCollQuery
              .order('id', { ascending: false })  // 🎲 Diverse collection sampling
              .limit(2000); // Increased limit for diverse collection sampling
            
            randomNfts = result.data;
            error = result.error;
            break; // Success, exit retry loop
          } catch (networkError) {
            retryAttempts++;
            console.warn(`⚠️ Network error in cross-collection query (attempt ${retryAttempts}/${maxRetries + 1}):`, networkError);
            
            if (retryAttempts <= maxRetries) {
              // Wait before retry with exponential backoff
              const delay = Math.min(1000 * Math.pow(2, retryAttempts - 1), 3000);
              console.log(`🔄 Retrying cross-collection query in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              console.error('❌ Max retries exceeded for cross-collection query');
              return null;
            }
          }
        }

        console.log(`🔍 Found ${randomNfts?.length || 0} cross-collection NFTs after unrevealed filters`);
        
        // Enhanced error logging with graceful handling
        if (error) {
          console.error('❌ Supabase error in cross-collection matchup:', {
            error,
            message: error?.message || 'Unknown error',
            details: error?.details || 'No details available',
            hint: error?.hint || 'No hint available',
            code: error?.code || 'No error code',
            retryAttempts: retryAttempts
          });
          return null;
        }
        
        if (!randomNfts || randomNfts.length < 2) {
          console.error('❌ Insufficient NFTs for cross-collection matchup:', {
            nftCount: randomNfts?.length || 0,
            activeCollections: activeCollectionNames,
            collectionFilter,
            hasCollectionFilter: !!collectionFilter
          });
          return null;
        }
        
        // Filter out already seen NFTs
        const unseenNfts = randomNfts.filter(nft => !this.seenNFTIds.has(nft.id));
        const nftsToUse = unseenNfts.length >= 2 ? unseenNfts : randomNfts; // Fallback if not enough unseen
        
        // Debug: Log all collections that passed cross-collection filter
        const crossCollectionBreakdown: Record<string, number> = {};
        nftsToUse.forEach(nft => {
          crossCollectionBreakdown[nft.collection_name] = (crossCollectionBreakdown[nft.collection_name] || 0) + 1;
        });
        
        console.log(`🔀 Collections found for cross-collection matchups:`, crossCollectionBreakdown);
        
        // 🎯 CROSS-COLLECTION: Ensure NFTs are from DIFFERENT collections
        const collectionGroups = nftsToUse.reduce((groups, nft) => {
          const collection = nft.collection_name;
          if (!groups[collection]) groups[collection] = [];
          groups[collection].push(nft);
          return groups;
        }, {} as Record<string, any[]>);

        const availableCollections = Object.keys(collectionGroups);
        
        if (availableCollections.length < 2) {
          console.log(`⚠️ Only ${availableCollections.length} collection(s) available for cross-collection matchup`);
          return null;
        }

        // Random selection ensuring different collections
        let attempts = 0;
        const maxAttempts = 10;
        
        while (nfts.length === 0 && attempts < maxAttempts) {
          // Pick two different collections
          const shuffledCollections = availableCollections.sort(() => 0.5 - Math.random());
          const collection1 = shuffledCollections[0];
          const collection2 = shuffledCollections[1];
          
          // Pick random NFT from each collection
          const nft1 = collectionGroups[collection1][Math.floor(Math.random() * collectionGroups[collection1].length)];
          const nft2 = collectionGroups[collection2][Math.floor(Math.random() * collectionGroups[collection2].length)];
          
          const candidatePair = [nft1, nft2];
          
          // Check if this pair has been seen before
          if (!this.hasPairBeenSeen(candidatePair[0].id, candidatePair[1].id)) {
            nfts = candidatePair;
            console.log(`✅ Cross-collection matchup: ${collection1} vs ${collection2}`);
          } else {
            console.log(`🔄 Cross-coll pair already seen: ${candidatePair[0].name} vs ${candidatePair[1].name}, trying again...`);
            attempts++;
          }
        }
        
        if (nfts.length === 0) {
          console.log(`⚠️ Could not find unique cross-coll pair after ${maxAttempts} attempts, allowing duplicate`);
          const shuffled = nftsToUse.sort(() => 0.5 - Math.random());
          nfts = shuffled.slice(0, 2);
        }
      }

      // Debug: Alert if any selected NFTs are unrevealed
      nfts.forEach((nft, i) => {
        if (nft.collection_name === 'Kabu' || nft.collection_name === 'Beeish') {
          console.log(`🚨 MATCHUP NFT ${i + 1}: ${nft.collection_name} - ${nft.name}`);
          console.log(`    Traits:`, nft.traits);
          console.log(`    Traits JSON:`, JSON.stringify(nft.traits, null, 2));
        }
      });
      
      // Mark both NFTs as seen and track the pair
      this.markNFTAsSeen(nfts[0].id);
      this.markNFTAsSeen(nfts[1].id);
      this.markPairAsSeen(nfts[0].id, nfts[1].id);

      // 🔥 FIRE VOTE PRIORITY: Check if either NFT has FIRE votes before rejecting
      const [nft1HasFire, nft2HasFire] = await Promise.all([
        this.checkFireVotes(nfts[0].id),
        this.checkFireVotes(nfts[1].id)
      ]);

      // Preload both images in parallel and validate they load successfully
      const [image1Loaded, image2Loaded] = await Promise.all([
        this.preloadImage(nfts[0].image),
        this.preloadImage(nfts[1].image)
      ]);

      // 🔥 FIRE VOTE OVERRIDE: If either NFT has FIRE votes, allow it even with broken images
      const fireOverride = nft1HasFire || nft2HasFire;

      if (!image1Loaded || !image2Loaded) {
        if (fireOverride) {
          console.log(`🔥 FIRE OVERRIDE: Including matchup despite image failures - NFT1(${image1Loaded ? '✅' : '❌'}${nft1HasFire ? ' 🔥' : ''}) NFT2(${image2Loaded ? '✅' : '❌'}${nft2HasFire ? ' 🔥' : ''})`);
          // Continue with original images even if they fail to load - let the frontend handle fallbacks
        } else {
          console.log(`🚫 Skipping matchup - image(s) failed to load: NFT1(${image1Loaded ? '✅' : '❌'}) NFT2(${image2Loaded ? '✅' : '❌'})`);
          
          // Prevent infinite recursion - limit retries
          if (retryCount >= 3) {
            console.log(`⚠️ Max retries (${retryCount}) reached for ${voteType} session generation, allowing session with failed images to prevent infinite loop`);
            // Continue with the session even if images failed - let frontend handle fallbacks
          } else {
            // Try again with different NFTs
            return await this.generateMatchupSession(voteType, collectionFilter, retryCount + 1);
          }
        }
      }

      // Map database results to NFT type
      const nft1 = {
        ...nfts[0],
        collection_address: nfts[0].contract_address,
        token_address: nfts[0].contract_address
      };
      
      const nft2 = {
        ...nfts[1],
        collection_address: nfts[1].contract_address,
        token_address: nfts[1].contract_address
      };
      
      return {
        nft1: nft1,
        nft2: nft2,
        vote_type: voteType
      };
    } catch (error) {
      console.error(`❌ Error generating ${voteType} session:`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        voteType,
        collectionFilter
      });
      
      // Try to provide more context about the failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('relation') || errorMessage.includes('table')) {
        console.error('🔍 Database schema issue detected - check if NFTs table exists and has correct columns');
      }
      
      return null;
    }
  }

  // 🧠 Smart enhanced session generation with performance optimization
  private async generateEnhancedSession(collectionFilter?: string): Promise<VotingSession | null> {
    if (!this.useEnhancedEngine) {
      return this.generateLegacySession(collectionFilter);
    }

    // Smart ratio: Only use enhanced system for a portion of sessions
    // Also check if enhanced system has been slow recently
    const recentTimeouts = this.enhancedAttempts > 5 && this.enhancedSuccessRate < 0.5;
    const useEnhanced = Math.random() < this.enhancedRatio && !recentTimeouts;
    
    if (!useEnhanced || recentTimeouts) {
      const reason = recentTimeouts ? 'recent timeouts' : `${Math.round((1 - this.enhancedRatio) * 100)}% legacy ratio`;
      console.log(`🚀 Using legacy for speed (${reason})`);
      return this.generateLegacySession(collectionFilter);
    }

    this.enhancedAttempts++;
    const filterLabel = collectionFilter || 'mixed';
    
    try {
      console.log(`🧠 Smart enhanced generation for ${filterLabel}...`);
      
      // Timeout wrapper for enhanced calls
      const enhancedPromise = enhancedMatchupIntegration.generateEnhancedSession({
        useEnhancedEngine: true,
        collectionFilter,
        maxCandidates: 5, // Reduced for speed
        prioritizeInformation: true,
        excludePairs: this.seenNFTPairs // Pass seen pairs to enhanced system for variety
      });

      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.log(`⏱️ Enhanced timeout after ${this.enhancedTimeout}ms, falling back`);
          resolve(null);
        }, this.enhancedTimeout);
      });

      const enhancedResult = await Promise.race([enhancedPromise, timeoutPromise]);
      
      if (enhancedResult) {
        // Convert enhanced result to VotingSession format
        let session: VotingSession;
        
        if (enhancedResult.vote_type === 'slider' && enhancedResult.nft) {
          session = {
            vote_type: 'slider',
            nft: enhancedResult.nft
          };
        } else if ((enhancedResult.vote_type === 'same_coll' || enhancedResult.vote_type === 'cross_coll') && 
                   enhancedResult.nft1 && enhancedResult.nft2) {
          session = {
            vote_type: enhancedResult.vote_type,
            nft1: enhancedResult.nft1,
            nft2: enhancedResult.nft2
          };
        } else {
          // Invalid enhanced result, fall back to legacy
          return this.generateLegacySession(collectionFilter);
        }

        // Track enhanced system success
        this.enhancedSuccessRate = ((this.enhancedSuccessRate * (this.enhancedAttempts - 1)) + 1) / this.enhancedAttempts;
        
        console.log(`⚡ Enhanced ${enhancedResult.vote_type} (Score: ${enhancedResult.information_score?.toFixed(2) || 'N/A'}) - ${(this.enhancedSuccessRate * 100).toFixed(0)}% success`);
        
        return session;
      } else {
        // Track timeout/failure
        this.enhancedSuccessRate = ((this.enhancedSuccessRate * (this.enhancedAttempts - 1)) + 0) / this.enhancedAttempts;
        
        console.log(`🚀 Enhanced timeout/failed, using legacy for speed (success rate: ${Math.round(this.enhancedSuccessRate * 100)}%)`);
        return this.generateLegacySession(collectionFilter);
      }
    } catch (error) {
      // Track error
      this.enhancedSuccessRate = ((this.enhancedSuccessRate * (this.enhancedAttempts - 1)) + 0) / this.enhancedAttempts;
      
      console.log(`🚀 Enhanced error, using legacy (success rate: ${Math.round(this.enhancedSuccessRate * 100)}%): ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.generateLegacySession(collectionFilter);
    }
  }

  // 🔄 Generate single voting session (collection-aware) - Legacy method
  private async generateLegacySession(collectionFilter?: string): Promise<VotingSession | null> {
    const voteType = this.decideVoteType();
    const filterLabel = collectionFilter || 'mixed';
    
    try {
      if (voteType === 'slider') {
        const session = await this.generateSliderSession(collectionFilter);
        if (session) {
          console.log(`✅ Generated legacy ${voteType} session for ${filterLabel}`);
        } else {
          console.log(`❌ Failed to generate legacy ${voteType} session for ${filterLabel}`);
        }
        return session;
      } else {
        const session = await this.generateMatchupSession(voteType, collectionFilter);
        if (session) {
          console.log(`✅ Generated legacy ${voteType} session for ${filterLabel}`);
        } else {
          console.log(`❌ Failed to generate legacy ${voteType} session for ${filterLabel}`);
        }
        return session;
      }
    } catch (error) {
      console.error(`❌ Error generating legacy ${voteType} session for ${filterLabel}:`, error);
      return null;
    }
  }

  // 🔄 Generate single voting session (collection-aware) - Updated
  private async generateSession(collectionFilter?: string): Promise<VotingSession | null> {
    return this.generateEnhancedSession(collectionFilter);
  }

  // 🔄 Generate single voting session (backward compatibility)
  private async generateVotingSession(): Promise<VotingSession | null> {
    return this.generateSession(); // Use mixed collection by default
  }

  // 🚀 OPTIMIZED: Preload sessions into LIFO stack for instant access
  async preloadSessions(count: number = this.TARGET_STACK_SIZE): Promise<void> {
    if (this.isPreloading) return;
    
    this.isPreloading = true;
    console.log(`🚀 STACK PRELOAD: Loading ${count} sessions into instant-access stack...`);
    
    const startTime = performance.now();
    
    // 🚀 SPEED OPTIMIZATION: Generate sessions in parallel batches
    const sessions: VotingSession[] = [];
    const parallelBatches = Math.ceil(count / this.MAX_PARALLEL_PRELOAD);
    
    for (let batch = 0; batch < parallelBatches; batch++) {
      const batchStart = batch * this.MAX_PARALLEL_PRELOAD;
      const batchEnd = Math.min(batchStart + this.MAX_PARALLEL_PRELOAD, count);
      const batchSize = batchEnd - batchStart;
      
      console.log(`📦 Generating batch ${batch + 1}/${parallelBatches} (${batchSize} sessions)...`);
      
      // Generate batch in parallel
      const batchPromises = Array.from({ length: batchSize }, () => this.generateSession());
      const batchResults = await Promise.all(batchPromises);
      const validBatchSessions = batchResults.filter(s => s !== null) as VotingSession[];
      
      sessions.push(...validBatchSessions);
      console.log(`✅ Batch ${batch + 1} completed: ${validBatchSessions.length}/${batchSize} valid sessions`);
    }
    
    // 🚀 Push to STACK (LIFO) for instant access
    this.sessionStack.push(...sessions);
    
    const loadTime = performance.now() - startTime;
    const avgTime = sessions.length > 0 ? Math.round(loadTime / sessions.length) : 0;
    console.log(`✅ STACK LOADED: ${sessions.length}/${count} sessions in ${Math.round(loadTime)}ms (${avgTime}ms each)`);
    console.log(`📚 Stack size: ${this.sessionStack.length} sessions ready for instant access`);
    
    // If we didn't get enough sessions, try again immediately  
    if (sessions.length < count * 0.8) {
      console.log(`⚠️ Low success rate (${sessions.length}/${count}), retrying with smaller batch...`);
      setTimeout(() => {
        this.isPreloading = false;
        this.preloadSessions(Math.max(3, count - sessions.length));
      }, 100);
    } else {
      this.isPreloading = false;
    }
  }

  // ⚡ INSTANT ACCESS: Pop session from stack (LIFO for maximum speed)
  getNextSession(collectionFilter?: string): VotingSession | null {
    // 🎯 PERFORMANCE OPTIMIZATION: Re-enable preloader with enhanced duplicate checking
    console.log(`⚡ PRELOADER RE-ENABLED: Using cached sessions with duplicate validation`);
    
    const filterKey = collectionFilter || 'mixed';
    
    if (this.sessionStack.length === 0) {
      console.log(`📦 Preloader empty for ${filterKey}, falling back to database...`);
      return null;
    }

    // Pop the most recent session (LIFO)
    const session = this.sessionStack.pop()!;
    console.log(`⚡ INSTANT ACCESS: Popped ${session.vote_type} session, ${this.sessionStack.length} remaining in stack`);
    
    // 🔄 Trigger background refill if stack is getting low
    if (this.sessionStack.length <= this.REFILL_TRIGGER) {
      console.log(`🔄 Stack low (${this.sessionStack.length}), triggering background refill...`);
      this.preloadSessions(this.TARGET_STACK_SIZE - this.sessionStack.length);
    }

    // 🚫 Mark NFTs as seen when actually consumed by user (prevents duplicates)
    if (session.vote_type === 'slider' && session.nft) {
      this.markNFTAsSeen(session.nft.id);
      console.log(`🚫 Marked NFT ${session.nft.id} as seen (slider)`);
      
      // Remove any duplicate slider sessions from the stack
      this.removeDuplicateSliderSessionsFromStack(session.nft.id);
    } else if ((session.vote_type === 'same_coll' || session.vote_type === 'cross_coll') && session.nft1 && session.nft2) {
      this.markNFTAsSeen(session.nft1.id);
      this.markNFTAsSeen(session.nft2.id);
      this.markPairAsSeen(session.nft1.id, session.nft2.id);
      console.log(`🚫 Marked NFTs ${session.nft1.id} and ${session.nft2.id} as seen (matchup)`);
      
      // Remove any duplicate sessions from the stack
      this.removeDuplicateSessionsFromStack(session.nft1.id, session.nft2.id);
    }

    return session;
  }

  // 🎯 Preload sessions for stack (simplified - no collection filtering)
  async preloadSessionsForCollection(count: number, collectionFilter?: string) {
    // Since we removed collection filtering, just refill the main stack
    if (this.isPreloading) return;
    
    console.log(`🎯 Adding ${count} sessions to stack (collection filtering removed for speed)...`);
    await this.preloadSessions(count);
  }

  // 📊 Get stack status (optimized for speed)
  getStatus() {
    return {
      queueLength: this.sessionStack.length, // Stack size for backward compatibility
      stackSize: this.sessionStack.length,
      isPreloading: this.isPreloading,
      cacheSize: this.imagePreloadCache.size,
      targetSize: this.TARGET_STACK_SIZE,
      minimumSize: this.MINIMUM_STACK_SIZE
    };
  }

  // 🔍 Force stack to minimum size (optimized)
  async ensureMinimumStack(): Promise<void> {
    if (this.sessionStack.length < this.MINIMUM_STACK_SIZE && !this.isPreloading) {
      const needed = this.TARGET_STACK_SIZE - this.sessionStack.length;
      console.log(`🔍 Enforcing minimum stack: need ${needed} more sessions`);
      await this.preloadSessions(needed);
    }
  }
  
  // Backward compatibility alias
  async ensureMinimumQueue(): Promise<void> {
    return this.ensureMinimumStack();
  }

  // 🔥 Initialize optimized stack preloader
  async initialize(): Promise<void> {
    console.log('🔥 Initializing STACK-OPTIMIZED voting preloader...');
    await this.preloadSessions();
    
    // Ensure we hit the minimum after initial load
    await this.ensureMinimumStack();
    
    console.log(`✅ Stack preloader initialized with ${this.sessionStack.length} sessions ready for instant access`);
    console.log(`🚀 PERFORMANCE: ${this.sessionStack.length}x sessions preloaded for zero-delay voting`);
  }

  // 🚫 Mark NFT as seen to prevent duplicates
  private markNFTAsSeen(nftId: string): void {
    this.seenNFTIds.add(nftId);
    
    // Clear old entries if we've seen too many NFTs
    if (this.seenNFTIds.size > this.MAX_SEEN_NFTS) {
      console.log(`🔄 Clearing seen NFTs history (${this.seenNFTIds.size} entries)`);
      this.clearSeenNFTs();
    }
  }

  // 🔄 Track NFT pairs to prevent exact duplicates (now using centralized service)
  private markPairAsSeen(nftId1: string, nftId2: string): void {
    const pairKey = this.getPairKey(nftId1, nftId2);
    this.seenNFTPairs.add(pairKey);
    
    // Also track in centralized service
    const { recentPairsService } = require('../src/lib/recent-pairs-service');
    recentPairsService.trackPair(nftId1, nftId2);
    
    // Clear old pairs if we've seen too many
    if (this.seenNFTPairs.size > this.MAX_SEEN_PAIRS) {
      console.log(`🔄 Clearing seen pairs history (${this.seenNFTPairs.size} entries)`);
      this.clearSeenPairs();
    }
  }

  // 🔍 Check if NFT pair has been seen before (fast local check only)
  private hasPairBeenSeen(nftId1: string, nftId2: string): boolean {
    const pairKey = this.getPairKey(nftId1, nftId2);
    const localSeen = this.seenNFTPairs.has(pairKey);
    
    // Fast local check only - no blocking API calls for better performance
    const hasBeenSeen = localSeen;
    if (hasBeenSeen) {
      console.log(`🔄 Duplicate pair detected: ${nftId1} vs ${nftId2} (${this.seenNFTPairs.size} pairs tracked)`);
    }
    return hasBeenSeen;
  }

  // 🔑 Generate consistent pair key (sorted to handle A+B = B+A)
  private getPairKey(nftId1: string, nftId2: string): string {
    return [nftId1, nftId2].sort().join('|');
  }

  // 🧹 Clear seen pairs tracking
  private clearSeenPairs(): void {
    this.seenNFTPairs.clear();
    console.log('✨ Cleared seen pairs - duplicate pairs possible again');
  }

  // 🗑️ Remove duplicate sessions from stack
  private removeDuplicateSessionsFromStack(nft1Id: string, nft2Id: string): void {
    const pairKey = this.getPairKey(nft1Id, nft2Id);
    const initialLength = this.sessionStack.length;
    
    this.sessionStack = this.sessionStack.filter(session => {
      if (session.vote_type === 'same_coll' || session.vote_type === 'cross_coll') {
        if (session.nft1 && session.nft2) {
          const sessionPairKey = this.getPairKey(session.nft1.id, session.nft2.id);
          return sessionPairKey !== pairKey;
        }
      }
      return true;
    });
    
    const removedCount = initialLength - this.sessionStack.length;
    if (removedCount > 0) {
      console.log(`🗑️ Removed ${removedCount} duplicate sessions from stack (${this.sessionStack.length} remaining)`);
    }
  }

  // 🗑️ Remove duplicate slider sessions from stack
  private removeDuplicateSliderSessionsFromStack(nftId: string): void {
    const initialLength = this.sessionStack.length;
    
    this.sessionStack = this.sessionStack.filter(session => {
      if (session.vote_type === 'slider' && session.nft) {
        return session.nft.id !== nftId;
      }
      return true;
    });
    
    const removedCount = initialLength - this.sessionStack.length;
    if (removedCount > 0) {
      console.log(`🗑️ Removed ${removedCount} duplicate slider sessions from stack (${this.sessionStack.length} remaining)`);
    }
  }

  // 🧹 Clear seen NFTs tracking
  private clearSeenNFTs(): void {
    this.seenNFTIds.clear();
    console.log('✨ Cleared seen NFTs - fresh duplicates possible again');
  }

  // 📊 Public method to clear seen NFTs (for prize breaks, etc.)
  public resetSession(): void {
    // Instead of completely clearing, only clear old NFTs (keep recent 20)
    this.keepRecentSeenNFTs(20);
    this.keepRecentSeenPairs(10);
    console.log('🎯 Session reset - cleared old duplicate tracking, keeping recent NFTs/pairs');
  }

  // 🔄 Keep only the most recent N seen NFTs to prevent immediate repeats
  private keepRecentSeenNFTs(keepCount: number): void {
    if (this.seenNFTIds.size <= keepCount) {
      console.log(`📚 Keeping all ${this.seenNFTIds.size} seen NFTs (under limit of ${keepCount})`);
      return;
    }

    // Convert to array, keep last N items
    const seenArray = Array.from(this.seenNFTIds);
    const toKeep = seenArray.slice(-keepCount);
    
    this.seenNFTIds.clear();
    toKeep.forEach(nftId => this.seenNFTIds.add(nftId));
    
    console.log(`📚 Kept recent ${toKeep.length} seen NFTs, cleared ${seenArray.length - toKeep.length} old entries`);
  }

  // 🔄 Keep only the most recent N seen pairs to prevent immediate repeats  
  private keepRecentSeenPairs(keepCount: number): void {
    if (this.seenNFTPairs.size <= keepCount) {
      console.log(`📚 Keeping all ${this.seenNFTPairs.size} seen pairs (under limit of ${keepCount})`);
      return;
    }

    // Convert to array, keep last N items
    const pairsArray = Array.from(this.seenNFTPairs);
    const toKeep = pairsArray.slice(-keepCount);
    
    this.seenNFTPairs.clear();
    toKeep.forEach(pair => this.seenNFTPairs.add(pair));
    
    console.log(`📚 Kept recent ${toKeep.length} seen pairs, cleared ${pairsArray.length - toKeep.length} old entries`);
  }

  // 🚫👻 Force clear all cached sessions and rebuild stack
  public async forceFullReset(): Promise<void> {
    this.sessionStack.length = 0; // Clear the stack
    this.clearSeenNFTs();
    this.clearSeenPairs();
    this.imagePreloadCache.clear();
    console.log('🔄 FORCE RESET: Cleared stack, seen NFTs, and image cache');
    
    // Restart preloading with fresh stack
    if (!this.isPreloading) {
      console.log('🔄 Rebuilding session stack with fresh data...');
      await this.preloadSessions(this.TARGET_STACK_SIZE);
      console.log('✅ Fresh session stack generated');
    }
  }

  // 📋 Get session stats for stack (optimized with enhanced metrics)
  public getSessionStats() {
    return {
      queueLength: this.sessionStack.length, // For backward compatibility
      stackSize: this.sessionStack.length,
      isPreloading: this.isPreloading,
      cacheSize: this.imagePreloadCache.size,
      seenNFTs: this.seenNFTIds.size,
      maxSeenNFTs: this.MAX_SEEN_NFTS,
      targetSize: this.TARGET_STACK_SIZE,
      minimumSize: this.MINIMUM_STACK_SIZE,
      
      // 🧠 Enhanced system metrics
      enhancedEngineEnabled: this.useEnhancedEngine,
      enhancedSuccessRate: this.enhancedSuccessRate,
      enhancedAttempts: this.enhancedAttempts
    };
  }

  // 🧠 Enable/disable enhanced engine
  public setEnhancedEngine(enabled: boolean): void {
    const wasEnabled = this.useEnhancedEngine;
    this.useEnhancedEngine = enabled;
    
    if (wasEnabled !== enabled) {
      console.log(`🧠 Enhanced engine ${enabled ? 'ENABLED' : 'DISABLED'}`);
      
      // Reset metrics when switching modes
      this.enhancedSuccessRate = 0;
      this.enhancedAttempts = 0;
      
      // Optional: Clear stack to regenerate with new engine
      if (enabled) {
        console.log('🔄 Clearing stack to regenerate with enhanced engine...');
        this.forceFullReset();
      }
    }
  }

  // 🧠 Get enhanced engine status
  public async getEnhancedEngineStatus() {
    return await enhancedMatchupIntegration.getEngineStatus();
  }

  // 🚫 Skip failed session and get next from stack
  public async skipFailedSession(): Promise<VotingSession | null> {
    console.log('🚫 Skipping failed session, popping next from stack...');
    
    // With stack-based system, we simply try the next session
    let session = this.getNextSession();
    let attempts = 0;
    const maxAttempts = 5;

    // Keep trying until we find a session with working images or run out of attempts
    while (session && attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 Attempt ${attempts}: Testing session images...`);

      const imagesValid = await this.validateSessionImages(session);
      if (imagesValid) {
        console.log(`✅ Found valid session after ${attempts} attempts`);
        return session;
      }

      console.log(`❌ Session images failed, trying next from stack...`);
      session = this.getNextSession();
    }

    console.log('🚨 Could not find a session with valid images in stack');
    
    // Emergency: Force rebuild stack if all sessions are failing
    if (this.sessionStack.length < 3) {
      console.log('🚨 Stack nearly empty, forcing emergency rebuild...');
      await this.forceFullReset();
    }
    
    return null;
  }

  // 🔍 Validate that all images in a session can load
  private async validateSessionImages(session: VotingSession): Promise<boolean> {
    try {
      if (session.vote_type === 'slider') {
        return await this.validateImage(session.nft.image);
      } else {
        // For matchups, both images must be valid
        const [img1Valid, img2Valid] = await Promise.all([
          this.validateImage(session.nft1.image),
          this.validateImage(session.nft2.image)
        ]);
        return img1Valid && img2Valid;
      }
    } catch (error) {
      console.error('❌ Error validating session images:', error);
      return false;
    }
  }

  // 🖼️ Quick image validation (faster than preload)
  private async validateImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl) return false;
    
    // Check cache first
    if (this.imagePreloadCache.has(imageUrl)) {
      return this.imagePreloadCache.get(imageUrl)!;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const fixedUrl = fixImageUrl(imageUrl);
      
      const timeout = setTimeout(() => {
        resolve(false);
      }, 2000); // Quick 2-second timeout for validation

      img.onload = () => {
        clearTimeout(timeout);
        this.imagePreloadCache.set(imageUrl, true);
        resolve(true);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        this.imagePreloadCache.set(imageUrl, false);
        resolve(false);
      };
      
      img.src = fixedUrl;
    });
  }

  // 🔥 Check if an NFT has FIRE votes
  private async checkFireVotes(nftId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('nft_id', nftId)
        .eq('vote_type', 'fire')
        .limit(1);

      if (error) {
        console.warn(`⚠️ Error checking FIRE votes for ${nftId}:`, error);
        return false;
      }

      return (data && data.length > 0);
    } catch (error) {
      console.warn(`⚠️ Exception checking FIRE votes for ${nftId}:`, error);
      return false;
    }
  }

  // 🔥 Generate a placeholder image for FIRE-voted NFTs with broken images
  private generateFirePlaceholder(nftName: string, collectionName: string): string {
    // Use a fire-themed gradient as a data URL
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Create fire gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, '#ff6b35'); // Orange
      gradient.addColorStop(0.5, '#ff4757'); // Red  
      gradient.addColorStop(1, '#8b0000'); // Dark red
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 400, 400);
      
      // Add fire emoji
      ctx.font = '60px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🔥', 200, 200);
      
      // Add NFT name
      ctx.font = '16px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(nftName, 200, 250);
      ctx.fillText(collectionName, 200, 280);
      
      return canvas.toDataURL();
    }
    
    // Fallback to a simple placeholder service with fire theme
    const hash = Math.abs((nftName + collectionName).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0));
    
    return `https://picsum.photos/400/400?random=${hash}&blur=1`;
  }

  // 🔥 Prioritize NFTs with FIRE votes in selection
  private async prioritizeFireNFTs(nfts: any[]): Promise<any[]> {
    if (!nfts || nfts.length === 0) return nfts;
    
    try {
      // Check which NFTs have FIRE votes
      const nftsWithFireStatus = await Promise.all(
        nfts.map(async (nft) => {
          const hasFireVotes = await this.checkFireVotes(nft.id);
          return { ...nft, hasFireVotes };
        })
      );

      // Separate FIRE NFTs from regular NFTs
      const fireNfts = nftsWithFireStatus.filter(nft => nft.hasFireVotes);
      const regularNfts = nftsWithFireStatus.filter(nft => !nft.hasFireVotes);

      console.log(`🔥 FIRE PRIORITY: ${fireNfts.length} FIRE NFTs, ${regularNfts.length} regular NFTs`);

      // Shuffle each group separately
      const shuffledFireNfts = fireNfts.sort(() => 0.5 - Math.random());
      const shuffledRegularNfts = regularNfts.sort(() => 0.5 - Math.random());

      // Return FIRE NFTs first, then regular NFTs
      return [...shuffledFireNfts, ...shuffledRegularNfts];
    } catch (error) {
      console.warn('⚠️ Error prioritizing FIRE NFTs, falling back to random selection:', error);
      return nfts.sort(() => 0.5 - Math.random());
    }
  }
}

// Export singleton instance
export const votingPreloader = VotingPreloader.getInstance();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).votingPreloader = votingPreloader;
}
