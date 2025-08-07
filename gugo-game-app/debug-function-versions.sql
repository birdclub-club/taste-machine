-- Check for multiple function versions and debug the WHERE clause

-- 1. Check all leaderboard functions
SELECT 
  'Function Versions' as test_type,
  proname as function_name,
  pronargs as arg_count,
  proargnames as arg_names,
  oid as function_oid
FROM pg_proc 
WHERE proname LIKE '%leaderboard%'
ORDER BY proname, oid;

-- 2. Let's manually test our function's WHERE clause with FIRE NFTs
WITH nft_fire_votes AS (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
)
SELECT 
  'WHERE Clause Test' as test_type,
  n.id,
  n.name,
  n.current_elo,
  n.total_votes,
  n.slider_count,
  COALESCE(f.fire_count, 0) as fire_votes,
  -- Test the exact WHERE clause from our function
  CASE 
    WHEN n.current_elo IS NULL THEN 'FILTERED: No Elo'
    WHEN NOT (COALESCE(f.fire_count, 0) > 0 OR (n.total_votes >= 1 OR n.slider_count >= 1)) THEN 'FILTERED: Insufficient Activity'
    ELSE 'INCLUDED'
  END as filter_result
FROM public.nfts n
LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
WHERE n.name IN ('BEEISH # 75', 'Kabu #1960', 'BOSU #6264', 'Weed Green #4179', 'BEEISH # 2021')
ORDER BY COALESCE(f.fire_count, 0) DESC;

-- 3. Check if our function is actually returning FIRE votes but they're getting lost
SELECT 
  'Direct Function Output' as test_type,
  id,
  name,
  fire_votes,
  total_votes,
  leaderboard_position
FROM public.get_dynamic_leaderboard_lightweight(20)
WHERE name IN ('BEEISH # 75', 'Kabu #1960', 'BOSU #6264', 'Weed Green #4179', 'BEEISH # 2021')
ORDER BY leaderboard_position;
