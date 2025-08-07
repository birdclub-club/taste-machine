import { supabase } from './supabase';
import type { VotingSession, VoteType, NFT, MatchupPair, SliderVote } from '@/types/voting';

// 🧠 Sophisticated Voting Session Logic (INSTANT DELIVERY)
export async function fetchVotingSession(userWallet?: string, collectionFilter?: string): Promise<VotingSession> {
  console.log('🔍 Fetching voting session...');
  
  if (collectionFilter) {
    console.log(`🎯 Filtering for collection: ${collectionFilter}`);
  }
  
  // Try to get instant matchup from pre-generated queue
  const instantMatchup = await getInstantMatchupFromQueue(userWallet, collectionFilter);
  if (instantMatchup) {
    console.log(`⚡ Instant delivery: ${instantMatchup.vote_type}`);
    return instantMatchup;
  }
  
  // Fallback to dynamic generation (should rarely happen)
  console.log('⚠️ Queue empty, generating dynamic matchup');
  const voteType = await decideVoteType(userWallet, collectionFilter);
  console.log(`🎯 Selected vote type: ${voteType}`);
  
  if (voteType === 'slider') {
    return await fetchSliderVote(collectionFilter);
  } else {
    return await fetchMatchupVote(voteType, collectionFilter);
  }
}

// ⚡ Get instant matchup from pre-generated queue
async function getInstantMatchupFromQueue(userWallet?: string, collectionFilter?: string): Promise<VotingSession | null> {
  try {
    const userSession = userWallet || `anon_${Date.now()}`;
    
    // Check if queue table exists first (in case migration hasn't run)
    const { data: tableCheck } = await supabase
      .from('matchup_queue')
      .select('id')
      .limit(1);
      
    if (!tableCheck) {
      console.log('📭 Queue table not found, using dynamic generation');
      return null;
    }
    
    const { data: queueData, error } = await supabase
      .rpc('get_instant_matchup', { 
        preferred_vote_type: null, // Let algorithm decide
        user_session: userSession 
      });
      
    if (error || !queueData || queueData.length === 0) {
      console.log('📭 Queue empty or error, falling back to dynamic generation');
      return null;
    }
    
    const matchup = queueData[0];
    
    // Convert queue result to voting session
    if (matchup.vote_type === 'slider') {
      const { data: nft, error: nftError } = await supabase
        .from('nfts')
        .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
        .eq('id', matchup.slider_nft_id)
    .single();
        
      if (nftError || !nft) {
        console.error('❌ Failed to fetch slider NFT from queue');
        return null;
      }
      
      // Check if NFT matches collection filter
      if (collectionFilter && nft.collection_name !== collectionFilter) {
        console.log(`🚫 Slider NFT collection "${nft.collection_name}" doesn't match filter "${collectionFilter}", falling back to dynamic generation`);
        return null;
      }
      
      return {
        nft: mapNFTData(nft),
        vote_type: 'slider',
        queueId: matchup.queue_id // Store for cleanup after vote
      };
    } else {
      // Fetch both NFTs for matchup
      const [nft1Result, nft2Result] = await Promise.all([
        supabase
          .from('nfts')
          .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
          .eq('id', matchup.nft_a_id)
          .single(),
        supabase
          .from('nfts')
          .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
          .eq('id', matchup.nft_b_id)
          .single()
      ]);
      
      if (nft1Result.error || nft2Result.error || !nft1Result.data || !nft2Result.data) {
        console.error('❌ Failed to fetch matchup NFTs from queue');
        return null;
      }
      
      // Check if NFTs match collection filter
      if (collectionFilter) {
        const nft1Matches = nft1Result.data.collection_name === collectionFilter;
        const nft2Matches = nft2Result.data.collection_name === collectionFilter;
        
        if (!nft1Matches && !nft2Matches) {
          console.log(`🚫 Neither matchup NFT matches collection filter "${collectionFilter}", falling back to dynamic generation`);
          return null;
        }
      }
      
      return {
        nft1: mapNFTData(nft1Result.data),
        nft2: mapNFTData(nft2Result.data),
        vote_type: matchup.vote_type as 'same_coll' | 'cross_coll',
        queueId: matchup.queue_id // Store for cleanup after vote
      };
    }
  } catch (error) {
    console.error('❌ Error fetching from queue:', error);
    return null;
  }
}

