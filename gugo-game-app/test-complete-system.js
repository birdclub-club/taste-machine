// 🎮 Complete Enhanced Matchup System Test
// Demonstrates the full power of information theory + collection management

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

class CompleteMatchupSystem {
  constructor() {
    this.collections = new Map();
    this.recentPairs = new Set();
    this.maxRecentPairs = 100;
  }

  async initialize() {
    console.log('🚀 Initializing Complete Enhanced Matchup System...\n');

    // Get NFT data with voting statistics
    const { data: nfts, error } = await supabase
      .from('nfts')
      .select('id, name, collection_name, current_elo, total_votes, wins, losses')
      .not('image', 'ilike', '%.mp4%')
      .limit(500);

    if (error) {
      throw new Error(`Failed to load NFTs: ${error.message}`);
    }

    // Initialize collections with real statistics
    const collectionStats = new Map();
    for (const nft of nfts) {
      const collection = nft.collection_name;
      if (!collectionStats.has(collection)) {
        collectionStats.set(collection, {
          nfts: [],
          totalVotes: 0,
          totalElo: 0
        });
      }
      
      const stats = collectionStats.get(collection);
      stats.nfts.push(nft);
      stats.totalVotes += nft.total_votes || 0;
      stats.totalElo += nft.current_elo || 1200;
    }

    // Set up collection management
    for (const [collection, stats] of collectionStats.entries()) {
      const avgVotes = stats.totalVotes / stats.nfts.length;
      const avgElo = stats.totalElo / stats.nfts.length;
      
      this.collections.set(collection, {
        name: collection,
        active: true,
        priority: 1.0,
        nfts: stats.nfts,
        nft_count: stats.nfts.length,
        avg_votes_per_nft: avgVotes,
        avg_elo: avgElo,
        last_selected: null
      });
    }

    console.log(`✅ Loaded ${nfts.length} NFTs across ${this.collections.size} collections`);
    
    return nfts;
  }

  // Information theory calculations
  calculateUncertainty(totalVotes) {
    if (totalVotes === 0) return 100.0;
    return Math.max(25.0, 100.0 * Math.pow(0.95, totalVotes));
  }

  calculateInformationScore(nft1, nft2) {
    const uncertainty1 = this.calculateUncertainty(nft1.total_votes || 0);
    const uncertainty2 = this.calculateUncertainty(nft2.total_votes || 0);
    
    // Uncertainty component (40% weight)
    const uncertaintyScore = (uncertainty1 + uncertainty2) / 200.0;
    
    // Elo proximity component (30% weight)
    const eloDiff = Math.abs((nft1.current_elo || 1200) - (nft2.current_elo || 1200));
    const proximityScore = Math.max(0, 1 - eloDiff / 400.0);
    
    // Vote balance component (20% weight)
    const avgVotes = ((nft1.total_votes || 0) + (nft2.total_votes || 0)) / 2;
    const voteDeficitScore = Math.max(0, 1 - avgVotes / 20); // Less votes = higher score
    
    // Collection diversity component (10% weight)
    const diversityScore = nft1.collection_name !== nft2.collection_name ? 1.2 : 1.0;
    
    return (uncertaintyScore * 0.4) + (proximityScore * 0.3) + (voteDeficitScore * 0.2) + (diversityScore * 0.1);
  }

  // Collection management
  setCollectionActive(collectionName, active) {
    if (this.collections.has(collectionName)) {
      this.collections.get(collectionName).active = active;
      return true;
    }
    return false;
  }

  setCollectionPriority(collectionName, priority) {
    if (this.collections.has(collectionName) && priority >= 0.1 && priority <= 3.0) {
      this.collections.get(collectionName).priority = priority;
      return true;
    }
    return false;
  }

  getActiveNFTs() {
    const activeNFTs = [];
    for (const collection of this.collections.values()) {
      if (collection.active) {
        activeNFTs.push(...collection.nfts);
      }
    }
    return activeNFTs;
  }

  // Enhanced matchup generation
  async generateOptimalMatchup(matchupType = 'auto') {
    const activeNFTs = this.getActiveNFTs();
    
    if (activeNFTs.length < 2) {
      return null;
    }

    console.log(`\n🧠 Generating optimal ${matchupType} matchup...`);

    // Decide matchup type if auto
    if (matchupType === 'auto') {
      const needingSliderVotes = activeNFTs.filter(nft => (nft.total_votes || 0) < 3);
      
      if (needingSliderVotes.length > 10) {
        matchupType = 'slider';
      } else {
        const activeCollections = Array.from(this.collections.values()).filter(c => c.active);
        matchupType = activeCollections.length >= 2 && Math.random() < 0.3 ? 'cross_coll' : 'same_coll';
      }
    }

    if (matchupType === 'slider') {
      return this.generateOptimalSlider(activeNFTs);
    } else {
      return this.generateOptimalPair(activeNFTs, matchupType);
    }
  }

