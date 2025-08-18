// 🧠 Enhanced Matchup Selection Engine for Maximum Information Gain
// Advanced algorithms for optimal NFT pairing and collection management

import { supabase } from './supabase';
import type { VotingSession, NFT } from '@/types/voting';

// 📊 Information Theory Constants
const UNCERTAINTY_WEIGHT = 0.4;        // Weight for uncertainty-based selection
const ELO_PROXIMITY_WEIGHT = 0.3;      // Weight for close Elo ratings  
const VOTE_COUNT_WEIGHT = 0.2;         // Weight for underrepresented NFTs
const COLLECTION_DIVERSITY_WEIGHT = 0.1; // Weight for collection balance

// 🎯 TrueSkill-inspired uncertainty calculation
const DEFAULT_UNCERTAINTY = 100;       // New NFTs start with high uncertainty
const MIN_UNCERTAINTY = 25;           // Minimum uncertainty for well-established NFTs
const UNCERTAINTY_DECAY_RATE = 0.95;  // How quickly uncertainty decreases per vote

interface NFTWithMetrics extends NFT {
  uncertainty: number;
  information_potential: number;
  vote_deficit: number;
  collection_representation: number;
}

interface CollectionStatus {
  name: string;
  active: boolean;
  priority: number;
  nft_count: number;
  avg_votes_per_nft: number;
  last_selected: Date | null;
}

interface MatchupCandidate {
  nft1: NFTWithMetrics;
  nft2: NFTWithMetrics;
  information_score: number;
  matchup_type: 'same_coll' | 'cross_coll';
  selection_reason: string;
}

export class EnhancedMatchupEngine {
  private static instance: EnhancedMatchupEngine;
  private collectionStatus = new Map<string, CollectionStatus>();
  private recentPairs = new Set<string>(); // Track recent pairs to avoid immediate repeats
  private readonly MAX_RECENT_PAIRS = 1500; // Increased for better variety

  static getInstance(): EnhancedMatchupEngine {
    if (!EnhancedMatchupEngine.instance) {
      EnhancedMatchupEngine.instance = new EnhancedMatchupEngine();
    }
    return EnhancedMatchupEngine.instance;
  }

  // 🚀 Initialize collection management system
  async initializeCollectionManagement(): Promise<void> {
    console.log('🚀 Initializing Enhanced Matchup Engine...');
    
    try {
      // Check if collections table exists, create if not
      await this.ensureCollectionManagementTable();
      
      // Load or initialize collection statuses
      await this.loadCollectionStatuses();
      
      console.log('✅ Enhanced Matchup Engine initialized');
      console.log(`📊 Managing ${this.collectionStatus.size} collections`);
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Matchup Engine:', error);
      throw error;
    }
  }

