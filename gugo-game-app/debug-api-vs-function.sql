-- Debug: Compare what our function returns vs what API sees

-- Test 1: Direct function call (what we expect)
SELECT 
  'DIRECT FUNCTION CALL' as test_type,
  leaderboard_position,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score
FROM public.get_dynamic_leaderboard_lightweight(10)
ORDER BY leaderboard_position;

-- Test 2: Check if there are multiple versions of the function
SELECT 
  'FUNCTION VERSIONS' as test_type,
  proname as function_name,
  pronargs as num_args,
  proargtypes,
  prorettype
FROM pg_proc 
WHERE proname LIKE '%leaderboard%'
ORDER BY proname;

-- Test 3: Raw RPC call simulation (like API does)
SELECT 
  'RPC SIMULATION' as test_type,
  rpc.*
FROM public.get_dynamic_leaderboard_lightweight(5) rpc
ORDER BY leaderboard_position;
