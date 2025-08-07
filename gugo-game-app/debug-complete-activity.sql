-- Complete Activity Analysis: FIRE votes vs Regular votes vs Slider votes

-- 1. Complete FIRE vote summary
SELECT 
  'FIRE Vote Summary' as analysis_type,
  COUNT(*) as total_fire_votes,
  COUNT(DISTINCT f.nft_id) as unique_nfts_with_fire,
  COUNT(DISTINCT f.wallet_address) as unique_fire_voters,
  MAX(fire_counts.fire_count) as max_fire_per_nft
FROM public.favorites f
LEFT JOIN (
  SELECT nft_id, COUNT(*) as fire_count 
  FROM public.favorites 
  WHERE vote_type = 'fire' 
  GROUP BY nft_id
) fire_counts ON f.nft_id = fire_counts.nft_id
WHERE f.vote_type = 'fire';

-- 2. All FIRE votes with NFT details (complete list)
SELECT 
  'Complete FIRE List' as analysis_type,
  f.nft_id,
  n.name,
  n.collection_name,
  fire_counts.fire_count,
  f.wallet_address as fire_voter,
  f.created_at as fire_date
FROM public.favorites f
LEFT JOIN public.nfts n ON f.nft_id::uuid = n.id
LEFT JOIN (
  SELECT nft_id, COUNT(*) as fire_count 
  FROM public.favorites 
  WHERE vote_type = 'fire' 
  GROUP BY nft_id
) fire_counts ON f.nft_id = fire_counts.nft_id
WHERE f.vote_type = 'fire'
ORDER BY fire_counts.fire_count DESC, f.created_at DESC;

-- 3. Activity comparison: FIRE vs Regular votes vs Slider votes
SELECT 
  'Activity Comparison' as analysis_type,
  n.name,
  n.collection_name,
  n.total_votes as total_head_to_head_votes,
  n.slider_count as total_slider_ratings,
  COALESCE(fire_counts.fire_count, 0) as fire_votes,
  n.current_elo,
  n.slider_average,
  CASE 
    WHEN COALESCE(fire_counts.fire_count, 0) > 0 THEN 'Has FIRE'
    WHEN n.total_votes >= 10 THEN 'High Engagement'
    WHEN n.total_votes >= 5 THEN 'Medium Engagement'
    WHEN n.total_votes >= 1 THEN 'Low Engagement'
    ELSE 'No Activity'
  END as activity_tier
FROM public.nfts n
LEFT JOIN (
  SELECT 
    nft_id::uuid as nft_uuid, 
    COUNT(*) as fire_count 
  FROM public.favorites 
  WHERE vote_type = 'fire' 
  GROUP BY nft_id::uuid
) fire_counts ON n.id = fire_counts.nft_uuid
WHERE n.current_elo IS NOT NULL
  AND (n.total_votes >= 1 OR n.slider_count >= 1 OR COALESCE(fire_counts.fire_count, 0) > 0)
ORDER BY 
  COALESCE(fire_counts.fire_count, 0) DESC,
  n.total_votes DESC,
  n.current_elo DESC
LIMIT 50;
