-- Test the exact function call the API makes
SELECT 
  'API_SIMULATION' as test_type,
  leaderboard_position,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score,
  current_elo
FROM public.get_fire_first_leaderboard_v2(20)
ORDER BY leaderboard_position
LIMIT 10;
