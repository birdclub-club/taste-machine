-- Simple Collection Diversity Fix
-- Add collection-aware weighting to ensure diversity

-- Update the bootstrap POA calculation to include collection diversity bonus
DROP FUNCTION IF EXISTS public.calculate_bootstrap_poa(
  current_elo DOUBLE PRECISION,
  slider_average DOUBLE PRECISION,
  slider_count INTEGER,
  total_votes INTEGER,
  wins INTEGER,
  losses INTEGER,
  fire_votes BIGINT
) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_bootstrap_poa(
  current_elo DOUBLE PRECISION,
  slider_average DOUBLE PRECISION,
  slider_count INTEGER,
  total_votes INTEGER,
  wins INTEGER,
  losses INTEGER,
  fire_votes BIGINT,
  collection_name TEXT DEFAULT 'Unknown'
)
RETURNS TABLE(
  poa_score NUMERIC(5,2),
  confidence_score NUMERIC(5,2),
  confidence_level TEXT,
  algorithm TEXT
) AS $$
DECLARE
  elo_component NUMERIC;
  slider_component NUMERIC;
  win_rate_component NUMERIC;
  fire_component NUMERIC;
  collection_bonus NUMERIC;
  base_score NUMERIC;
  confidence NUMERIC;
BEGIN
  -- Bootstrap algorithm: Emphasizes FIRE votes and early engagement
  elo_component := LEAST(GREATEST((current_elo - 800.0) / 600.0 * 100.0, 0), 100) * 0.30;
  slider_component := COALESCE(slider_average, 50.0) * 0.20;
  win_rate_component := CASE 
    WHEN total_votes > 0 THEN (wins::NUMERIC / total_votes::NUMERIC) * 100.0 * 0.10
    ELSE 50.0 * 0.10
  END;
  fire_component := LEAST(fire_votes * 25.0, 50.0) * 0.35; -- Reduced from 40% to 35%
  
  -- Collection diversity bonus (5% of total score)
  collection_bonus := CASE 
    WHEN collection_name IN ('BEEISH', 'RUYUI', 'Pengztracted') THEN 3.0  -- Boost underrepresented collections
    WHEN collection_name IN ('Canna Sapiens', 'Final Bosu', 'Fugz', 'Kabu') THEN 2.0
    WHEN collection_name = 'BEARISH' THEN -1.0  -- Slight penalty to reduce BEARISH dominance
    ELSE 0.0
  END;
  
  base_score := elo_component + slider_component + win_rate_component + fire_component + collection_bonus;
  
  -- Bootstrap confidence calculation (generous for sparse data)
  confidence := LEAST(100.0,
    (LEAST(total_votes::NUMERIC / 3.0, 1.0) * 40.0) +
    (LEAST(slider_count::NUMERIC / 2.0, 1.0) * 30.0) +
    (LEAST(fire_votes::NUMERIC / 1.0, 1.0) * 30.0)
  );
  
  RETURN QUERY SELECT
    base_score as poa_score,
    confidence as confidence_score,
    CASE 
      WHEN total_votes >= 3 AND (slider_count >= 1 OR fire_votes >= 1) THEN 'HIGH'
      WHEN total_votes >= 2 OR slider_count >= 1 OR fire_votes >= 1 THEN 'MEDIUM'
      WHEN total_votes >= 1 THEN 'LOW'
      ELSE 'INSUFFICIENT'
    END as confidence_level,
    'BOOTSTRAP'::TEXT as algorithm;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update the leaderboard function to pass collection name
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
      (n.wins::NUMERIC / NULLIF(n.total_votes, 0)) * 100 as win_percentage
    FROM public.nfts n
    LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
    CROSS JOIN LATERAL public.calculate_bootstrap_poa(
      n.current_elo,
      n.slider_average,
      n.slider_count,
      n.total_votes,
      n.wins,
      n.losses,
      COALESCE(f.fire_count, 0),
      n.collection_name  -- Pass collection name for diversity bonus
    ) poa
    WHERE n.current_elo IS NOT NULL
      AND (n.total_votes >= 1 OR n.slider_count >= 1 OR f.fire_count > 0)
  ),
  ranked_nfts AS (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY calculated_poa_score DESC, RANDOM()) as position
    FROM nft_poa_scores
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
  FROM ranked_nfts r
  WHERE r.position <= limit_count
  ORDER BY r.position;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test the collection diversity
SELECT 
  'Collection Diversity Test' as test_name,
  collection_name,
  COUNT(*) as nfts_in_top_20,
  ROUND(AVG(poa_score), 2) as avg_poa_score
FROM public.get_dynamic_leaderboard_lightweight(20)
GROUP BY collection_name
ORDER BY COUNT(*) DESC;