// 🎲 Smart vote type decision with balanced distribution
async function decideVoteType(userWallet?: string, collectionFilter?: string): Promise<VoteType> {
  // Check how many NFTs need slider votes (cold start)
  const { data: coldStartNFTs, error } = await supabase
    .rpc('find_cold_start_nfts', { limit_count: 1 });
    
  if (error) {
    console.warn('⚠️ Failed to check cold start NFTs, defaulting to same_coll');
    return 'same_coll';
  }
  
  const hasColdStart = coldStartNFTs && coldStartNFTs.length > 0;
  
  // Get count of NFTs needing slider votes, but don't let it dominate
  const { count: coldStartCount } = await supabase
    .from('nfts')
    .select('*', { count: 'exact', head: true })
    .lt('slider_count', 3); // Lowered threshold
    
  // 🎯 Collection filtering logic
  if (collectionFilter) {
    // For specific collections (like BEARISH), only use same_coll and slider
    const random = Math.random();
    if (random < 0.2 && hasColdStart) {
      return 'slider';
    } else {
      return 'same_coll'; // Only same-collection matchups for filtered collections
    }
  }
  
  // Balanced weighted random selection for mixed collections
  const random = Math.random();
  
  // 🎯 MATCHUP-FOCUSED DISTRIBUTION:
  // 10% slider votes (when cold start available) - much more fun to do head-to-head!
  // 60% same collection matchups  
  // 30% cross collection matchups
  
  if (random < 0.1 && hasColdStart) {
    return 'slider';
  } else if (random < 0.7) {
    return 'same_coll';
  } else {
    return 'cross_coll';
  }
}

