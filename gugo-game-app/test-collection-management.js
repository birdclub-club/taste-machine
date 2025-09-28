// 🎛️ Test Collection Management System
// Demonstrates the collection activation/deactivation capabilities

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

class CollectionManager {
  constructor() {
    this.collections = new Map();
  }

  async initialize() {
    console.log('🚀 Initializing Collection Management System...\n');

    try {
      // Create collection management table if it doesn't exist
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.collection_management (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            collection_name TEXT NOT NULL UNIQUE,
            active BOOLEAN DEFAULT true,
            priority DECIMAL(3,2) DEFAULT 1.0 CHECK (priority >= 0.1 AND priority <= 3.0),
            last_selected TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            notes TEXT,
            auto_managed BOOLEAN DEFAULT false
        );
      `;

      // Note: This would normally be run as a migration, but for testing we'll skip the SQL execution
      console.log('📋 Collection management table structure ready');

      // Get current collections from NFTs
      const { data: nfts, error } = await supabase
        .from('nfts')
        .select('collection_name')
        .not('collection_name', 'is', null)
        .limit(1000);

      if (error) {
        throw new Error(`Failed to get collections: ${error.message}`);
      }

      // Count NFTs per collection
      const collectionCounts = new Map();
      for (const nft of nfts) {
        const collection = nft.collection_name;
        collectionCounts.set(collection, (collectionCounts.get(collection) || 0) + 1);
      }

      console.log('📊 Current Collections Discovered:');
      for (const [collection, count] of collectionCounts.entries()) {
        console.log(`   • ${collection}: ${count} NFTs`);
        
        // Initialize collection status
        this.collections.set(collection, {
          name: collection,
          active: true,
          priority: 1.0,
          nft_count: count,
          last_selected: null,
          auto_managed: false
        });
      }

      console.log(`\n✅ Initialized ${this.collections.size} collections`);
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  // Simulate collection activation/deactivation
  setCollectionActive(collectionName, active) {
    if (!this.collections.has(collectionName)) {
      console.log(`❌ Collection '${collectionName}' not found`);
      return false;
    }

    const collection = this.collections.get(collectionName);
    collection.active = active;
    
    console.log(`✅ Collection '${collectionName}' ${active ? 'activated' : 'deactivated'}`);
    return true;
  }

  // Simulate priority setting
  setCollectionPriority(collectionName, priority) {
    if (!this.collections.has(collectionName)) {
      console.log(`❌ Collection '${collectionName}' not found`);
      return false;
    }

    if (priority < 0.1 || priority > 3.0) {
      console.log(`❌ Priority must be between 0.1 and 3.0, got ${priority}`);
      return false;
    }

    const collection = this.collections.get(collectionName);
    collection.priority = priority;
    
    console.log(`✅ Collection '${collectionName}' priority set to ${priority}`);
    return true;
  }

  // Get active collections
  getActiveCollections() {
    return Array.from(this.collections.values()).filter(c => c.active);
  }

  // Get collection statistics
  getCollectionStats() {
    const collections = Array.from(this.collections.values());
    const activeCollections = collections.filter(c => c.active);
    
    return {
      total_collections: collections.length,
      active_collections: activeCollections.length,
      total_nfts: collections.reduce((sum, c) => sum + c.nft_count, 0),
      avg_priority: activeCollections.reduce((sum, c) => sum + c.priority, 0) / Math.max(1, activeCollections.length),
      collections: collections.map(c => ({
        name: c.name,
        active: c.active,
        priority: c.priority,
        nft_count: c.nft_count,
        selection_weight: c.active ? c.priority : 0
      }))
    };
  }

  // Simulate smart matchup selection with collection weights
  async generateWeightedMatchup() {
    const activeCollections = this.getActiveCollections();
    
    if (activeCollections.length === 0) {
      console.log('❌ No active collections available for matchups');
      return null;
    }

    console.log('\n🎯 Generating weighted matchup selection...');

    // Calculate selection weights
    const totalWeight = activeCollections.reduce((sum, c) => sum + c.priority, 0);
    
    console.log('📊 Collection Selection Weights:');
    for (const collection of activeCollections) {
      const weight = (collection.priority / totalWeight * 100).toFixed(1);
      console.log(`   • ${collection.name}: ${weight}% (priority: ${collection.priority})`);
    }

    // Simulate collection selection based on weights
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    let selectedCollection = null;

    for (const collection of activeCollections) {
      cumulativeWeight += collection.priority;
      if (random <= cumulativeWeight) {
        selectedCollection = collection;
        break;
      }
    }

    if (!selectedCollection) {
      selectedCollection = activeCollections[0]; // Fallback
    }

    console.log(`\n🎲 Selected collection: ${selectedCollection.name} (${selectedCollection.nft_count} NFTs)`);
    
    // Update last_selected timestamp
    selectedCollection.last_selected = new Date();

    return {
      collection: selectedCollection.name,
      selection_reason: `Weighted random selection (priority: ${selectedCollection.priority})`,
      nft_count: selectedCollection.nft_count
    };
  }

  // Demonstrate advanced collection scenarios
  async demonstrateScenarios() {
    console.log('\n🎭 Demonstrating Collection Management Scenarios...\n');

    // Scenario 1: Deactivate a collection
    console.log('📋 Scenario 1: Deactivating collection');
    const collections = Array.from(this.collections.keys());
    if (collections.length > 1) {
      const collectionToDeactivate = collections[0];
      this.setCollectionActive(collectionToDeactivate, false);
      
      const activeBefore = this.getActiveCollections().length;
      console.log(`   Active collections now: ${activeBefore}`);
    }

    // Scenario 2: Set different priorities
    console.log('\n📋 Scenario 2: Setting collection priorities');
    if (collections.length >= 2) {
      this.setCollectionPriority(collections[1], 2.5); // High priority
      if (collections.length >= 3) {
        this.setCollectionPriority(collections[2], 0.5); // Low priority
      }
    }

    // Scenario 3: Show how priorities affect selection
    console.log('\n📋 Scenario 3: Testing weighted selection');
    for (let i = 0; i < 3; i++) {
      const result = await this.generateWeightedMatchup();
      if (result) {
        console.log(`   Trial ${i + 1}: ${result.collection} selected`);
      }
    }

    // Scenario 4: Reactivate and show statistics
    console.log('\n📋 Scenario 4: Final statistics');
    if (collections.length > 0) {
      this.setCollectionActive(collections[0], true); // Reactivate
    }
    
    const stats = this.getCollectionStats();
    console.log('📊 Final Collection Statistics:');
    console.log(`   Total Collections: ${stats.total_collections}`);
    console.log(`   Active Collections: ${stats.active_collections}`);
    console.log(`   Total NFTs: ${stats.total_nfts}`);
    console.log(`   Average Priority: ${stats.avg_priority.toFixed(2)}`);
    
    console.log('\n📋 Individual Collection Status:');
    for (const collection of stats.collections) {
      const status = collection.active ? '✅ Active' : '❌ Inactive';
      const weight = collection.selection_weight.toFixed(1);
      console.log(`   • ${collection.name}: ${status} (Priority: ${collection.priority}, Weight: ${weight})`);
    }
  }
}

// Run the collection management test
async function runTest() {
  console.log('🧪 Collection Management System Test\n');
  console.log('=' .repeat(50));
  
  try {
    const manager = new CollectionManager();
    await manager.initialize();
    await manager.demonstrateScenarios();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Collection Management Test Complete!');
    console.log('\n💡 Key Features Demonstrated:');
    console.log('   • Dynamic collection activation/deactivation');
    console.log('   • Priority-based weighted selection');
    console.log('   • Real-time statistics and monitoring');
    console.log('   • Flexible collection management scenarios');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

runTest();

