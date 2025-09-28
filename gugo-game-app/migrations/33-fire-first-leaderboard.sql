-- FIRE-First Leaderboard System
-- Prioritizes FIRE votes (aesthetic curation) over single-vote wins

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
      COALESCE(f.fire_count, 0) as fire_votes,
      poa.poa_score as calculated_poa_score,
      poa.confidence_score as calculated_confidence_score,
      poa.confidence_level as calculated_confidence_level,
      poa.algorithm as calculated_algorithm,
      current_mode as system_mode,
      (n.wins::NUMERIC / NULLIF(n.total_votes, 0)) * 100 as win_percentage,
      -- Create priority tiers
      CASE 
        WHEN COALESCE(f.fire_count, 0) >= 1 THEN 1  -- FIRE tier (highest priority)
        WHEN n.total_votes >= 5 THEN 2              -- High vote tier
        WHEN n.total_votes >= 3 THEN 3              -- Medium vote tier
        WHEN n.total_votes >= 2 THEN 4              -- Low vote tier
        ELSE 5                                      -- Single vote tier (lowest priority)
      END as priority_tier
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
  -- Tier-based selection ensuring FIRE votes get top spots
  prioritized_selection AS (
    -- TIER 1: ALL FIRE-voted NFTs (guaranteed top spots)
    (SELECT * FROM all_nft_scores WHERE priority_tier = 1 ORDER BY calculated_poa_score DESC LIMIT 10)
    UNION ALL
    -- TIER 2: High vote count NFTs (5+ votes)
    (SELECT * FROM all_nft_scores WHERE priority_tier = 2 ORDER BY calculated_poa_score DESC LIMIT 5)
    UNION ALL
    -- TIER 3: Medium vote count NFTs (3-4 votes) 
    (SELECT * FROM all_nft_scores WHERE priority_tier = 3 ORDER BY calculated_poa_score DESC LIMIT 3)
    UNION ALL
    -- TIER 4: Low vote count NFTs (2 votes)
    (SELECT * FROM all_nft_scores WHERE priority_tier = 4 ORDER BY calculated_poa_score DESC LIMIT 2)
    UNION ALL
    -- TIER 5: Single vote NFTs (only if we need to fill slots)
    (SELECT * FROM all_nft_scores WHERE priority_tier = 5 ORDER BY calculated_poa_score DESC LIMIT 5)
  ),
  -- Ensure collection diversity within tiers
  diverse_prioritized AS (
    SELECT DISTINCT ON (id)
      *,
      ROW_NUMBER() OVER (
        ORDER BY 
          priority_tier ASC,           -- FIRE first, then by vote count
          calculated_poa_score DESC,   -- Then by POA score
          RANDOM()                     -- Random tie-breaker
      ) as position
    FROM prioritized_selection
    ORDER BY id, priority_tier ASC, calculated_poa_score DESC
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
    r.fire_votes,
    r.calculated_poa_score as poa_score,
    r.calculated_confidence_score as confidence_score,
    r.calculated_confidence_level as confidence_level,
    r.calculated_algorithm as algorithm,
    r.system_mode,
    r.position as leaderboard_position,
    r.win_percentage
  FROM diverse_prioritized r
  WHERE r.position <= limit_count
  ORDER BY r.position;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test the FIRE-first system
WITH tier_analysis AS (
  SELECT 
    *,
    CASE 
      WHEN fire_votes >= 1 THEN 'FIRE Tier'
      WHEN total_votes >= 5 THEN 'High Vote Tier'
      WHEN total_votes >= 3 THEN 'Medium Vote Tier'
      WHEN total_votes >= 2 THEN 'Low Vote Tier'
      ELSE 'Single Vote Tier'
    END as tier,
    CASE 
      WHEN fire_votes >= 1 THEN 1
      WHEN total_votes >= 5 THEN 2
      WHEN total_votes >= 3 THEN 3
      WHEN total_votes >= 2 THEN 4
      ELSE 5
    END as tier_order
  FROM public.get_dynamic_leaderboard_lightweight(20)
)
SELECT 
  'FIRE-First Leaderboard Test' as test_name,
  tier,
  collection_name,
  COUNT(*) as nfts_count,
  ROUND(AVG(poa_score), 2) as avg_poa_score,
  SUM(fire_votes) as total_fire_votes
FROM tier_analysis
GROUP BY tier, collection_name, tier_order
ORDER BY tier_order, COUNT(*) DESC;
