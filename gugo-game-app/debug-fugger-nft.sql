-- Debug Fugger NFT ranking issue
-- Check what's in the database for Fugger NFTs

-- 1. Check all Fugger/Fugz NFTs in the database
SELECT 
  'ALL_FUGZ_NFTS' as query_type,
  id,
  name,
  collection_name,
  current_elo,
  total_votes,
  wins,
  losses,
  (wins::NUMERIC / NULLIF(total_votes, 0)) * 100 as win_percentage
FROM public.nfts 
WHERE collection_name ILIKE '%fugz%' 
   OR name ILIKE '%fugger%'
ORDER BY current_elo DESC;

-- 2. Check FIRE votes for Fugger NFTs
SELECT 
  'FIRE_VOTES_FOR_FUGZ' as query_type,
  n.name,
  n.collection_name,
  COUNT(f.id) as fire_vote_count,
  f.wallet_address,
  f.created_at
FROM public.nfts n
LEFT JOIN public.favorites f ON n.id::text = f.nft_id AND f.vote_type = 'fire'
WHERE (n.collection_name ILIKE '%fugz%' OR n.name ILIKE '%fugger%')
GROUP BY n.id, n.name, n.collection_name, f.wallet_address, f.created_at
ORDER BY fire_vote_count DESC;

-- 3. Check the leaderboard function output specifically for Fugger NFTs
SELECT 
  'LEADERBOARD_FUGZ' as query_type,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score,
  current_elo,
  leaderboard_position
FROM public.get_fire_first_leaderboard_v2(50)
WHERE collection_name ILIKE '%fugz%' 
   OR name ILIKE '%fugger%'
ORDER BY leaderboard_position;

-- 4. Get top 10 from leaderboard to see what's actually ranking high
SELECT 
  'TOP_10_LEADERBOARD' as query_type,
  leaderboard_position,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score,
  current_elo,
  win_percentage
FROM public.get_fire_first_leaderboard_v2(10)
ORDER BY leaderboard_position;