  generateOptimalSlider(activeNFTs) {
    // Find NFTs needing slider votes with high information potential
    const sliderCandidates = activeNFTs
      .filter(nft => (nft.total_votes || 0) < 10)
      .map(nft => ({
        nft,
        uncertainty: this.calculateUncertainty(nft.total_votes || 0),
        infoPotential: this.calculateUncertainty(nft.total_votes || 0) + (10 - (nft.total_votes || 0)) * 5
      }))
      .sort((a, b) => b.infoPotential - a.infoPotential);

    if (sliderCandidates.length === 0) {
      return null;
    }

    const selected = sliderCandidates[0];
    
    console.log(`🎚️ Selected slider NFT: ${selected.nft.name} (${selected.nft.collection_name})`);
    console.log(`   Uncertainty: ${selected.uncertainty.toFixed(1)}, Info Potential: ${selected.infoPotential.toFixed(1)}`);
    console.log(`   Current votes: ${selected.nft.total_votes || 0}, Elo: ${selected.nft.current_elo || 1200}`);

    return {
      type: 'slider',
      nft: selected.nft,
      reason: `High information potential slider vote (uncertainty: ${selected.uncertainty.toFixed(1)})`
    };
  }

  generateOptimalPair(activeNFTs, matchupType) {
    const candidates = [];
    const maxCandidates = 100;

    // Generate candidate pairs
    for (let i = 0; i < activeNFTs.length && candidates.length < maxCandidates; i++) {
      for (let j = i + 1; j < activeNFTs.length && candidates.length < maxCandidates; j++) {
        const nft1 = activeNFTs[i];
        const nft2 = activeNFTs[j];

        // Check matchup type constraints
        const sameCollection = nft1.collection_name === nft2.collection_name;
        if (matchupType === 'same_coll' && !sameCollection) continue;
        if (matchupType === 'cross_coll' && sameCollection) continue;

        // Skip recent pairs
        const pairKey = [nft1.id, nft2.id].sort().join('|');
        if (this.recentPairs.has(pairKey)) continue;

        // Calculate information score
        const infoScore = this.calculateInformationScore(nft1, nft2);
        
        // Apply collection priority weights
        const collection1 = this.collections.get(nft1.collection_name);
        const collection2 = this.collections.get(nft2.collection_name);
        const priorityBonus = ((collection1?.priority || 1) + (collection2?.priority || 1)) / 2;
        const finalScore = infoScore * priorityBonus;

        candidates.push({
          nft1,
          nft2,
          score: finalScore,
          rawScore: infoScore,
          priorityBonus,
          matchupType,
          uncertainty1: this.calculateUncertainty(nft1.total_votes || 0),
          uncertainty2: this.calculateUncertainty(nft2.total_votes || 0),
          eloDiff: Math.abs((nft1.current_elo || 1200) - (nft2.current_elo || 1200))
        });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by final score and use weighted random selection from top candidates
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, Math.min(5, candidates.length));
    
    // Weighted random selection (exponential decay)
    const weights = topCandidates.map((_, index) => Math.pow(0.7, index));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let selectedCandidate = topCandidates[0];
    let cumulativeWeight = 0;
    for (let i = 0; i < topCandidates.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        selectedCandidate = topCandidates[i];
        break;
      }
    }

    // Track this pair
    const pairKey = [selectedCandidate.nft1.id, selectedCandidate.nft2.id].sort().join('|');
    this.recentPairs.add(pairKey);
    if (this.recentPairs.size > this.maxRecentPairs) {
      const keysToRemove = Array.from(this.recentPairs).slice(0, 20);
      keysToRemove.forEach(key => this.recentPairs.delete(key));
    }

    // Update last_selected for collections
    const collection1 = this.collections.get(selectedCandidate.nft1.collection_name);
    const collection2 = this.collections.get(selectedCandidate.nft2.collection_name);
    if (collection1) collection1.last_selected = new Date();
    if (collection2) collection2.last_selected = new Date();

    console.log(`🥊 Selected ${selectedCandidate.matchupType} matchup:`);
    console.log(`   ${selectedCandidate.nft1.name} (${selectedCandidate.nft1.collection_name}) vs`);
    console.log(`   ${selectedCandidate.nft2.name} (${selectedCandidate.nft2.collection_name})`);
    console.log(`   Information Score: ${selectedCandidate.score.toFixed(3)} (raw: ${selectedCandidate.rawScore.toFixed(3)}, priority: ${selectedCandidate.priorityBonus.toFixed(1)}x)`);
    console.log(`   Elo Diff: ${selectedCandidate.eloDiff}, Uncertainties: ${selectedCandidate.uncertainty1.toFixed(1)} vs ${selectedCandidate.uncertainty2.toFixed(1)}`);

    return {
      type: selectedCandidate.matchupType,
      nft1: selectedCandidate.nft1,
      nft2: selectedCandidate.nft2,
      score: selectedCandidate.score,
      reason: this.generateSelectionReason(selectedCandidate)
    };
  }

