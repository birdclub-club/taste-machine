-- Debug why FIRE-voted NFTs aren't appearing in leaderboard
-- Check if the FIRE vote JOIN is working correctly

-- 1. Check all FIRE votes with full details
SELECT 
  'All FIRE Votes Full Details' as analysis_type,
  f.nft_id,
  f.nft_id::uuid as nft_uuid,
  n.id as nft_table_id,
  n.name,
  n.collection_name,
  n.total_votes,
  n.current_elo,
  CASE WHEN n.id IS NULL THEN 'NFT NOT FOUND' ELSE 'NFT EXISTS' END as nft_status
FROM public.favorites f
LEFT JOIN public.nfts n ON f.nft_id::uuid = n.id
WHERE f.vote_type = 'fire'
ORDER BY n.collection_name, n.name;

-- 2. Check if FIRE-voted NFTs meet our leaderboard criteria
SELECT 
  'FIRE NFTs Leaderboard Eligibility' as analysis_type,
  n.name,
  n.collection_name,
  n.current_elo,
  n.total_votes,
  n.slider_count,
  COUNT(f.id) as fire_votes,
  CASE 
    WHEN n.current_elo IS NULL THEN 'NO ELO'
    WHEN n.total_votes < 1 AND n.slider_count < 1 THEN 'NO ENGAGEMENT'
    ELSE 'ELIGIBLE'
  END as eligibility_status
FROM public.nfts n
JOIN public.favorites f ON n.id = f.nft_id::uuid
WHERE f.vote_type = 'fire'
GROUP BY n.id, n.name, n.collection_name, n.current_elo, n.total_votes, n.slider_count
ORDER BY fire_votes DESC, n.total_votes DESC;

-- 3. Test the FIRE vote JOIN logic from our function
SELECT 
  'FIRE Vote JOIN Test' as analysis_type,
  n.name,
  n.collection_name,
  n.total_votes,
  COALESCE(f.fire_count, 0) as detected_fire_votes
FROM public.nfts n
LEFT JOIN (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
) f ON n.id = f.nft_uuid
WHERE n.name IN ('BEEISH # 2021', 'BEEISH # 2157', 'BEEISH # 75', 'BOSU #6264', 'Kabu #1952', 'Kabu #1960', 'Weed Green #4179')
ORDER BY n.name;
