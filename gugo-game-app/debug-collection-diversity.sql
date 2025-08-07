-- Debug Collection Diversity in Dynamic POA System
-- Run this to understand why only BEARISH NFTs are appearing

-- 1. Check what collections exist with meaningful data
SELECT 
  'Collection Overview' as analysis_type,
  collection_name,
  COUNT(*) as total_nfts,
  COUNT(CASE WHEN total_votes > 0 THEN 1 END) as nfts_with_votes,
  COUNT(CASE WHEN slider_count > 0 THEN 1 END) as nfts_with_slider_data,
  AVG(current_elo) as avg_elo,
  MAX(current_elo) as max_elo
FROM public.nfts 
WHERE current_elo IS NOT NULL
GROUP BY collection_name
ORDER BY COUNT(CASE WHEN total_votes > 0 OR slider_count > 0 THEN 1 END) DESC;

-- 2. Check FIRE votes by collection
SELECT 
  'FIRE Votes by Collection' as analysis_type,
  n.collection_name,
  COUNT(f.id) as fire_vote_count,
  COUNT(DISTINCT f.nft_id) as unique_nfts_with_fire
FROM public.nfts n
LEFT JOIN public.favorites f ON n.id = f.nft_id::uuid AND f.vote_type = 'fire'
WHERE n.current_elo IS NOT NULL
GROUP BY n.collection_name
HAVING COUNT(f.id) > 0
ORDER BY COUNT(f.id) DESC;

-- 3. Test the actual leaderboard function with more details
SELECT 
  'Current Leaderboard Top 10' as analysis_type,
  name,
  collection_name,
  poa_score,
  confidence_score,
  fire_votes,
  total_votes,
  slider_count,
  current_elo,
  algorithm
FROM public.get_dynamic_leaderboard_lightweight(10)
ORDER BY leaderboard_position;

-- 4. Check if other collections would qualify for meaningful status
SELECT 
  'Meaningful NFTs by Collection' as analysis_type,
  collection_name,
  COUNT(*) as meaningful_nfts,
  AVG(CASE 
    WHEN total_votes >= 1 OR slider_count >= 1 THEN 1.0
    ELSE 0.0
  END) * 100 as pct_meaningful
FROM public.nfts 
WHERE current_elo IS NOT NULL
  AND (total_votes >= 1 OR slider_count >= 1)
GROUP BY collection_name
ORDER BY COUNT(*) DESC;
