// 🚀 Ultra-fast voting preloader system
// Preloads voting sessions with images for instant transitions

import { supabase } from './supabase';
import { VotingSession } from '@/types/voting';
import { fixImageUrl, getNextIPFSGateway, ipfsGatewayManager } from './ipfs-gateway-manager';

class VotingPreloader {
  private static instance: VotingPreloader;
  private preloadedSessions: Map<string, VotingSession[]> = new Map(); // Collection-aware queues
  private isPreloading = false;
  private readonly TARGET_PRELOAD_COUNT = 8; // Always maintain 8 sessions per collection
  private readonly MINIMUM_QUEUE_SIZE = 5; // Never go below 5 per collection
  private readonly REFILL_TRIGGER = 3; // Refill when queue drops to 3 per collection
  private imagePreloadCache = new Map<string, boolean>();
  private seenNFTIds = new Set<string>(); // Track NFTs shown in current session
  private readonly MAX_SEEN_NFTS = 50; // Clear tracking after this many NFTs

  static getInstance(): VotingPreloader {
    if (!VotingPreloader.instance) {
      VotingPreloader.instance = new VotingPreloader();
    }
    return VotingPreloader.instance;
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
      const maxAttempts = 5; // Try 5 different gateways
      let currentUrl = fixImageUrl(imageUrl);

      const tryLoadImage = () => {
        const img = new Image();
        
        const timeout = setTimeout(() => {
          console.log(`⏰ Timeout for attempt ${attemptCount + 1}: ${currentUrl.substring(0, 60)}...`);
          tryNextGateway();
        }, 5000); // Increased timeout to 5 seconds

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
  private async generateSliderSession(collectionFilter?: string): Promise<VotingSession | null> {
    try {
      // Try to get NFTs with low slider count first, excluding already seen, video files, and unrevealed NFTs
      let query = supabase
        .from('nfts')
        .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count, traits')
        .lt('slider_count', 5)
        .not('image', 'ilike', '%.mp4%')
        .not('image', 'ilike', '%.mov%')
        .not('image', 'ilike', '%.avi%')
        .not('image', 'ilike', '%.webm%')
        .not('image', 'ilike', '%.mkv%')
        .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // Exclude unrevealed NFTs
        .not('traits', 'cs', '[{"trait_type": "reveal", "value": "unrevealed"}]')  // Case variations
        .not('traits', 'cs', '[{"trait_type": "Status", "value": "Unrevealed"}]')  // Alternative trait names
        .not('traits', 'cs', '[{"trait_type": "status", "value": "unrevealed"}]')  // Case variations
        .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu collection unrevealed
        .not('traits', 'cs', '[{"trait_type": "status", "value": "hidden"}]')     // Case variations
        .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // Bearish collection unrevealed
        .not('traits', 'cs', '[{"trait_type": "stage", "value": "pre-reveal"}]')  // Case variations
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // Beeish collection unrevealed (specific to Beeish)
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // Beeish collection unrevealed (specific to Beeish)
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // Beeish collection unrevealed (specific to Beeish)
        .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]')      // Beeish collection unrevealed (specific to Beeish)
        .not('traits', 'cs', '[{"trait_type": "hive", "value": "regular"}]')      // Case variations
        .not('traits', 'cs', '[{"trait_type": "hive", "value": "robot"}]')        // Case variations
        .not('traits', 'cs', '[{"trait_type": "hive", "value": "zombee"}]')       // Case variations
        .not('traits', 'cs', '[{"trait_type": "hive", "value": "present"}]');     // Case variations

      // Apply collection filter if specified
      if (collectionFilter) {
        query = query.eq('collection_name', collectionFilter);
      }

      const { data: nfts, error } = await query
        .order('slider_count', { ascending: true })
        .order('total_votes', { ascending: true })
        .limit(20); // Get more to filter out seen ones

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
        let fallbackQuery = supabase
          .from('nfts')
          .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count, traits')
          .not('image', 'ilike', '%.mp4%')
          .not('image', 'ilike', '%.mov%')
          .not('image', 'ilike', '%.avi%')
          .not('image', 'ilike', '%.webm%')
          .not('image', 'ilike', '%.mkv%')
          .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // Exclude unrevealed NFTs
          .not('traits', 'cs', '[{"trait_type": "reveal", "value": "unrevealed"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Unrevealed"}]')  // Alternative trait names
          .not('traits', 'cs', '[{"trait_type": "status", "value": "unrevealed"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu collection unrevealed
          .not('traits', 'cs', '[{"trait_type": "status", "value": "hidden"}]')     // Case variations
          .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // Bearish collection unrevealed
          .not('traits', 'cs', '[{"trait_type": "stage", "value": "pre-reveal"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]')      // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "regular"}]')      // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "robot"}]')        // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "zombee"}]')       // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "present"}]');     // Case variations

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
      
      // Preload image and validate it loads successfully
      const imageLoaded = await this.preloadImage(nft.image);
      
      if (!imageLoaded) {
        console.log(`🚫 Skipping NFT ${nft.id} - image failed to load: ${nft.image.substring(0, 50)}...`);
        // Try again with a different NFT
        return await this.generateSliderSession();
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
  private async generateMatchupSession(voteType: 'same_coll' | 'cross_coll', collectionFilter?: string): Promise<VotingSession | null> {
    try {
      let nfts;
      
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
          .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // Exclude unrevealed NFTs
          .not('traits', 'cs', '[{"trait_type": "reveal", "value": "unrevealed"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Unrevealed"}]')  // Alternative trait names
          .not('traits', 'cs', '[{"trait_type": "status", "value": "unrevealed"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu collection unrevealed
          .not('traits', 'cs', '[{"trait_type": "status", "value": "hidden"}]')     // Case variations
          .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // Bearish collection unrevealed
          .not('traits', 'cs', '[{"trait_type": "stage", "value": "pre-reveal"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]')      // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "regular"}]')      // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "robot"}]')        // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "zombee"}]')       // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "present"}]');     // Case variations

        // Apply collection filter if specified
        if (collectionFilter) {
          sameCollQuery = sameCollQuery.eq('collection_name', collectionFilter);
        }

        const { data: allNfts } = await sameCollQuery.limit(1000); // Increased limit for collection-specific queries

        console.log(`🔍 Found ${allNfts?.length || 0} same-collection NFTs after unrevealed filters`);
        if (!allNfts?.length) return null;

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
          .filter(([_, nfts]) => nfts.length >= 2);

        if (!validCollections.length) return null;

        // Pick random collection with 2+ NFTs
        const [_, collectionNfts] = validCollections[Math.floor(Math.random() * validCollections.length)];
        
        // Pick two random NFTs from that collection
        const shuffled = collectionNfts.sort(() => 0.5 - Math.random());
        nfts = shuffled.slice(0, 2);
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
          .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // Exclude unrevealed NFTs
          .not('traits', 'cs', '[{"trait_type": "reveal", "value": "unrevealed"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Unrevealed"}]')  // Alternative trait names
          .not('traits', 'cs', '[{"trait_type": "status", "value": "unrevealed"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu collection unrevealed
          .not('traits', 'cs', '[{"trait_type": "status", "value": "hidden"}]')     // Case variations
          .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // Bearish collection unrevealed
          .not('traits', 'cs', '[{"trait_type": "stage", "value": "pre-reveal"}]')  // Case variations
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]')      // Beeish collection unrevealed (specific to Beeish)
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "regular"}]')      // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "robot"}]')        // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "zombee"}]')       // Case variations
          .not('traits', 'cs', '[{"trait_type": "hive", "value": "present"}]');     // Case variations

        // Apply collection filter if specified
        if (collectionFilter) {
          crossCollQuery = crossCollQuery.eq('collection_name', collectionFilter);
        }

        const { data: randomNfts, error } = await crossCollQuery.limit(500); // Increased limit for collection-specific queries

        console.log(`🔍 Found ${randomNfts?.length || 0} cross-collection NFTs after unrevealed filters`);
        if (error || !randomNfts || randomNfts.length < 2) {
          console.error('❌ Failed to fetch NFTs for cross-collection matchup:', error);
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
        
        const shuffled = nftsToUse.sort(() => 0.5 - Math.random());
        nfts = shuffled.slice(0, 2);
      }

      // Debug: Alert if any selected NFTs are unrevealed
      nfts.forEach((nft, i) => {
        if (nft.collection_name === 'Kabu' || nft.collection_name === 'Beeish') {
          console.log(`🚨 MATCHUP NFT ${i + 1}: ${nft.collection_name} - ${nft.name}`);
          console.log(`    Traits:`, nft.traits);
          console.log(`    Traits JSON:`, JSON.stringify(nft.traits, null, 2));
        }
      });
      
      // Mark both NFTs as seen
      this.markNFTAsSeen(nfts[0].id);
      this.markNFTAsSeen(nfts[1].id);

      // Preload both images in parallel and validate they load successfully
      const [image1Loaded, image2Loaded] = await Promise.all([
        this.preloadImage(nfts[0].image),
        this.preloadImage(nfts[1].image)
      ]);

      if (!image1Loaded || !image2Loaded) {
        console.log(`🚫 Skipping matchup - image(s) failed to load: NFT1(${image1Loaded ? '✅' : '❌'}) NFT2(${image2Loaded ? '✅' : '❌'})`);
        // Try again with different NFTs
        return await this.generateMatchupSession(voteType);
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
      console.error(`❌ Error generating ${voteType} session:`, error);
      return null;
    }
  }

  // 🔄 Generate single voting session (collection-aware)
  private async generateSession(collectionFilter?: string): Promise<VotingSession | null> {
    const voteType = this.decideVoteType();
    const filterLabel = collectionFilter || 'mixed';
    
    try {
      if (voteType === 'slider') {
        const session = await this.generateSliderSession(collectionFilter);
        if (session) {
          console.log(`✅ Generated ${voteType} session for ${filterLabel}`);
        } else {
          console.log(`❌ Failed to generate ${voteType} session for ${filterLabel}`);
        }
        return session;
      } else {
        const session = await this.generateMatchupSession(voteType, collectionFilter);
        if (session) {
          console.log(`✅ Generated ${voteType} session for ${filterLabel}`);
        } else {
          console.log(`❌ Failed to generate ${voteType} session for ${filterLabel}`);
        }
        return session;
      }
    } catch (error) {
      console.error(`❌ Error generating ${voteType} session for ${filterLabel}:`, error);
      return null;
    }
  }

  // 🔄 Generate single voting session (backward compatibility)
  private async generateVotingSession(): Promise<VotingSession | null> {
    return this.generateSession(); // Use mixed collection by default
  }

  // 🚀 Preload sessions in background (parallel for speed)
  async preloadSessions(count: number = this.TARGET_PRELOAD_COUNT): Promise<void> {
    if (this.isPreloading) return;
    
    this.isPreloading = true;
    console.log(`🚀 Preloading ${count} voting sessions in parallel...`);
    
    const startTime = performance.now();
    
    // Generate multiple batches in parallel for maximum speed
    const batchSize = Math.max(3, Math.ceil(count / 2));
    const batches = [];
    
    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i);
      const batch = Promise.all(
        Array.from({ length: batchCount }, () => this.generateVotingSession())
      );
      batches.push(batch);
    }
    
    const batchResults = await Promise.all(batches);
    const allSessions = batchResults.flat();
    const validSessions = allSessions.filter(s => s !== null) as VotingSession[];
    
    // Add to mixed collection queue for backward compatibility
    const mixedQueue = this.preloadedSessions.get('mixed') || [];
    this.preloadedSessions.set('mixed', [...mixedQueue, ...validSessions]);
    
    const loadTime = performance.now() - startTime;
    console.log(`✅ Preloaded ${validSessions.length}/${count} sessions in ${Math.round(loadTime)}ms (${Math.round(loadTime/validSessions.length)}ms each)`);
    
    // If we didn't get enough sessions, try again immediately  
    if (validSessions.length < count * 0.8) {
      console.log(`⚠️ Low success rate (${validSessions.length}/${count}), retrying...`);
      setTimeout(() => {
        this.isPreloading = false;
        this.preloadSessions(count - validSessions.length);
      }, 100);
    } else {
      this.isPreloading = false;
    }
  }

  // ⚡ Get next session instantly (collection-aware)
  getNextSession(collectionFilter?: string): VotingSession | null {
    const queueKey = collectionFilter || 'mixed';
    const queue = this.preloadedSessions.get(queueKey) || [];
    
    // Emergency check - never let queue go empty
    if (queue.length === 0) {
      console.warn(`⚠️ Queue empty for ${queueKey}! This should not happen.`);
      // Force immediate preload for this collection
      this.preloadSessionsForCollection(this.TARGET_PRELOAD_COUNT, collectionFilter);
      return null;
    }
    
    const session = queue.shift();
    this.preloadedSessions.set(queueKey, queue);
    
    // 🚫 Mark NFTs as seen when actually consumed by user (prevents duplicates)
    if (session) {
      if (session.vote_type === 'slider' && session.nft) {
        this.markNFTAsSeen(session.nft.id);
        console.log(`🚫 Marked NFT ${session.nft.id} as seen (slider)`);
      } else if ((session.vote_type === 'same_coll' || session.vote_type === 'cross_coll') && session.nft1 && session.nft2) {
        this.markNFTAsSeen(session.nft1.id);
        this.markNFTAsSeen(session.nft2.id);
        console.log(`🚫 Marked NFTs ${session.nft1.id} and ${session.nft2.id} as seen (matchup)`);
      }
    }
    
    // Aggressive queue management - always maintain 5+ sessions per collection
    if (queue.length <= this.REFILL_TRIGGER && !this.isPreloading) {
      console.log(`🔄 Queue low for ${queueKey} (${queue.length}), triggering refill...`);
      this.preloadSessionsForCollection(this.TARGET_PRELOAD_COUNT - queue.length, collectionFilter);
    }
    
    // Log queue status for monitoring
    if (queue.length < this.MINIMUM_QUEUE_SIZE) {
      console.warn(`⚠️ Queue below minimum for ${queueKey}! Current: ${queue.length}, Target: ${this.MINIMUM_QUEUE_SIZE}+`);
    }
    
    return session || null;
  }

  // 🎯 Preload sessions for specific collection (public method)
  async preloadSessionsForCollection(count: number, collectionFilter?: string) {
    if (this.isPreloading) return;
    
    const queueKey = collectionFilter || 'mixed';
    console.log(`🎯 Preloading ${count} sessions for ${queueKey}...`);
    
    this.isPreloading = true;
    const sessions = [];
    
    try {
      for (let i = 0; i < count; i++) {
        const session = await this.generateSession(collectionFilter);
        if (session) {
          sessions.push(session);
        }
      }
      
      // Add to the appropriate queue
      const existingQueue = this.preloadedSessions.get(queueKey) || [];
      this.preloadedSessions.set(queueKey, [...existingQueue, ...sessions]);
      
      console.log(`✅ Preloaded ${sessions.length} sessions for ${queueKey}`);
    } catch (error) {
      console.error(`❌ Error preloading sessions for ${queueKey}:`, error);
    } finally {
      this.isPreloading = false;
    }
  }

  // 📊 Get preload status (collection-aware)
  getStatus() {
    const totalSessions = Array.from(this.preloadedSessions.values())
      .reduce((total, queue) => total + queue.length, 0);
    
    const queues: Record<string, number> = {};
    for (const [key, queue] of this.preloadedSessions.entries()) {
      queues[key] = queue.length;
    }
    
    return {
      queueLength: totalSessions, // Keep for backward compatibility
      queues: queues,
      isPreloading: this.isPreloading,
      cacheSize: this.imagePreloadCache.size
    };
  }

  // 🔍 Force queue to minimum size (for mixed collection)
  async ensureMinimumQueue(): Promise<void> {
    const mixedQueue = this.preloadedSessions.get('mixed') || [];
    if (mixedQueue.length < this.MINIMUM_QUEUE_SIZE && !this.isPreloading) {
      const needed = this.TARGET_PRELOAD_COUNT - mixedQueue.length;
      console.log(`🔍 Enforcing minimum queue for mixed: need ${needed} more sessions`);
      await this.preloadSessions(needed);
    }
  }

  // 🔥 Initialize preloader with guaranteed minimum
  async initialize(): Promise<void> {
    console.log('🔥 Initializing voting preloader...');
    await this.preloadSessions();
    
    // Ensure we hit the minimum after initial load
    await this.ensureMinimumQueue();
    
    const totalSessions = Array.from(this.preloadedSessions.values())
      .reduce((total, queue) => total + queue.length, 0);
    console.log(`✅ Preloader initialized with ${totalSessions} total sessions ready`);
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

  // 🧹 Clear seen NFTs tracking
  private clearSeenNFTs(): void {
    this.seenNFTIds.clear();
    console.log('✨ Cleared seen NFTs - fresh duplicates possible again');
  }

  // 📊 Public method to clear seen NFTs (for prize breaks, etc.)
  public resetSession(): void {
    this.clearSeenNFTs();
    console.log('🎯 Session reset - cleared duplicate tracking');
  }

  // 🚫👻 Force clear all cached sessions (for filter updates, etc.)
  public async forceFullReset(): Promise<void> {
    this.preloadedSessions.clear();
    this.clearSeenNFTs();
    this.imagePreloadCache.clear();
    console.log('🔄 FORCE RESET: Cleared all preloaded sessions, seen NFTs, and image cache');
    
    // Restart preloading with updated filters and wait for completion
    if (!this.isPreloading) {
      console.log('🔄 Regenerating sessions with unrevealed NFT filters...');
      await this.preloadSessions(this.TARGET_PRELOAD_COUNT);
      console.log('✅ Fresh sessions generated with filters applied');
    }
  }

  // 📋 Get session stats including duplicate tracking
  public getSessionStats() {
    const totalSessions = Array.from(this.preloadedSessions.values())
      .reduce((total, queue) => total + queue.length, 0);
    
    return {
      queueLength: totalSessions,
      isPreloading: this.isPreloading,
      cacheSize: this.imagePreloadCache.size,
      seenNFTs: this.seenNFTIds.size,
      maxSeenNFTs: this.MAX_SEEN_NFTS
    };
  }

  // 🚫 Skip current session and get next one when images fail
  public async skipFailedSession(): Promise<VotingSession | null> {
    console.log('🚫 Skipping failed session, getting next available...');
    
    // Remove current session from mixed queue if it exists (fallback behavior)
    const mixedQueue = this.preloadedSessions.get('mixed') || [];
    if (mixedQueue.length > 0) {
      const failedSession = mixedQueue.shift();
      this.preloadedSessions.set('mixed', mixedQueue);
      console.log(`❌ Removed failed ${failedSession?.vote_type} session from mixed queue`);
    }

    // Try to get next session (default to mixed for backward compatibility)
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

      console.log(`❌ Session images failed, trying next...`);
      session = await this.getNextSession();
    }

    console.log('🚨 Could not find a session with valid images');
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
}

// Export singleton instance
export const votingPreloader = VotingPreloader.getInstance();