  // 🗂️ Ensure collection management table exists
  private async ensureCollectionManagementTable(): Promise<void> {
    const { error } = await supabase.rpc('create_collection_management_table');
    
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Failed to create collection management table: ${error.message}`);
    }
  }

  // 📊 Load collection statuses from database
  private async loadCollectionStatuses(): Promise<void> {
    // Get collection statistics
    const { data: collectionStats, error: statsError } = await supabase
      .from('nfts')
      .select('collection_name, current_elo, total_votes')
      .not('collection_name', 'is', null);

    if (statsError) {
      throw new Error(`Failed to load collection stats: ${statsError.message}`);
    }

    // Calculate collection metrics
    const collectionMetrics = new Map<string, {
      nft_count: number;
      avg_votes: number;
      total_votes: number;
    }>();

    for (const nft of collectionStats || []) {
      const collection = nft.collection_name;
      if (!collectionMetrics.has(collection)) {
        collectionMetrics.set(collection, { nft_count: 0, avg_votes: 0, total_votes: 0 });
      }
      
      const metrics = collectionMetrics.get(collection)!;
      metrics.nft_count++;
      metrics.total_votes += nft.total_votes || 0;
    }

    // Calculate averages and create collection status
    for (const [collection, metrics] of collectionMetrics.entries()) {
      metrics.avg_votes = metrics.total_votes / metrics.nft_count;
      
      this.collectionStatus.set(collection, {
        name: collection,
        active: true, // Default to active
        priority: 1.0, // Default priority
        nft_count: metrics.nft_count,
        avg_votes_per_nft: metrics.avg_votes,
        last_selected: null
      });
    }

    // Try to load saved collection preferences
    try {
      const { data: savedStatuses } = await supabase
        .from('collection_management')
        .select('*');

      if (savedStatuses) {
        for (const saved of savedStatuses) {
          if (this.collectionStatus.has(saved.collection_name)) {
            const status = this.collectionStatus.get(saved.collection_name)!;
            status.active = saved.active;
            status.priority = saved.priority;
            status.last_selected = saved.last_selected ? new Date(saved.last_selected) : null;
          }
        }
      }
    } catch (error) {
      console.log('📝 No saved collection preferences found, using defaults');
    }
  }

  // 🎯 Generate optimal matchup using information theory
  async generateOptimalMatchup(
    collectionFilter?: string,
    forceType?: 'same_coll' | 'cross_coll' | 'slider'
  ): Promise<VotingSession | null> {
    try {
      console.log('🧠 Generating optimal matchup with enhanced algorithms...');
      
      // Get eligible NFTs with enhanced metrics
      const eligibleNFTs = await this.getEligibleNFTsWithMetrics(collectionFilter);
      
      if (eligibleNFTs.length < 2) {
        console.log('❌ Not enough eligible NFTs for matchup generation');
        return null;
      }

      // Decide vote type if not forced
      const voteType = forceType || await this.decideOptimalVoteType(eligibleNFTs);
      
      if (voteType === 'slider') {
        return await this.generateOptimalSliderSession(eligibleNFTs);
      }

      // Generate matchup candidates
      const candidates = await this.generateMatchupCandidates(eligibleNFTs, voteType);
      
      if (candidates.length === 0) {
        console.log('❌ No valid matchup candidates found');
        return null;
      }

      // Select best candidate based on information score
      const bestCandidate = this.selectBestCandidate(candidates);
      
      console.log(`✅ Selected optimal ${bestCandidate.matchup_type} matchup:`);
      console.log(`   Reason: ${bestCandidate.selection_reason}`);
      console.log(`   Information Score: ${bestCandidate.information_score.toFixed(3)}`);
      console.log(`   NFT1: ${bestCandidate.nft1.name} (Elo: ${bestCandidate.nft1.current_elo}, Uncertainty: ${bestCandidate.nft1.uncertainty.toFixed(1)})`);
      console.log(`   NFT2: ${bestCandidate.nft2.name} (Elo: ${bestCandidate.nft2.current_elo}, Uncertainty: ${bestCandidate.nft2.uncertainty.toFixed(1)})`);

      // Track this pair to avoid immediate repeats
      this.trackRecentPair(bestCandidate.nft1.id, bestCandidate.nft2.id);
      
      // Update collection last_selected timestamps
      await this.updateCollectionLastSelected([bestCandidate.nft1.collection_name, bestCandidate.nft2.collection_name]);

      return {
        nft1: bestCandidate.nft1,
        nft2: bestCandidate.nft2,
        vote_type: bestCandidate.matchup_type
      };

    } catch (error) {
      console.error('❌ Error generating optimal matchup:', error);
      return null;
    }
  }

  // 📊 Get NFTs with enhanced metrics for information theory
  private async getEligibleNFTsWithMetrics(collectionFilter?: string): Promise<NFTWithMetrics[]> {
    let query = supabase
      .from('nfts')
      .select(`
        id, name, image, token_id, contract_address, collection_name, 
        current_elo, total_votes, wins, losses, slider_average, slider_count
      `)
      .not('image', 'ilike', '%.mp4%')
      .not('image', 'ilike', '%.mov%')
      .not('image', 'ilike', '%.avi%')
      .not('image', 'ilike', '%.webm%')
      .not('image', 'ilike', '%.mkv%')
      // 🚫 Collection-specific unrevealed filtering (researched patterns)
      .not('traits', 'cs', '[{"trait_type": "Reveal", "value": "Unrevealed"}]')  // General unrevealed
      .not('traits', 'cs', '[{"trait_type": "reveal", "value": "unrevealed"}]')  // Case variations
      .not('traits', 'cs', '[{"trait_type": "Status", "value": "Unrevealed"}]')  // Alternative trait names
      .not('traits', 'cs', '[{"trait_type": "status", "value": "unrevealed"}]')  // Case variations
      .not('traits', 'cs', '[{"trait_type": "Status", "value": "Hidden"}]')     // Kabu collection unrevealed
      .not('traits', 'cs', '[{"trait_type": "status", "value": "hidden"}]')     // Case variations
      .not('traits', 'cs', '[{"trait_type": "Stage", "value": "Pre-reveal"}]')  // BEARISH collection unrevealed
      .not('traits', 'cs', '[{"trait_type": "stage", "value": "pre-reveal"}]')  // Case variations
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Regular"}]')      // BEEISH collection unrevealed
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Robot"}]')        // BEEISH collection unrevealed
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Zombee"}]')       // BEEISH collection unrevealed
      .not('traits', 'cs', '[{"trait_type": "Hive", "value": "Present"}]')      // BEEISH collection unrevealed
      .not('traits', 'cs', '[{"trait_type": "hive", "value": "regular"}]')      // Case variations
      .not('traits', 'cs', '[{"trait_type": "hive", "value": "robot"}]')        // Case variations
      .not('traits', 'cs', '[{"trait_type": "hive", "value": "zombee"}]')       // Case variations
      .not('traits', 'cs', '[{"trait_type": "hive", "value": "present"}]');     // Case variations

    // Apply collection filter
    if (collectionFilter) {
      query = query.eq('collection_name', collectionFilter);
    } else {
      // Only include active collections
      const activeCollections = Array.from(this.collectionStatus.values())
        .filter(status => status.active)
        .map(status => status.name);
      
      if (activeCollections.length === 0) {
        console.log('⚠️ No active collections found, enabling all collections');
        await this.setAllCollectionsActive(true);
        return this.getEligibleNFTsWithMetrics(collectionFilter);
      }
      
      query = query.in('collection_name', activeCollections);
    }

    const { data: nfts, error } = await query
      .order('id', { ascending: false })  // 🎲 Ensure diverse collection sampling
      .limit(2000);

    if (error) {
      throw new Error(`Failed to fetch eligible NFTs: ${error.message}`);
    }

    if (!nfts || nfts.length === 0) {
      return [];
    }

    // Calculate collection representation metrics
    const collectionCounts = new Map<string, number>();
    for (const nft of nfts) {
      collectionCounts.set(nft.collection_name, (collectionCounts.get(nft.collection_name) || 0) + 1);
    }

    // Enhance NFTs with information theory metrics
    return nfts.map(nft => {
      const uncertainty = this.calculateUncertainty(nft.total_votes || 0);
      const information_potential = this.calculateInformationPotential(nft, uncertainty);
      const vote_deficit = this.calculateVoteDeficit(nft, nfts);
      const collection_representation = this.calculateCollectionRepresentation(
        nft.collection_name, 
        collectionCounts.get(nft.collection_name) || 1
      );

      return {
        ...nft,
        collection_address: nft.contract_address,
        token_address: nft.contract_address,
        uncertainty,
        information_potential,
        vote_deficit,
        collection_representation
      } as NFTWithMetrics;
    });
  }

  // 🎲 Calculate uncertainty using TrueSkill-inspired formula
  private calculateUncertainty(totalVotes: number): number {
    if (totalVotes === 0) return DEFAULT_UNCERTAINTY;
    
    // Uncertainty decreases exponentially with vote count
    const uncertainty = DEFAULT_UNCERTAINTY * Math.pow(UNCERTAINTY_DECAY_RATE, totalVotes);
    return Math.max(MIN_UNCERTAINTY, uncertainty);
  }

  // 📈 Calculate information potential of an NFT
  private calculateInformationPotential(nft: any, uncertainty: number): number {
    // Higher uncertainty = more information potential
    const uncertaintyScore = uncertainty / DEFAULT_UNCERTAINTY;
    
    // NFTs with few votes have high learning potential
    const voteScarcityScore = Math.max(0, 1 - (nft.total_votes || 0) / 50);
    
    // Balanced win/loss ratio indicates uncertain true skill
    const winRate = nft.total_votes > 0 ? (nft.wins || 0) / nft.total_votes : 0.5;
    const balanceScore = 1 - Math.abs(winRate - 0.5) * 2; // 1.0 for 50% win rate, 0.0 for 0% or 100%
    
    return (uncertaintyScore * 0.5) + (voteScarcityScore * 0.3) + (balanceScore * 0.2);
  }

  // 📊 Calculate vote deficit (how underrepresented an NFT is)
  private calculateVoteDeficit(nft: any, allNFTs: any[]): number {
    const avgVotes = allNFTs.reduce((sum, n) => sum + (n.total_votes || 0), 0) / allNFTs.length;
    const nftVotes = nft.total_votes || 0;
    
    // Higher deficit for NFTs with fewer votes than average
    return Math.max(0, (avgVotes - nftVotes) / Math.max(1, avgVotes));
  }

  // 🌈 Calculate collection representation score
  private calculateCollectionRepresentation(collectionName: string, collectionSize: number): number {
    const status = this.collectionStatus.get(collectionName);
    if (!status) return 0.5;
    
    // Factor in collection priority and how recently it was selected
    let score = status.priority;
    
    // Boost collections that haven't been selected recently
    if (status.last_selected) {
      const hoursSinceSelected = (Date.now() - status.last_selected.getTime()) / (1000 * 60 * 60);
      score *= 1 + Math.min(1, hoursSinceSelected / 24); // Up to 2x boost after 24 hours
    } else {
      score *= 1.5; // Boost collections that have never been selected
    }
    
    return Math.min(2.0, score);
  }

  // 🎯 Decide optimal vote type based on current dataset needs
  private async decideOptimalVoteType(eligibleNFTs: NFTWithMetrics[]): Promise<'slider' | 'same_coll' | 'cross_coll'> {
    // Count NFTs needing slider votes (cold start)
    const needingSliderVotes = eligibleNFTs.filter(nft => (nft.slider_count || 0) < 3);
    
    // If many NFTs need slider votes, prioritize that
    if (needingSliderVotes.length > 50) {
      console.log(`🎚️ ${needingSliderVotes.length} NFTs need slider votes, prioritizing slider`);
      return 'slider';
    }

    // Calculate average uncertainty across collections
    const collectionUncertainties = new Map<string, number[]>();
    for (const nft of eligibleNFTs) {
      if (!collectionUncertainties.has(nft.collection_name)) {
        collectionUncertainties.set(nft.collection_name, []);
      }
      collectionUncertainties.get(nft.collection_name)!.push(nft.uncertainty);
    }

    // Check if cross-collection comparisons would be more informative
    const collections = Array.from(collectionUncertainties.keys());
    if (collections.length >= 2) {
      const avgUncertainties = collections.map(collection => {
        const uncertainties = collectionUncertainties.get(collection) || [];
        return uncertainties.reduce((sum, u) => sum + u, 0) / uncertainties.length;
      });
      
      const maxUncertainty = Math.max(...avgUncertainties);
      const minUncertainty = Math.min(...avgUncertainties);
      
      // If there's high variance in collection uncertainties, cross-collection matchups are more informative
      if (maxUncertainty - minUncertainty > 30) {
        console.log('🔀 High uncertainty variance between collections, prioritizing cross-collection');
        return 'cross_coll';
      }
    }

    // Default distribution with information theory bias
    const random = Math.random();
    if (random < 0.15 && needingSliderVotes.length > 0) {
      return 'slider';
    } else if (random < 0.65) {
      return 'same_coll';
    } else {
      return 'cross_coll';
    }
  }

  // 🎚️ Generate optimal slider session
  private async generateOptimalSliderSession(eligibleNFTs: NFTWithMetrics[]): Promise<VotingSession | null> {
    // Prioritize NFTs with high information potential and low slider count
    const sliderCandidates = eligibleNFTs
      .filter(nft => (nft.slider_count || 0) < 10) // Focus on NFTs needing slider votes
      .sort((a, b) => {
        // Sort by combination of information potential and slider need
        const scoreA = a.information_potential + (1 - (a.slider_count || 0) / 10) * 0.5;
        const scoreB = b.information_potential + (1 - (b.slider_count || 0) / 10) * 0.5;
        return scoreB - scoreA;
      });

    if (sliderCandidates.length === 0) {
      return null;
    }

    const selectedNFT = sliderCandidates[0];
    console.log(`🎚️ Selected slider NFT: ${selectedNFT.name} (Info Potential: ${selectedNFT.information_potential.toFixed(3)})`);

    return {
      nft: selectedNFT,
      vote_type: 'slider'
    };
  }

  // 🥊 Generate matchup candidates with information scores
  private async generateMatchupCandidates(
    eligibleNFTs: NFTWithMetrics[], 
    voteType: 'same_coll' | 'cross_coll'
  ): Promise<MatchupCandidate[]> {
    const candidates: MatchupCandidate[] = [];
    
    // Filter NFTs based on vote type
    let nftPool: NFTWithMetrics[];
    if (voteType === 'same_coll') {
      // Group by collection and find pairs within each collection
      const collectionGroups = new Map<string, NFTWithMetrics[]>();
      for (const nft of eligibleNFTs) {
        if (!collectionGroups.has(nft.collection_name)) {
          collectionGroups.set(nft.collection_name, []);
        }
        collectionGroups.get(nft.collection_name)!.push(nft);
      }
      
      nftPool = [];
      for (const [_, nfts] of collectionGroups.entries()) {
        if (nfts.length >= 2) {
          nftPool.push(...nfts);
        }
      }
    } else {
      nftPool = eligibleNFTs;
    }

    if (nftPool.length < 2) {
      return candidates;
    }

    // Generate top candidates (limit to prevent performance issues)
    const maxCandidates = Math.min(100, Math.floor(nftPool.length * nftPool.length * 0.1));
    let candidateCount = 0;

    for (let i = 0; i < nftPool.length && candidateCount < maxCandidates; i++) {
      for (let j = i + 1; j < nftPool.length && candidateCount < maxCandidates; j++) {
        const nft1 = nftPool[i];
        const nft2 = nftPool[j];

        // Skip if same NFT
        if (nft1.id === nft2.id) continue;

        // Check collection requirements
        const sameCollection = nft1.collection_name === nft2.collection_name;
        if (voteType === 'same_coll' && !sameCollection) continue;
        if (voteType === 'cross_coll' && sameCollection) continue;

        // Skip recent pairs
        if (this.isRecentPair(nft1.id, nft2.id)) continue;

        // Calculate information score
        const informationScore = this.calculateMatchupInformationScore(nft1, nft2);
        const selectionReason = this.generateSelectionReason(nft1, nft2, informationScore);

        candidates.push({
          nft1,
          nft2,
          information_score: informationScore,
          matchup_type: voteType,
          selection_reason: selectionReason
        });

        candidateCount++;
      }
    }

    // Sort by information score (highest first)
    return candidates.sort((a, b) => b.information_score - a.information_score);
  }

  // 🧮 Calculate information score for a matchup pair
  private calculateMatchupInformationScore(nft1: NFTWithMetrics, nft2: NFTWithMetrics): number {
    // 1. Uncertainty factor: Higher uncertainty = more information gain potential
    const uncertaintyScore = (nft1.uncertainty + nft2.uncertainty) / (2 * DEFAULT_UNCERTAINTY);
    
    // 2. Elo proximity factor: Closer Elo ratings = more informative matchups
    const eloDiff = Math.abs(nft1.current_elo - nft2.current_elo);
    const maxExpectedEloDiff = 400; // Reasonable max difference for informative matchups
    const proximityScore = Math.max(0, 1 - eloDiff / maxExpectedEloDiff);
    
    // 3. Vote deficit factor: Prioritize underrepresented NFTs
    const voteDeficitScore = (nft1.vote_deficit + nft2.vote_deficit) / 2;
    
    // 4. Collection diversity factor
    const diversityScore = (nft1.collection_representation + nft2.collection_representation) / 2;
    
    // Weighted combination
    const totalScore = 
      (uncertaintyScore * UNCERTAINTY_WEIGHT) +
      (proximityScore * ELO_PROXIMITY_WEIGHT) +
      (voteDeficitScore * VOTE_COUNT_WEIGHT) +
      (diversityScore * COLLECTION_DIVERSITY_WEIGHT);
    
    return totalScore;
  }

  // 📝 Generate human-readable selection reason
  private generateSelectionReason(nft1: NFTWithMetrics, nft2: NFTWithMetrics, score: number): string {
    const reasons: string[] = [];
    
    if (nft1.uncertainty > 75 || nft2.uncertainty > 75) {
      reasons.push('High uncertainty - maximum learning potential');
    }
    
    const eloDiff = Math.abs(nft1.current_elo - nft2.current_elo);
    if (eloDiff < 100) {
      reasons.push('Close Elo ratings - competitive matchup');
    }
    
    const avgVoteDeficit = (nft1.vote_deficit + nft2.vote_deficit) / 2;
    if (avgVoteDeficit > 0.3) {
      reasons.push('Underrepresented NFTs - balancing dataset');
    }
    
    if (nft1.collection_name !== nft2.collection_name) {
      reasons.push('Cross-collection comparison - diverse perspective');
    }
    
    if (reasons.length === 0) {
      reasons.push('Optimal information score');
    }
    
    return reasons.join(', ');
  }

  // 🏆 Select best candidate from sorted list
  private selectBestCandidate(candidates: MatchupCandidate[]): MatchupCandidate {
    // Use weighted random selection from top candidates to add variety
    const topCandidates = candidates.slice(0, Math.min(5, candidates.length));
    const weights = topCandidates.map((_, index) => Math.pow(0.7, index)); // Exponential decay
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (let i = 0; i < topCandidates.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return topCandidates[i];
      }
    }
    
    return topCandidates[0]; // Fallback to best candidate
  }

  // 📝 Track recent pairs to avoid immediate repeats
  private trackRecentPair(nft1Id: string, nft2Id: string): void {
    const pairKey = [nft1Id, nft2Id].sort().join('|');
    this.recentPairs.add(pairKey);
    
    // Limit memory usage
    if (this.recentPairs.size > this.MAX_RECENT_PAIRS) {
      // Remove oldest entries (approximate)
      const keysToRemove = Array.from(this.recentPairs).slice(0, 100);
      keysToRemove.forEach(key => this.recentPairs.delete(key));
    }
  }

  // 🔍 Check if pair was recently used
  private isRecentPair(nft1Id: string, nft2Id: string): boolean {
    const pairKey = [nft1Id, nft2Id].sort().join('|');
    return this.recentPairs.has(pairKey);
  }

  // ⏰ Update collection last selected timestamp
  private async updateCollectionLastSelected(collections: string[]): Promise<void> {
    const now = new Date();
    
    for (const collection of collections) {
      if (this.collectionStatus.has(collection)) {
        this.collectionStatus.get(collection)!.last_selected = now;
      }
    }
    
    // Save to database
    try {
      for (const collection of collections) {
        await supabase
          .from('collection_management')
          .upsert({
            collection_name: collection,
            last_selected: now.toISOString()
          }, { 
            onConflict: 'collection_name' 
          });
      }
    } catch (error) {
      console.warn('⚠️ Failed to update collection timestamps:', error);
    }
  }

  // 🎛️ Collection Management API
  
  async setCollectionActive(collectionName: string, active: boolean): Promise<boolean> {
    try {
      if (!this.collectionStatus.has(collectionName)) {
        console.log(`❌ Collection ${collectionName} not found`);
        return false;
      }
      
      this.collectionStatus.get(collectionName)!.active = active;
      
      // Save to database
      await supabase
        .from('collection_management')
        .upsert({
          collection_name: collectionName,
          active: active
        }, { 
          onConflict: 'collection_name' 
        });
      
      console.log(`✅ Collection ${collectionName} ${active ? 'activated' : 'deactivated'}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update collection ${collectionName}:`, error);
      return false;
    }
  }

  async setCollectionPriority(collectionName: string, priority: number): Promise<boolean> {
    try {
      if (!this.collectionStatus.has(collectionName)) {
        console.log(`❌ Collection ${collectionName} not found`);
        return false;
      }
      
      // Clamp priority between 0.1 and 3.0
      const clampedPriority = Math.max(0.1, Math.min(3.0, priority));
      this.collectionStatus.get(collectionName)!.priority = clampedPriority;
      
      // Save to database
      await supabase
        .from('collection_management')
        .upsert({
          collection_name: collectionName,
          priority: clampedPriority
        }, { 
          onConflict: 'collection_name' 
        });
      
      console.log(`✅ Collection ${collectionName} priority set to ${clampedPriority}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update collection ${collectionName} priority:`, error);
      return false;
    }
  }

  async setAllCollectionsActive(active: boolean): Promise<void> {
    const promises = Array.from(this.collectionStatus.keys()).map(collection =>
      this.setCollectionActive(collection, active)
    );
    
    await Promise.all(promises);
    console.log(`✅ All collections ${active ? 'activated' : 'deactivated'}`);
  }

  getCollectionStatuses(): CollectionStatus[] {
    return Array.from(this.collectionStatus.values());
  }

  getActiveCollections(): string[] {
    return Array.from(this.collectionStatus.values())
      .filter(status => status.active)
      .map(status => status.name);
  }

  // 📊 Get system statistics
  getSystemStats(): any {
    const collections = Array.from(this.collectionStatus.values());
    const activeCollections = collections.filter(c => c.active);
    
    return {
      total_collections: collections.length,
      active_collections: activeCollections.length,
      recent_pairs_tracked: this.recentPairs.size,
      avg_collection_priority: activeCollections.reduce((sum, c) => sum + c.priority, 0) / Math.max(1, activeCollections.length),
      collections: collections.map(c => ({
        name: c.name,
        active: c.active,
        priority: c.priority,
        nft_count: c.nft_count,
        avg_votes_per_nft: Math.round(c.avg_votes_per_nft * 10) / 10,
        hours_since_selected: c.last_selected 
          ? Math.round((Date.now() - c.last_selected.getTime()) / (1000 * 60 * 60) * 10) / 10
          : null
      }))
    };
  }
}

// Export singleton instance
export const enhancedMatchupEngine = EnhancedMatchupEngine.getInstance();
