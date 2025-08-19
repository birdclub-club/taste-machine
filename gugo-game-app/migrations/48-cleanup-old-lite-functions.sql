-- 🧹 Cleanup Old "Lite" Functions
-- Remove deprecated lite functions that are no longer used
-- The v2 functions are now the current/active enhanced functions

-- Drop all old lite function variations
DROP FUNCTION IF EXISTS public.find_optimal_slider_nft();
DROP FUNCTION IF EXISTS public.find_optimal_slider_nft(integer);
DROP FUNCTION IF EXISTS public.find_optimal_slider_nft(int);
DROP FUNCTION IF EXISTS find_optimal_slider_nft();
DROP FUNCTION IF EXISTS find_optimal_slider_nft(integer);
DROP FUNCTION IF EXISTS find_optimal_slider_nft(int);

DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite();
DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite(text);
DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite(text, integer);
DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite(text, int);
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite();
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite(text);
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite(text, integer);
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite(text, int);

DROP FUNCTION IF EXISTS public.find_optimal_cross_collection_matchup_lite();
DROP FUNCTION IF EXISTS public.find_optimal_cross_collection_matchup_lite(integer);
DROP FUNCTION IF EXISTS public.find_optimal_cross_collection_matchup_lite(int);
DROP FUNCTION IF EXISTS find_optimal_cross_collection_matchup_lite();
DROP FUNCTION IF EXISTS find_optimal_cross_collection_matchup_lite(integer);
DROP FUNCTION IF EXISTS find_optimal_cross_collection_matchup_lite(int);

-- Also drop any other old function variations that might exist
DROP FUNCTION IF EXISTS public.find_same_collection_matchup();
DROP FUNCTION IF EXISTS public.find_cross_collection_matchup();
DROP FUNCTION IF EXISTS find_same_collection_matchup();
DROP FUNCTION IF EXISTS find_cross_collection_matchup();

-- Add a comment to document the current state
COMMENT ON FUNCTION public.find_optimal_slider_nft_v2(integer) IS 'Current enhanced slider function with collection filtering (v2)';
COMMENT ON FUNCTION public.find_optimal_same_collection_matchup_v2(text, integer) IS 'Current enhanced same-collection matchup function with collection filtering (v2)';
COMMENT ON FUNCTION public.find_optimal_cross_collection_matchup_v2(integer) IS 'Current enhanced cross-collection matchup function with collection filtering (v2)';