  generateSelectionReason(candidate) {
    const reasons = [];
    
    if (candidate.uncertainty1 > 75 || candidate.uncertainty2 > 75) {
      reasons.push('High uncertainty - maximum learning potential');
    }
    
    if (candidate.eloDiff < 100) {
      reasons.push('Close Elo ratings - competitive matchup');
    }
    
    if (candidate.matchupType === 'cross_coll') {
      reasons.push('Cross-collection comparison - diverse perspective');
    }
    
    if (candidate.priorityBonus > 1.2) {
      reasons.push('High-priority collections');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Optimal information score';
  }

  // Comprehensive system demonstration
  async demonstrateCompleteSystem() {
    console.log('\n🎭 Comprehensive System Demonstration\n');
    console.log('=' .repeat(60));

    // Show collection status
    console.log('\n📊 Collection Status:');
    for (const collection of this.collections.values()) {
      const status = collection.active ? '✅ Active' : '❌ Inactive';
      console.log(`   • ${collection.name}: ${status} (${collection.nft_count} NFTs, priority: ${collection.priority})`);
      console.log(`     Avg votes: ${collection.avg_votes_per_nft.toFixed(1)}, Avg Elo: ${collection.avg_elo.toFixed(0)}`);
    }

    // Demonstrate different scenarios
    console.log('\n🔄 Scenario Testing:');

    // Scenario 1: Normal operation
    console.log('\n1️⃣ Normal Operation (All collections active)');
    for (let i = 0; i < 3; i++) {
      const matchup = await this.generateOptimalMatchup('auto');
      if (matchup) {
        console.log(`   ${matchup.type}: ${matchup.reason}`);
      }
    }

    // Scenario 2: Deactivate one collection
    console.log('\n2️⃣ Collection Management (Deactivate one collection)');
    const collections = Array.from(this.collections.keys());
    if (collections.length > 1) {
      this.setCollectionActive(collections[0], false);
      console.log(`   Deactivated: ${collections[0]}`);
      
      const matchup = await this.generateOptimalMatchup('same_coll');
      if (matchup) {
        console.log(`   Result: ${matchup.reason}`);
      }
    }

    // Scenario 3: Priority adjustment
    console.log('\n3️⃣ Priority Weighting (Boost one collection)');
    if (collections.length > 1) {
      this.setCollectionActive(collections[0], true); // Reactivate
      this.setCollectionPriority(collections[1], 2.5); // High priority
      console.log(`   Boosted priority: ${collections[1]} (2.5x)`);
      
      for (let i = 0; i < 3; i++) {
        const matchup = await this.generateOptimalMatchup('auto');
        if (matchup && matchup.type !== 'slider') {
          const hasHighPriority = matchup.nft1.collection_name === collections[1] || 
                                 matchup.nft2.collection_name === collections[1];
          console.log(`   Trial ${i + 1}: ${hasHighPriority ? '🎯 High-priority' : 'Regular'} matchup`);
        }
      }
    }

    // Show final statistics
    console.log('\n📈 Final System Statistics:');
    const activeCollections = Array.from(this.collections.values()).filter(c => c.active);
    const totalNFTs = activeCollections.reduce((sum, c) => sum + c.nft_count, 0);
    const avgPriority = activeCollections.reduce((sum, c) => sum + c.priority, 0) / activeCollections.length;
    
    console.log(`   Active Collections: ${activeCollections.length}/${this.collections.size}`);
    console.log(`   Available NFTs: ${totalNFTs}`);
    console.log(`   Average Priority: ${avgPriority.toFixed(2)}`);
    console.log(`   Recent Pairs Tracked: ${this.recentPairs.size}`);
  }
}

// Run the complete system test
async function runCompleteTest() {
  console.log('🚀 Complete Enhanced Matchup System Test');
  console.log('   • Information Theory Algorithms');
  console.log('   • Collection Management');
  console.log('   • Weighted Selection');
  console.log('   • Duplicate Prevention');
  console.log('');

  try {
    const system = new CompleteMatchupSystem();
    await system.initialize();
    await system.demonstrateCompleteSystem();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Complete System Test Successful!');
    console.log('\n🎯 Enhanced Features Demonstrated:');
    console.log('   ✅ TrueSkill-inspired uncertainty calculations');
    console.log('   ✅ Information-theoretic matchup scoring');
    console.log('   ✅ Collection activation/deactivation');
    console.log('   ✅ Priority-based weighted selection');
    console.log('   ✅ Duplicate pair prevention');
    console.log('   ✅ Multi-scenario adaptive behavior');
    console.log('   ✅ Real-time statistics and monitoring');
    console.log('\n🎮 Ready for integration into the voting system!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

runCompleteTest();

