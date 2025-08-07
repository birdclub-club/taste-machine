-- Test the Dynamic POA System Functions
-- Run this in Supabase SQL Editor to verify everything is working

-- Test 1: Check if functions exist
SELECT 
  'Function Check' as test_name,
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN ('get_poa_system_mode', 'get_dynamic_leaderboard_lightweight', 'dynamic_poa_system_status_lightweight')
ORDER BY proname;

-- Test 2: Check system mode
SELECT 'System Mode Test' as test_name, * FROM public.get_poa_system_mode();

-- Test 3: Get top 5 from leaderboard
SELECT 'Leaderboard Test' as test_name, 
       name, collection_name, poa_score, algorithm, system_mode
FROM public.get_dynamic_leaderboard_lightweight(5);

-- Test 4: System status
SELECT 'System Status Test' as test_name, public.dynamic_poa_system_status_lightweight() as status;