// 📊 Fetch slider voting session
async function fetchSliderVote(collectionFilter?: string): Promise<SliderVote> {
  console.log('🎚️ Fetching slider vote...');
  
  // Use the cold start function to find NFTs needing slider votes
  const { data: nftData, error } = await supabase
    .rpc('find_cold_start_nfts', { limit_count: 1 });
    
  if (error || !nftData || nftData.length === 0) {
    console.warn('⚠️ No cold start NFTs found, falling back to random NFT');
    
    // Fallback to random NFT with lowest slider count, excluding videos and unrevealed
    let query = supabase
      .from('nfts')
      .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
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
      .not('traits', 'cs', '[{"trait_type": "hive", "value": "present"}]')      // Case variations;

    // Add collection filter if specified
    if (collectionFilter) {
      query = query.eq('collection_name', collectionFilter);
      console.log(`🎯 Filtering slider vote for collection: ${collectionFilter}`);
    }

    const { data: fallbackNFT, error: fallbackError } = await query
      .order('slider_count', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (fallbackError || !fallbackNFT) {
      throw new Error('Failed to find any NFT for slider voting');
    }
    
    return {
      nft: mapNFTData(fallbackNFT),
      vote_type: 'slider'
    };
  }
  
  // Fetch the full NFT data
  const { data: fullNFT, error: nftError } = await supabase
    .from('nfts')
    .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
    .eq('id', nftData[0].nft_id)
    .single();
    
  if (nftError || !fullNFT) {
    throw new Error('Failed to fetch NFT data for slider vote');
  }
  
  console.log('✅ Successfully fetched slider vote NFT');
  
  return {
    nft: mapNFTData(fullNFT),
    vote_type: 'slider'
  };
}

// 🥊 Fetch matchup voting session (same_coll or cross_coll)
async function fetchMatchupVote(voteType: 'same_coll' | 'cross_coll', collectionFilter?: string): Promise<MatchupPair> {
  console.log(`🥊 Fetching ${voteType} matchup...`);
  
  const functionName = voteType === 'same_coll' 
    ? 'find_same_collection_matchup' 
    : 'find_cross_collection_matchup';
    
  const { data: matchupData, error } = await supabase
    .rpc(functionName);
    
  if (error || !matchupData || matchupData.length === 0) {
    console.warn(`⚠️ No ${voteType} matchup found, falling back to random selection`);
    return await fallbackRandomMatchup(voteType, collectionFilter);
  }
  
  const matchup = matchupData[0];
  
  // Fetch both NFTs
  const [nft1Result, nft2Result] = await Promise.all([
    supabase
      .from('nfts')
      .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
      .eq('id', matchup.nft_a_id)
      .single(),
    supabase
      .from('nfts')
      .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
      .eq('id', matchup.nft_b_id)
      .single()
  ]);
  
  if (nft1Result.error || nft2Result.error || !nft1Result.data || !nft2Result.data) {
    console.error('❌ Failed to fetch NFT data for matchup');
    throw new Error('Failed to fetch NFT data for matchup');
  }
  
  // Check if NFTs match collection filter
  if (collectionFilter) {
    const nft1Matches = nft1Result.data.collection_name === collectionFilter;
    const nft2Matches = nft2Result.data.collection_name === collectionFilter;
    
    if (!nft1Matches && !nft2Matches) {
      console.log(`🚫 Neither matchup NFT matches collection filter "${collectionFilter}", falling back to random selection`);
      return await fallbackRandomMatchup(voteType, collectionFilter);
    }
  }
  
  console.log('✅ Successfully fetched matchup with NFTs');
  
  return {
    nft1: mapNFTData(nft1Result.data),
    nft2: mapNFTData(nft2Result.data),
    vote_type: voteType
  };
}

// 🔄 Fallback to random matchup if smart selection fails
async function fallbackRandomMatchup(voteType: 'same_coll' | 'cross_coll', collectionFilter?: string): Promise<MatchupPair> {
  console.log(`🎲 Creating fallback random ${voteType} matchup...`);
  
  const whereClause = voteType === 'same_coll' 
    ? 'a.collection_name = b.collection_name AND a.id < b.id'
    : 'a.collection_name != b.collection_name';
    
  let query = supabase
    .from('nfts')
    .select('id, name, image, token_id, contract_address, collection_name, current_elo, slider_average, slider_count')
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
    .not('traits', 'cs', '[{"trait_type": "hive", "value": "present"}]')      // Case variations;

  // Add collection filter if specified
  if (collectionFilter) {
    query = query.eq('collection_name', collectionFilter);
    console.log(`🎯 Filtering fallback matchup for collection: ${collectionFilter}`);
  }

  const { data: nfts, error } = await query.limit(10);
    
  if (error || !nfts || nfts.length < 2) {
    throw new Error('Not enough NFTs available for matchup');
  }
  
  // Simple random selection for fallback
  const nft1 = nfts[Math.floor(Math.random() * nfts.length)];
  const nft2 = nfts[Math.floor(Math.random() * nfts.length)];
  
  // Ensure they're different
  if (nft1.id === nft2.id) {
    const nft2Index = (nfts.indexOf(nft1) + 1) % nfts.length;
    return {
      nft1: mapNFTData(nft1),
      nft2: mapNFTData(nfts[nft2Index]),
      vote_type: voteType
    };
  }
  
  return {
    nft1: mapNFTData(nft1),
    nft2: mapNFTData(nft2),
    vote_type: voteType
  };
}

// 🗺️ Map database NFT to type-safe NFT
function mapNFTData(dbNFT: Record<string, any>): NFT {
  const mapped = {
    id: dbNFT.id,
    name: dbNFT.name,
    image: dbNFT.image,
    collection_address: dbNFT.contract_address,
    token_address: dbNFT.contract_address,
    token_id: dbNFT.token_id,
    collection_name: dbNFT.collection_name || 'Unknown',
    current_elo: dbNFT.current_elo || 1500,
    slider_average: dbNFT.slider_average,
    slider_count: dbNFT.slider_count || 0
  };
  
  console.log(`🖼️ Mapped NFT ${mapped.id} with image:`, mapped.image);
  
  return mapped;
}

// 🔄 Legacy function for backwards compatibility
export async function fetchMatchup() {
  console.log('⚠️ Using legacy fetchMatchup - consider migrating to fetchVotingSession');
  const session = await fetchVotingSession();
  
  if (session.vote_type === 'slider') {
    throw new Error('Legacy matchup function cannot handle slider votes');
  }
  
  return {
    id: 'dynamic-matchup',
    nft1: session.nft1,
    nft2: session.nft2
  };
}
