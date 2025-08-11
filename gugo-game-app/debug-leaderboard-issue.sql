-- Debug why leaderboard is showing Bearish NFTs instead of FIRE votes
-- This query will help us understand what's actually happening

-- First, check if FIRE votes exist at all
SELECT 'FIRE_VOTE_CHECK' as query_type, 
       COUNT(*) as total_fire_votes,
       COUNT(DISTINCT nft_id) as nfts_with_fire_votes
FROM public.favorites 
WHERE vote_type = 'fire';

-- Check the specific NFTs that have FIRE votes
SELECT 'NFTS_WITH_FIRE' as query_type,
       n.name,
       n.collection_name,
       n.current_elo,
       n.total_votes,
       n.wins,
       n.losses,
       COUNT(f.id) as fire_vote_count,
       n.image
FROM public.nfts n
JOIN public.favorites f ON n.id::text = f.nft_id
WHERE f.vote_type = 'fire'
GROUP BY n.id, n.name, n.collection_name, n.current_elo, n.total_votes, n.wins, n.losses, n.image
ORDER BY fire_vote_count DESC, n.current_elo DESC
LIMIT 10;

-- Check what the leaderboard function actually returns
SELECT 'FUNCTION_RESULT' as query_type,
       leaderboard_position,
       name,
       collection_name,
       fire_votes,
       total_votes,
       current_elo,
       poa_score,
       image
FROM public.get_fire_first_leaderboard_v2(10)
ORDER BY leaderboard_position;

-- Check the top NFTs by various metrics to understand dominance
SELECT 'TOP_BY_ELO' as query_type,
       name,
       collection_name,
       current_elo,
       total_votes,
       wins,
       losses,
       COALESCE((SELECT COUNT(*) FROM public.favorites f WHERE f.nft_id = n.id::text AND f.vote_type = 'fire'), 0) as fire_votes
FROM public.nfts n
WHERE current_elo IS NOT NULL
ORDER BY current_elo DESC
LIMIT 10;

-- Check collection distribution
SELECT 'COLLECTION_STATS' as query_type,
       collection_name,
       COUNT(*) as nft_count,
       AVG(current_elo) as avg_elo,
       AVG(total_votes) as avg_votes,
       SUM(CASE WHEN id::text IN (SELECT nft_id FROM public.favorites WHERE vote_type = 'fire') THEN 1 ELSE 0 END) as nfts_with_fire
FROM public.nfts n
WHERE current_elo IS NOT NULL
GROUP BY collection_name
ORDER BY nft_count DESC;

-- Check if there are any NFTs with NULL or bad images that might be causing fallbacks
SELECT 'IMAGE_ISSUES' as query_type,
       collection_name,
       COUNT(*) as total_nfts,
       COUNT(CASE WHEN image IS NULL OR image = '' THEN 1 END) as null_images,
       COUNT(CASE WHEN image LIKE '%ipfs%' THEN 1 END) as ipfs_images,
       COUNT(CASE WHEN image LIKE '%http%' THEN 1 END) as http_images
FROM public.nfts n
WHERE current_elo IS NOT NULL
GROUP BY collection_name
ORDER BY total_nfts DESC;
