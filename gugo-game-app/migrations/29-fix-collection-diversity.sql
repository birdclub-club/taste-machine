-- Fix Collection Diversity in Dynamic POA System
-- Ensure leaderboard shows diverse collections, not just BEARISH

-- Replace the leaderboard function with collection-aware scoring
DROP FUNCTION IF EXISTS public.get_dynamic_leaderboard_lightweight(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.get_dynamic_leaderboard_lightweight(limit_count INTEGER DEFAULT 20)
RETURNS TABLE(
  id UUID,
  token_id TEXT,
  name TEXT,
  image TEXT,
  collection_name TEXT,
  contract_address TEXT,
  current_elo DOUBLE PRECISION,
  slider_average DOUBLE PRECISION,
  slider_count INTEGER,
  total_votes INTEGER,
  wins INTEGER,
  losses INTEGER,
  fire_votes BIGINT,
  poa_score NUMERIC(5,2),
  confidence_score NUMERIC(5,2),
  confidence_level TEXT,
  algorithm TEXT,
  system_mode TEXT,
  leaderboard_position BIGINT,
  win_percentage NUMERIC(5,2)
) AS $$
DECLARE
  current_mode TEXT;
BEGIN
  -- Get current system mode
  SELECT mode INTO current_mode FROM public.get_poa_system_mode() LIMIT 1;
  
  RETURN QUERY
  WITH nft_fire_votes AS (
    SELECT 
      nft_id::uuid as nft_uuid,
      COUNT(*) as fire_count
    FROM public.favorites 
    WHERE vote_type = 'fire'
    GROUP BY nft_id::uuid
  ),
  nft_poa_scores AS (
    SELECT 
      n.id as nft_id,
      n.token_id as nft_token_id,
      n.name as nft_name,
      n.image as nft_image,
      n.collection_name as nft_collection_name,
      n.contract_address as nft_contract_address,
      n.current_elo as nft_current_elo,
      n.slider_average as nft_slider_average,
      n.slider_count as nft_slider_count,
      n.total_votes as nft_total_votes,
      n.wins as nft_wins,
      n.losses as nft_losses,
      COALESCE(f.fire_count, 0) as nft_fire_votes,
      poa.poa_score as calculated_poa_score,
      poa.confidence_score as calculated_confidence_score,
      poa.confidence_level as calculated_confidence_level,
      poa.algorithm as calculated_algorithm,
      current_mode as calculated_system_mode,
      (n.wins::NUMERIC / NULLIF(n.total_votes, 0)) * 100 as calculated_win_percentage
    FROM public.nfts n
    LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
    CROSS JOIN LATERAL public.calculate_bootstrap_poa(
      n.current_elo,
      n.slider_average,
      n.slider_count,
      n.total_votes,
      n.wins,
      n.losses,
      COALESCE(f.fire_count, 0)
    ) poa
    WHERE n.current_elo IS NOT NULL
      AND (n.total_votes >= 1 OR n.slider_count >= 1 OR f.fire_count > 0)
  ),
  -- Get top performers from each major collection to ensure diversity
  top_per_collection AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY nft_collection_name ORDER BY calculated_poa_score DESC, RANDOM()) as collection_rank
    FROM nft_poa_scores
  ),
  -- Combine top performers with overall top scores
  diverse_candidates AS (
    -- Top 2 from each collection
    SELECT * FROM top_per_collection WHERE collection_rank <= 2
    UNION ALL
    -- Overall top performers
    SELECT *, 1 as collection_rank FROM nft_poa_scores 
    ORDER BY calculated_poa_score DESC, RANDOM()
    LIMIT 50
  ),
  -- Remove duplicates and rank globally
  final_ranking AS (
    SELECT DISTINCT ON (nft_id)
      *
    FROM diverse_candidates
    ORDER BY nft_id, calculated_poa_score DESC
  ),
  ranked_nfts AS (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY calculated_poa_score DESC, RANDOM()) as position
    FROM final_ranking
  )
  SELECT 
    r.nft_id,
    r.nft_token_id,
    r.nft_name,
    r.nft_image,
    r.nft_collection_name,
    r.nft_contract_address,
    r.nft_current_elo,
    r.nft_slider_average,
    r.nft_slider_count,
    r.nft_total_votes,
    r.nft_wins,
    r.nft_losses,
    r.nft_fire_votes,
    r.calculated_poa_score,
    r.calculated_confidence_score,
    r.calculated_confidence_level,
    r.calculated_algorithm,
    r.calculated_system_mode,
    r.position as leaderboard_position,
    r.calculated_win_percentage
  FROM ranked_nfts r
  WHERE r.position <= limit_count
  ORDER BY r.position;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test the collection diversity fix
SELECT 
  'Collection Diversity Test' as test_name,
  collection_name,
  COUNT(*) as nfts_in_top_20,
  AVG(poa_score) as avg_poa_score
FROM public.get_dynamic_leaderboard_lightweight(20)
GROUP BY collection_name
ORDER BY COUNT(*) DESC;
