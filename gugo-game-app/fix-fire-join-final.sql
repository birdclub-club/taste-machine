-- FINAL FIX: The FIRE vote JOIN is broken in our function
-- Let's debug and fix the exact issue

-- First, let's check the exact UUID format in both tables
SELECT 
  'NFT IDs Format Check' as test_type,
  'nfts' as table_name,
  id,
  pg_typeof(id) as id_type
FROM public.nfts 
WHERE name = 'BEEISH # 75'
LIMIT 1;

SELECT 
  'Favorites ID Format Check' as test_type,
  'favorites' as table_name,
  nft_id,
  pg_typeof(nft_id) as nft_id_type,
  nft_id::uuid as nft_id_as_uuid,
  pg_typeof(nft_id::uuid) as uuid_type
FROM public.favorites 
WHERE vote_type = 'fire'
LIMIT 1;

-- Now let's test the EXACT JOIN logic from our function
WITH nft_fire_votes AS (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
)
SELECT 
  'Function JOIN Test' as test_type,
  n.id as nft_id,
  n.name,
  f.nft_uuid as joined_uuid,
  f.fire_count,
  COALESCE(f.fire_count, 0) as coalesced_fire
FROM public.nfts n
LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
WHERE n.name IN ('BEEISH # 75', 'Kabu #1960', 'BOSU #6264')
ORDER BY COALESCE(f.fire_count, 0) DESC;

-- Let's also check if there are any NULL or weird characters in nft_id
SELECT 
  'Favorites Data Quality' as test_type,
  nft_id,
  LENGTH(nft_id) as id_length,
  vote_type,
  CASE 
    WHEN nft_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'Valid UUID Format'
    ELSE 'INVALID UUID FORMAT'
  END as uuid_validity
FROM public.favorites 
WHERE vote_type = 'fire'
ORDER BY created_at DESC;
