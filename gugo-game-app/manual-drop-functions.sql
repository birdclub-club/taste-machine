-- 🗑️ Manual Function Drop (run this first if v3 fails)
-- Use this if the automated drops don't work

-- Check what functions exist first
SELECT 
    schemaname,
    functionname,
    definition
FROM pg_functions 
WHERE functionname LIKE '%optimal%'
ORDER BY functionname;

-- Manual drops - copy the exact function signatures from the output above
-- Example format (replace with actual signatures from the query above):
-- DROP FUNCTION public.find_optimal_slider_nft(max_candidates integer);
-- DROP FUNCTION public.find_optimal_same_collection_matchup_lite(target_collection text, max_candidates integer);
-- DROP FUNCTION public.find_optimal_cross_collection_matchup_lite(max_candidates integer);

