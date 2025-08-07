-- Debug data types between nfts.id and favorites.nft_id
-- This is likely the root cause of our FIRE vote JOIN issues

-- 1. Check data types of both tables
SELECT 
    'nfts.id' as table_column,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'nfts' AND column_name = 'id'

UNION ALL

SELECT 
    'favorites.nft_id' as table_column,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'favorites' AND column_name = 'nft_id';

-- 2a. Check sample nfts.id values
SELECT 
    'Sample nfts.id values:' as description,
    id::text as value
FROM nfts 
WHERE total_votes > 0
LIMIT 5;

-- 2b. Check sample favorites.nft_id values  
SELECT 
    'Sample favorites.nft_id values:' as description,
    nft_id::text as value
FROM favorites 
WHERE vote_type = 'fire'
LIMIT 5;

-- 3. Check if any direct JOIN works at all
SELECT 
    n.name,
    n.id as nft_uuid,
    f.nft_id as favorites_nft_id,
    COUNT(f.*) as fire_count
FROM nfts n
INNER JOIN favorites f ON n.id = f.nft_id::uuid
WHERE f.vote_type = 'fire'
  AND n.total_votes > 0
GROUP BY n.id, n.name, f.nft_id
LIMIT 10;

-- 4. Try different casting approaches
SELECT 
    'Method 1: nft_id::uuid' as method,
    COUNT(*) as fire_vote_count
FROM favorites f
INNER JOIN nfts n ON n.id = f.nft_id::uuid
WHERE f.vote_type = 'fire'

UNION ALL

SELECT 
    'Method 2: id::text = nft_id' as method,
    COUNT(*) as fire_vote_count
FROM favorites f
INNER JOIN nfts n ON n.id::text = f.nft_id
WHERE f.vote_type = 'fire'

UNION ALL

SELECT 
    'Method 3: Direct string match' as method,
    COUNT(*) as fire_vote_count
FROM favorites f
INNER JOIN nfts n ON CAST(n.id AS text) = CAST(f.nft_id AS text)
WHERE f.vote_type = 'fire';
