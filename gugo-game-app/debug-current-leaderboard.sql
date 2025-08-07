-- Debug current leaderboard ranking logic
-- Check what's actually happening with FIRE votes and priority scores

SELECT 
  'Current Leaderboard Debug' as analysis_type,
  leaderboard_position,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score,
  CASE 
    WHEN fire_votes >= 2 THEN 'Multi-FIRE'
    WHEN fire_votes >= 1 THEN 'FIRE'
    WHEN total_votes >= 10 THEN 'High Engagement'
    WHEN total_votes >= 5 THEN 'Medium Engagement'
    WHEN total_votes >= 3 THEN 'Low Engagement'
    WHEN total_votes >= 2 THEN 'Minimal Engagement'
    ELSE 'Single Vote'
  END as expected_tier,
  -- Calculate what the priority score should be
  CASE 
    WHEN fire_votes >= 2 THEN 1000 + (poa_score * 10)
    WHEN fire_votes >= 1 THEN 900 + (poa_score * 10)
    WHEN total_votes >= 10 THEN 800 + (poa_score * 10)
    WHEN total_votes >= 5 THEN 700 + (poa_score * 10)
    WHEN total_votes >= 3 THEN 600 + (poa_score * 10)
    WHEN total_votes >= 2 THEN 500 + (poa_score * 10)
    ELSE 400 + (poa_score * 10)
  END as calculated_priority_score
FROM public.get_dynamic_leaderboard_lightweight(10)
ORDER BY leaderboard_position;

-- Also check which NFTs actually have FIRE votes
SELECT 
  'NFTs with FIRE votes' as analysis_type,
  n.name,
  n.collection_name,
  COUNT(f.id) as fire_vote_count
FROM public.nfts n
JOIN public.favorites f ON n.id = f.nft_id::uuid
WHERE f.vote_type = 'fire'
GROUP BY n.name, n.collection_name
ORDER BY COUNT(f.id) DESC;
