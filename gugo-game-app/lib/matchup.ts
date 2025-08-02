import { supabase } from './supabase';

export async function fetchMatchup() {
  console.log('🔍 Fetching matchup...');
  
  // First, let's try the join query
  let { data: matchupData, error: matchupError } = await supabase
    .from('matchups')
    .select('id, nft1_id, nft2_id, status')
    .eq('status', 'pending')
    .limit(1)
    .single();
    
  if (matchupError) {
    console.error('❌ Matchup query failed:', matchupError);
    throw new Error(`Failed to fetch matchup: ${matchupError.message}`);
  }
  
  if (!matchupData) {
    console.log('⚠️ No pending matchups found, creating new ones...');
    // Create new matchups if none exist
    await createRandomMatchups();
    // Try again
    const { data: newMatchupData, error: newError } = await supabase
      .from('matchups')
      .select('id, nft1_id, nft2_id, status')
      .eq('status', 'pending')
      .limit(1)
      .single();
      
    if (newError || !newMatchupData) {
      throw new Error('Failed to create new matchups');
    }
    
    matchupData = newMatchupData;
  }
  
  console.log('📋 Found matchup:', matchupData);
  
  // Now fetch the NFTs separately to avoid join issues
  const { data: nft1, error: nft1Error } = await supabase
    .from('nfts')
    .select('id, name, image, token_id')
    .eq('id', matchupData.nft1_id)
    .single();
    
  const { data: nft2, error: nft2Error } = await supabase
    .from('nfts')
    .select('id, name, image, token_id')
    .eq('id', matchupData.nft2_id)
    .single();
    
  if (nft1Error || nft2Error || !nft1 || !nft2) {
    console.error('❌ Failed to fetch NFTs:', { nft1Error, nft2Error });
    throw new Error('Failed to fetch NFT data for matchup');
  }
  
  console.log('✅ Successfully fetched matchup with NFTs');
  
  return {
    id: matchupData.id,
    nft1: {
      id: nft1.id,
      name: nft1.name,
      image: nft1.image,
    },
    nft2: {
      id: nft2.id,
      name: nft2.name,
      image: nft2.image,
    },
  };
}

async function createRandomMatchups() {
  console.log('🎲 Creating new random matchups...');
  
  // Get random NFTs
  const { data: nfts, error } = await supabase
    .from('nfts')
    .select('id')
    .limit(10);
    
  if (error || !nfts || nfts.length < 2) {
    throw new Error('Not enough NFTs to create matchups');
  }
  
  // Create 3 random matchups
  const matchups = [];
  for (let i = 0; i < Math.min(3, Math.floor(nfts.length / 2)); i++) {
    const nft1 = nfts[i * 2];
    const nft2 = nfts[i * 2 + 1];
    
    matchups.push({
      nft1_id: nft1.id,
      nft2_id: nft2.id,
      status: 'pending'
    });
  }
  
  const { error: insertError } = await supabase
    .from('matchups')
    .insert(matchups);
    
  if (insertError) {
    console.error('❌ Failed to create matchups:', insertError);
    throw insertError;
  }
  
  console.log(`✅ Created ${matchups.length} new matchups`);
}