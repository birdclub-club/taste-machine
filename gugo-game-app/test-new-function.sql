-- Test if our new FIRE-first function works

-- First, check if the function exists
SELECT 
  proname as function_name,
  prosrc as function_source_preview
FROM pg_proc 
WHERE proname = 'get_dynamic_leaderboard_lightweight'
LIMIT 1;

-- Test the function with a small limit
SELECT 
  'Function Test' as test_type,
  leaderboard_position,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score,
  CASE 
    WHEN fire_votes > 0 THEN 'FIRE TIER ⭐'
    WHEN total_votes >= 10 THEN 'High Engagement'
    WHEN total_votes >= 5 THEN 'Medium Engagement'
    ELSE 'Low Engagement'
  END as expected_tier
FROM public.get_dynamic_leaderboard_lightweight(10)
ORDER BY leaderboard_position;
