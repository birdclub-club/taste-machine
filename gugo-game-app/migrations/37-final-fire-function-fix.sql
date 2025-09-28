-- FINAL FIX: Create a NEW function with a different name to bypass caching

-- Drop all old leaderboard functions
DROP FUNCTION IF EXISTS public.get_dynamic_leaderboard_lightweight(INTEGER) CASCADE;

-- Create the NEW FIRE-FIRST function with a different name
CREATE OR REPLACE FUNCTION public.get_fire_first_leaderboard_v2(limit_count INTEGER DEFAULT 20)
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
BEGIN
  RETURN QUERY
  WITH nft_fire_votes AS (
    SELECT 
      nft_id as nft_uuid,
      COUNT(*) as fire_count
    FROM public.favorites 
    WHERE vote_type = 'fire'
    GROUP BY nft_id
  ),
  all_nft_scores AS (
    SELECT 
      n.id,
      n.token_id,
      n.name,
      n.image,
      n.collection_name,
      n.contract_address,
      n.current_elo,
      n.slider_average,
      n.slider_count,
      n.total_votes,
      n.wins,
      n.losses,
      COALESCE(f.fire_count, 0) as fire_votes_calc,
      poa.poa_score as calculated_poa_score,
      poa.confidence_score as calculated_confidence_score,
      poa.confidence_level as calculated_confidence_level,
      poa.algorithm as calculated_algorithm,
      'BOOTSTRAP' as system_mode,
      (n.wins::NUMERIC / NULLIF(n.total_votes, 0)) * 100 as win_percentage,
      -- FIRE-FIRST priority system
      CASE 
        WHEN COALESCE(f.fire_count, 0) >= 3 THEN 1200 + (poa.poa_score * 10)  -- Triple+ FIRE
        WHEN COALESCE(f.fire_count, 0) >= 2 THEN 1100 + (poa.poa_score * 10)  -- Double FIRE
        WHEN COALESCE(f.fire_count, 0) >= 1 THEN 1000 + (poa.poa_score * 10)  -- Single FIRE
        WHEN n.total_votes >= 15 THEN 800 + (poa.poa_score * 10)              -- Very high engagement
        WHEN n.total_votes >= 10 THEN 750 + (poa.poa_score * 10)              -- High engagement
        WHEN n.total_votes >= 7 THEN 700 + (poa.poa_score * 10)               -- Good engagement
        WHEN n.total_votes >= 5 THEN 650 + (poa.poa_score * 10)               -- Medium engagement
        WHEN n.total_votes >= 3 THEN 600 + (poa.poa_score * 10)               -- Low engagement
        WHEN n.total_votes >= 2 THEN 550 + (poa.poa_score * 10)               -- Minimal engagement
        ELSE 500 + (poa.poa_score * 10)                                       -- Single vote
      END as priority_score
    FROM public.nfts n
    LEFT JOIN nft_fire_votes f ON n.id::text = f.nft_uuid
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
      AND (
        -- FIRE votes override all other requirements
        COALESCE(f.fire_count, 0) > 0 
        OR 
        -- OR normal engagement requirements
        (n.total_votes >= 1 OR n.slider_count >= 1)
      )
  ),
  ranked_nfts AS (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY priority_score DESC, RANDOM()) as position
    FROM all_nft_scores
  )
  SELECT 
    r.id,
    r.token_id,
    r.name,
    r.image,
    r.collection_name,
    r.contract_address,
    r.current_elo,
    r.slider_average,
    r.slider_count,
    r.total_votes,
    r.wins,
    r.losses,
    r.fire_votes_calc as fire_votes,  -- CRITICAL: Map fire_votes correctly
    r.calculated_poa_score as poa_score,
    r.calculated_confidence_score as confidence_score,
    r.calculated_confidence_level as confidence_level,
    r.calculated_algorithm as algorithm,
    r.system_mode,
    r.position as leaderboard_position,
    r.win_percentage
  FROM ranked_nfts r
  WHERE r.position <= limit_count
  ORDER BY r.position;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test the new function
SELECT 
  'NEW FIRE FUNCTION TEST' as test_type,
  leaderboard_position,
  name,
  collection_name,
  total_votes,
  fire_votes,
  poa_score,
  CASE 
    WHEN fire_votes >= 1 THEN '🔥 FIRE TIER'
    WHEN total_votes >= 10 THEN 'High Engagement'
    WHEN total_votes >= 5 THEN 'Medium Engagement'
    ELSE 'Lower Tiers'
  END as expected_tier
FROM public.get_fire_first_leaderboard_v2(10)
ORDER BY leaderboard_position;
