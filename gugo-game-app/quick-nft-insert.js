// Quick NFT data insertion using the same method as working Next.js API
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xcruwistwdmytlcbqbij.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcnV3aXN0d2RteXRsY2JxYmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNzIzNTAsImV4cCI6MjA0OTk0ODM1MH0.jI6Jqko-vUiJsLGrLy9C_M21fEHrEXQVBLs9zVD4Xe8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertSampleNFTs() {
  console.log('🎨 Inserting sample NFTs for testing...');
  
  const sampleNFTs = [
    {
      token_id: '1',
      name: 'Cool Bear #1',
      description: 'A cool bear NFT',
      image: 'https://i.seadn.io/gae/1XjePk9tqW7lF8F8GvGF5ZH8oL9zV8z4L0d6I8j1qH6h9Z2K3?auto=format&w=384',
      collection_name: 'Bearish',
      contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
      traits: {},
      current_elo: 1000,
      total_votes: 0,
      wins: 0,
      losses: 0,
      slider_average: 50,
      slider_count: 0
    },
    {
      token_id: '2', 
      name: 'Cool Bear #2',
      description: 'Another cool bear NFT',
      image: 'https://i.seadn.io/gae/2YjfQl8uqX8mG9G9H6I6aI9zW9a5M1e7M1f7J9k2rI7i0A3L4?auto=format&w=384',
      collection_name: 'Bearish',
      contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
      traits: {},
      current_elo: 1000,
      total_votes: 0,
      wins: 0,
      losses: 0,
      slider_average: 50,
      slider_count: 0
    },
    {
      token_id: '3',
      name: 'Cool Bear #3', 
      description: 'Yet another cool bear NFT',
      image: 'https://i.seadn.io/gae/3ZkgRm9vrY9nH0H0I7J7bJ0a6X0b6N2f8N2g8K0l3sJ8j1B4M5?auto=format&w=384',
      collection_name: 'Bearish',
      contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
      traits: {},
      current_elo: 1000,
      total_votes: 0,
      wins: 0,
      losses: 0,
      slider_average: 50,
      slider_count: 0
    }
  ];

  try {
    const { data, error } = await supabase
      .from('nfts')
      .insert(sampleNFTs)
      .select();

    if (error) {
      console.error('❌ Insert failed:', error);
      return false;
    }

    console.log('✅ Successfully inserted', data.length, 'sample NFTs!');
    return true;
  } catch (e) {
    console.error('❌ Exception:', e.message);
    return false;
  }
}

insertSampleNFTs().then(success => {
  if (success) {
    console.log('🎉 Sample data ready! Try your app now.');
  } else {
    console.log('💥 Failed to insert sample data');
  }
});
