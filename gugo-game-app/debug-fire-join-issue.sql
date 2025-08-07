-- Debug why FIRE votes aren't joining in the main function

-- Test 1: Check the exact structure of favorites table
SELECT 
  'Favorites Table Structure' as test_type,
  nft_id,
  nft_id::uuid as nft_id_as_uuid,
  vote_type,
  wallet_address,
  created_at
FROM public.favorites 
WHERE vote_type = 'fire'
LIMIT 5;

-- Test 2: Check a specific NFT that should have FIRE votes
SELECT 
  'NFT with FIRE Check' as test_type,
  n.id as nft_uuid,
  n.name,
  n.collection_name,
  n.total_votes,
  f.fire_count
FROM public.nfts n
LEFT JOIN (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
) f ON n.id = f.nft_uuid
WHERE n.name = 'BEEISH # 75'
LIMIT 1;

-- Test 3: Check if the exact JOIN logic from our function works
WITH nft_fire_votes AS (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
)
SELECT 
  'JOIN Test' as test_type,
  n.id,
  n.name,
  n.collection_name,
  n.total_votes,
  COALESCE(f.fire_count, 0) as fire_votes_detected
FROM public.nfts n
LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
WHERE n.name IN ('BEEISH # 75', 'Kabu #1960', 'BOSU #6264', 'Weed Green #4179')
ORDER BY COALESCE(f.fire_count, 0) DESC;
