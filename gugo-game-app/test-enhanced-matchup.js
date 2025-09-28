// 🧪 Test Enhanced Matchup Engine
// Direct testing of the enhanced algorithms

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Simple in-memory implementation of enhanced algorithms for testing
class TestEnhancedMatchup {
  constructor() {
    this.collections = new Map();
  }

  // Calculate uncertainty using TrueSkill-inspired formula
  calculateUncertainty(totalVotes) {
    if (totalVotes === 0) return 100.0;
    const uncertainty = 100.0 * Math.pow(0.95, totalVotes);
    return Math.max(25.0, uncertainty);
  }

  // Calculate information potential
  calculateInformationPotential(nft, uncertainty) {
    const uncertaintyScore = uncertainty / 100.0;
    const voteScarcityScore = Math.max(0, 1 - (nft.total_votes || 0) / 50);
    const winRate = nft.total_votes > 0 ? (nft.wins || 0) / nft.total_votes : 0.5;
    const balanceScore = 1 - Math.abs(winRate - 0.5) * 2;
    
    return (uncertaintyScore * 0.5) + (voteScarcityScore * 0.3) + (balanceScore * 0.2);
  }

  // Calculate matchup information score
  calculateMatchupScore(nft1, nft2) {
    const uncertainty1 = this.calculateUncertainty(nft1.total_votes || 0);
    const uncertainty2 = this.calculateUncertainty(nft2.total_votes || 0);
    
    // Uncertainty factor
    const uncertaintyScore = (uncertainty1 + uncertainty2) / 200.0;
    
    // Elo proximity factor
    const eloDiff = Math.abs((nft1.current_elo || 1200) - (nft2.current_elo || 1200));
    const proximityScore = Math.max(0, 1 - eloDiff / 400.0);
    
    // Combine with weights
    return (uncertaintyScore * 0.4) + (proximityScore * 0.3) + 0.3; // Base score
  }

