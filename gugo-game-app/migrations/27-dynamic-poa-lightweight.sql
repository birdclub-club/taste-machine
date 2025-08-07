-- Lightweight Dynamic POA System - Incremental Deployment
-- This version creates the system without the heavy materialized view

-- System configuration table for POA thresholds
DROP TABLE IF EXISTS public.poa_system_config CASCADE;

CREATE TABLE public.poa_system_config (
  id SERIAL PRIMARY KEY,
  config_name TEXT UNIQUE NOT NULL,
  threshold_value INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default thresholds
INSERT INTO public.poa_system_config (config_name, threshold_value) VALUES
('min_meaningful_nfts_for_mature', 1000),
('min_fire_votes_for_mature', 50),
('min_high_confidence_nfts', 25);

-- Function to determine which POA algorithm to use
DROP FUNCTION IF EXISTS public.get_poa_system_mode() CASCADE;

CREATE OR REPLACE FUNCTION public.get_poa_system_mode()
RETURNS TABLE(
  mode TEXT,
  reason TEXT,
  stats JSON
) AS $$
DECLARE
  meaningful_nfts INTEGER;
  total_fire_votes INTEGER;
  high_confidence_nfts INTEGER;
  min_meaningful INTEGER;
  min_fire INTEGER;
  min_high_conf INTEGER;
  current_stats JSON;
BEGIN
  -- Get current thresholds
  SELECT threshold_value INTO min_meaningful FROM public.poa_system_config WHERE config_name = 'min_meaningful_nfts_for_mature';
  SELECT threshold_value INTO min_fire FROM public.poa_system_config WHERE config_name = 'min_fire_votes_for_mature';
  SELECT threshold_value INTO min_high_conf FROM public.poa_system_config WHERE config_name = 'min_high_confidence_nfts';
  
  -- Count current ecosystem stats (optimized queries)
  SELECT COUNT(*) INTO meaningful_nfts
  FROM public.nfts n
  WHERE n.total_votes >= 2 OR n.slider_count >= 1
  LIMIT 2000; -- Limit for performance
  
  SELECT COUNT(*) INTO total_fire_votes
  FROM public.favorites WHERE vote_type = 'fire';
  
  SELECT COUNT(*) INTO high_confidence_nfts
  FROM public.nfts n
  WHERE n.total_votes >= 5 AND n.slider_count >= 2
  LIMIT 100; -- Limit for performance
  
  -- Build stats object
  current_stats := json_build_object(
    'meaningful_nfts', meaningful_nfts,
    'total_fire_votes', total_fire_votes,
    'high_confidence_nfts', high_confidence_nfts,
    'thresholds', json_build_object(
      'min_meaningful', min_meaningful,
      'min_fire', min_fire,
      'min_high_conf', min_high_conf
    )
  );
  
  -- Determine mode (will be BOOTSTRAP for now)
  RETURN QUERY SELECT 
    'BOOTSTRAP'::TEXT as mode,
    format('Bootstrap mode: %s/%s meaningful NFTs, %s/%s FIRE votes, %s/%s high confidence', 
           meaningful_nfts, min_meaningful, total_fire_votes, min_fire, high_confidence_nfts, min_high_conf)::TEXT as reason,
    current_stats;
END;
$$ LANGUAGE plpgsql STABLE;

-- Bootstrap POA algorithm (optimized for sparse data)
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
  fire_votes BIGINT
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
  fire_component := LEAST(fire_votes * 25.0, 50.0) * 0.40; -- Heavy FIRE weighting
  
  base_score := elo_component + slider_component + win_rate_component + fire_component;
  
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

-- Lightweight leaderboard function (no materialized view)
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
      poa.poa_score,
      poa.confidence_score,
      poa.confidence_level,
      poa.algorithm,
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
      COALESCE(f.fire_count, 0)
    ) poa
    WHERE n.current_elo IS NOT NULL
      AND (n.total_votes >= 1 OR n.slider_count >= 1 OR f.fire_count > 0)
    ORDER BY poa.poa_score DESC, RANDOM()
    LIMIT limit_count * 2 -- Get extra for ranking
  ),
  ranked_nfts AS (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY poa_score DESC, RANDOM()) as position
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
    r.poa_score,
    r.confidence_score,
    r.confidence_level,
    r.algorithm,
    r.system_mode,
    r.position as leaderboard_position,
    r.win_percentage
  FROM ranked_nfts r
  WHERE r.position <= limit_count
  ORDER BY r.position;
END;
$$ LANGUAGE plpgsql STABLE;

-- System status function
DROP FUNCTION IF EXISTS public.dynamic_poa_system_status_lightweight() CASCADE;

CREATE OR REPLACE FUNCTION public.dynamic_poa_system_status_lightweight()
RETURNS JSON AS $$
DECLARE
  result JSON;
  mode_info RECORD;
BEGIN
  SELECT * INTO mode_info FROM public.get_poa_system_mode() LIMIT 1;
  
  SELECT json_build_object(
    'current_mode', mode_info.mode,
    'reason', mode_info.reason,
    'ecosystem_stats', mode_info.stats,
    'status', 'Lightweight system active - no materialized view',
    'next_milestone', json_build_object(
      'target', 'MATURE algorithm activation',
      'requirements', json_build_object(
        'meaningful_nfts', '1000+ (current: ' || (mode_info.stats->>'meaningful_nfts') || ')',
        'fire_votes', '50+ (current: ' || (mode_info.stats->>'total_fire_votes') || ')',
        'high_confidence_nfts', '25+ (current: ' || (mode_info.stats->>'high_confidence_nfts') || ')'
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test the lightweight system
SELECT 
  'Lightweight Dynamic POA System' as test_name,
  (SELECT mode FROM public.get_poa_system_mode() LIMIT 1) as current_mode,
  'Ready for API integration' as status;
