-- Debug FIRE votes and current leaderboard logic
-- Check if FIRE votes are being detected correctly

-- 1. Check all FIRE votes in the system
SELECT 
  'All FIRE Votes' as analysis_type,
  f.nft_id,
  n.name,
  n.collection_name,
  COUNT(*) as fire_vote_count
FROM public.favorites f
JOIN public.nfts n ON f.nft_id::uuid = n.id
WHERE f.vote_type = 'fire'
GROUP BY f.nft_id, n.name, n.collection_name
ORDER BY COUNT(*) DESC;

-- 2. Check current leaderboard with FIRE vote details
SELECT 
  'Current Leaderboard with FIRE Details' as analysis_type,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score,
  leaderboard_position,
  CASE 
    WHEN fire_votes >= 1 THEN 'FIRE Tier'
    WHEN total_votes >= 5 THEN 'High Vote Tier'
    WHEN total_votes >= 3 THEN 'Medium Vote Tier'
    WHEN total_votes >= 2 THEN 'Low Vote Tier'
    ELSE 'Single Vote Tier'
  END as expected_tier
FROM public.get_dynamic_leaderboard_lightweight(10)
ORDER BY leaderboard_position;

-- 3. Check if specific high-vote NFTs have FIRE votes
SELECT 
  'High Vote NFTs FIRE Status' as analysis_type,
  n.name,
  n.collection_name,
  n.total_votes,
  COALESCE(f.fire_count, 0) as fire_votes,
  CASE 
    WHEN COALESCE(f.fire_count, 0) >= 1 THEN 'HAS FIRE'
    ELSE 'NO FIRE'
  END as fire_status
FROM public.nfts n
LEFT JOIN (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
) f ON n.id = f.nft_uuid
WHERE n.total_votes >= 7
ORDER BY n.total_votes DESC
LIMIT 10;