  async analyzeCurrentDataset() {
    console.log('🔍 Analyzing current NFT dataset for enhanced matchup opportunities...\n');

    try {
      // Get NFT data with statistics
      const { data: nfts, error } = await supabase
        .from('nfts')
        .select('id, name, collection_name, current_elo, total_votes, wins, losses')
        .not('image', 'ilike', '%.mp4%')
        .not('image', 'ilike', '%.mov%')
        .limit(100);

      if (error) {
        console.error('❌ Error fetching NFTs:', error);
        return;
      }

      console.log(`📊 Dataset Summary:`);
      console.log(`   Total NFTs analyzed: ${nfts.length}`);

      // Group by collection
      const collectionGroups = new Map();
      for (const nft of nfts) {
        if (!collectionGroups.has(nft.collection_name)) {
          collectionGroups.set(nft.collection_name, []);
        }
        collectionGroups.get(nft.collection_name).push(nft);
      }

      console.log(`   Collections found: ${collectionGroups.size}`);
      
      // Analyze each collection
      for (const [collection, collectionNFTs] of collectionGroups.entries()) {
        const avgVotes = collectionNFTs.reduce((sum, nft) => sum + (nft.total_votes || 0), 0) / collectionNFTs.length;
        const avgElo = collectionNFTs.reduce((sum, nft) => sum + (nft.current_elo || 1200), 0) / collectionNFTs.length;
        
        console.log(`\n   📁 ${collection}:`);
        console.log(`      NFTs: ${collectionNFTs.length}`);
        console.log(`      Avg Votes: ${avgVotes.toFixed(1)}`);
        console.log(`      Avg Elo: ${avgElo.toFixed(0)}`);
      }

      // Find best same-collection matchups
      console.log(`\n🥊 Top Same-Collection Matchup Opportunities:`);
      
      const sameCollCandidates = [];
      for (const [collection, collectionNFTs] of collectionGroups.entries()) {
        if (collectionNFTs.length >= 2) {
          for (let i = 0; i < collectionNFTs.length; i++) {
            for (let j = i + 1; j < collectionNFTs.length; j++) {
              const nft1 = collectionNFTs[i];
              const nft2 = collectionNFTs[j];
              const score = this.calculateMatchupScore(nft1, nft2);
              
              sameCollCandidates.push({
                nft1: nft1.name,
                nft2: nft2.name,
                collection,
                score: score.toFixed(3),
                eloDiff: Math.abs((nft1.current_elo || 1200) - (nft2.current_elo || 1200)),
                uncertainty1: this.calculateUncertainty(nft1.total_votes || 0).toFixed(1),
                uncertainty2: this.calculateUncertainty(nft2.total_votes || 0).toFixed(1)
              });
            }
          }
        }
      }

      // Sort by information score
      sameCollCandidates.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
      
      const top5SameColl = sameCollCandidates.slice(0, 5);
      top5SameColl.forEach((candidate, index) => {
        console.log(`   ${index + 1}. ${candidate.nft1} vs ${candidate.nft2} (${candidate.collection})`);
        console.log(`      Info Score: ${candidate.score}, Elo Diff: ${candidate.eloDiff}`);
        console.log(`      Uncertainties: ${candidate.uncertainty1} vs ${candidate.uncertainty2}`);
      });

      // Find best cross-collection matchups
      console.log(`\n🔀 Top Cross-Collection Matchup Opportunities:`);
      
      const crossCollCandidates = [];
      const allCollections = Array.from(collectionGroups.keys());
      
      for (let i = 0; i < allCollections.length; i++) {
        for (let j = i + 1; j < allCollections.length; j++) {
          const collection1NFTs = collectionGroups.get(allCollections[i]);
          const collection2NFTs = collectionGroups.get(allCollections[j]);
          
          // Pick representative NFTs from each collection
          const nft1 = collection1NFTs[0]; // Simplified - pick first
          const nft2 = collection2NFTs[0];
          
          const score = this.calculateMatchupScore(nft1, nft2) * 1.2; // Cross-collection bonus
          
          crossCollCandidates.push({
            nft1: nft1.name,
            nft2: nft2.name,
            collection1: allCollections[i],
            collection2: allCollections[j],
            score: score.toFixed(3),
            eloDiff: Math.abs((nft1.current_elo || 1200) - (nft2.current_elo || 1200)),
            uncertainty1: this.calculateUncertainty(nft1.total_votes || 0).toFixed(1),
            uncertainty2: this.calculateUncertainty(nft2.total_votes || 0).toFixed(1)
          });
        }
      }

      crossCollCandidates.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
      
      const top3CrossColl = crossCollCandidates.slice(0, 3);
      top3CrossColl.forEach((candidate, index) => {
        console.log(`   ${index + 1}. ${candidate.nft1} (${candidate.collection1}) vs ${candidate.nft2} (${candidate.collection2})`);
        console.log(`      Info Score: ${candidate.score}, Elo Diff: ${candidate.eloDiff}`);
        console.log(`      Uncertainties: ${candidate.uncertainty1} vs ${candidate.uncertainty2}`);
      });

      // Identify NFTs needing slider votes
      console.log(`\n🎚️ NFTs Needing Slider Votes (Cold Start):`);
      const needingSliderVotes = nfts.filter(nft => (nft.total_votes || 0) < 3);
      console.log(`   Found ${needingSliderVotes.length} NFTs with < 3 votes`);
      
      const top5SliderCandidates = needingSliderVotes
        .slice(0, 5)
        .map(nft => ({
          name: nft.name,
          collection: nft.collection_name,
          votes: nft.total_votes || 0,
          uncertainty: this.calculateUncertainty(nft.total_votes || 0).toFixed(1),
          infoPotential: this.calculateInformationPotential(nft, this.calculateUncertainty(nft.total_votes || 0)).toFixed(3)
        }));

      top5SliderCandidates.forEach((candidate, index) => {
        console.log(`   ${index + 1}. ${candidate.name} (${candidate.collection})`);
        console.log(`      Votes: ${candidate.votes}, Uncertainty: ${candidate.uncertainty}, Info Potential: ${candidate.infoPotential}`);
      });

      console.log(`\n✅ Enhanced matchup analysis complete!`);
      console.log(`\n💡 Key Insights:`);
      console.log(`   • High uncertainty NFTs provide maximum learning potential`);
      console.log(`   • Close Elo ratings create competitive, informative matchups`);
      console.log(`   • Cross-collection comparisons expand aesthetic understanding`);
      console.log(`   • ${needingSliderVotes.length} NFTs need initial slider ratings`);

    } catch (error) {
      console.error('❌ Analysis failed:', error);
    }
  }
}

// Run the test
const tester = new TestEnhancedMatchup();
tester.analyzeCurrentDataset();

