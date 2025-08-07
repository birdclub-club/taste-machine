-- Dynamic POA System: Bootstrap → Mature Algorithm Transition
-- Automatically switches scoring algorithms based on ecosystem data maturity

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
('min_meaningful_nfts_for_mature', 1000),    -- Switch when 1000+ NFTs have meaningful data
('min_fire_votes_for_mature', 50),           -- Switch when 50+ total FIRE votes exist
('min_high_confidence_nfts', 25);            -- Switch when 25+ NFTs reach high confidence

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
  
  -- Count current ecosystem stats
  SELECT COUNT(*) INTO meaningful_nfts
  FROM public.nfts n
  WHERE n.total_votes >= 2 OR n.slider_count >= 1 OR 
        EXISTS (SELECT 1 FROM public.favorites f WHERE f.nft_id::uuid = n.id AND f.vote_type = 'fire');
  
  SELECT COUNT(*) INTO total_fire_votes
  FROM public.favorites WHERE vote_type = 'fire';
  
  SELECT COUNT(*) INTO high_confidence_nfts
  FROM public.nfts n
  WHERE n.total_votes >= 5 AND (n.slider_count >= 2 OR 
        EXISTS (SELECT 1 FROM public.favorites f WHERE f.nft_id::uuid = n.id AND f.vote_type = 'fire'));
  
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
  
  -- Determine mode
  IF meaningful_nfts >= min_meaningful AND total_fire_votes >= min_fire AND high_confidence_nfts >= min_high_conf THEN
    RETURN QUERY SELECT 
      'MATURE'::TEXT as mode,
      'Ecosystem has sufficient data for mature POA algorithm'::TEXT as reason,
      current_stats;
  ELSE
    RETURN QUERY SELECT 
      'BOOTSTRAP'::TEXT as mode,
      format('Bootstrap mode: %s/%s meaningful NFTs, %s/%s FIRE votes, %s/%s high confidence', 
             meaningful_nfts, min_meaningful, total_fire_votes, min_fire, high_confidence_nfts, min_high_conf)::TEXT as reason,
      current_stats;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Bootstrap POA algorithm (current system optimized for sparse data)
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

-- Mature POA algorithm (for when ecosystem has rich data)
DROP FUNCTION IF EXISTS public.calculate_mature_poa(
  current_elo DOUBLE PRECISION,
  slider_average DOUBLE PRECISION,
  slider_count INTEGER,
  total_votes INTEGER,
  wins INTEGER,
  losses INTEGER,
  fire_votes BIGINT
) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_mature_poa(
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
  consistency_bonus NUMERIC;
  data_richness_bonus NUMERIC;
  base_score NUMERIC;
  confidence NUMERIC;
BEGIN
  -- Mature algorithm: More sophisticated with consistency and data richness factors
  elo_component := LEAST(GREATEST((current_elo - 800.0) / 800.0 * 100.0, 0), 100) * 0.40;
  slider_component := COALESCE(slider_average, 50.0) * 0.25;
  win_rate_component := CASE 
    WHEN total_votes > 0 THEN (wins::NUMERIC / total_votes::NUMERIC) * 100.0 * 0.20
    ELSE 50.0 * 0.20
  END;
  fire_component := LEAST(fire_votes * 15.0, 30.0) * 0.15; -- Lower FIRE weighting when data is rich
  
  -- Consistency bonus (rewards consistent performance across metrics)
  consistency_bonus := CASE
    WHEN total_votes >= 10 AND slider_count >= 5 AND fire_votes >= 2 THEN 5.0
    WHEN total_votes >= 7 AND slider_count >= 3 AND fire_votes >= 1 THEN 3.0
    WHEN total_votes >= 5 AND (slider_count >= 2 OR fire_votes >= 1) THEN 1.0
    ELSE 0.0
  END;
  
  -- Data richness bonus (rewards having diverse data types)
  data_richness_bonus := CASE
    WHEN total_votes >= 15 AND slider_count >= 8 AND fire_votes >= 3 THEN 3.0
    WHEN total_votes >= 10 AND slider_count >= 5 AND fire_votes >= 2 THEN 2.0
    WHEN total_votes >= 8 AND slider_count >= 3 AND fire_votes >= 1 THEN 1.0
    ELSE 0.0
  END;
  
  base_score := elo_component + slider_component + win_rate_component + fire_component + consistency_bonus + data_richness_bonus;
  
  -- Mature confidence calculation (stricter requirements)
  confidence := LEAST(100.0,
    (LEAST(total_votes::NUMERIC / 10.0, 1.0) * 50.0) +
    (LEAST(slider_count::NUMERIC / 5.0, 1.0) * 30.0) +
    (LEAST(fire_votes::NUMERIC / 2.0, 1.0) * 20.0)
  );
  
  RETURN QUERY SELECT
    base_score as poa_score,
    confidence as confidence_score,
    CASE 
      WHEN total_votes >= 10 AND slider_count >= 3 AND fire_votes >= 1 THEN 'HIGH'
      WHEN total_votes >= 7 AND (slider_count >= 2 OR fire_votes >= 1) THEN 'MEDIUM'
      WHEN total_votes >= 5 OR slider_count >= 2 OR fire_votes >= 1 THEN 'LOW'
      ELSE 'INSUFFICIENT'
    END as confidence_level,
    'MATURE'::TEXT as algorithm;
END;
$$ LANGUAGE plpgsql STABLE;

-- Dynamic POA calculator that chooses the right algorithm
DROP FUNCTION IF EXISTS public.calculate_dynamic_poa(
  current_elo DOUBLE PRECISION,
  slider_average DOUBLE PRECISION,
  slider_count INTEGER,
  total_votes INTEGER,
  wins INTEGER,
  losses INTEGER,
  fire_votes BIGINT
) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_dynamic_poa(
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
  system_mode TEXT;
BEGIN
  -- Get current system mode
  SELECT mode INTO system_mode FROM public.get_poa_system_mode() LIMIT 1;
  
  -- Route to appropriate algorithm
  IF system_mode = 'MATURE' THEN
    RETURN QUERY 
    SELECT * FROM public.calculate_mature_poa(
      current_elo, slider_average, slider_count, total_votes, wins, losses, fire_votes
    );
  ELSE
    RETURN QUERY 
    SELECT * FROM public.calculate_bootstrap_poa(
      current_elo, slider_average, slider_count, total_votes, wins, losses, fire_votes
    );
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create dynamic leaderboard view
DROP MATERIALIZED VIEW IF EXISTS public.dynamic_leaderboard_view CASCADE;

CREATE MATERIALIZED VIEW public.dynamic_leaderboard_view AS
WITH system_info AS (
  SELECT mode, reason, stats FROM public.get_poa_system_mode() LIMIT 1
),
nft_fire_votes AS (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_votes
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
),
nft_poa_scores AS (
  SELECT 
    n.*,
    COALESCE(f.fire_votes, 0) as fire_votes,
    poa.*,
    si.mode as system_mode,
    si.reason as system_reason
  FROM public.nfts n
  LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
  CROSS JOIN system_info si
  CROSS JOIN LATERAL public.calculate_dynamic_poa(
    n.current_elo,
    n.slider_average,
    n.slider_count,
    n.total_votes,
    n.wins,
    n.losses,
    COALESCE(f.fire_votes, 0)
  ) poa
  WHERE n.current_elo IS NOT NULL
),
meaningful_nfts AS (
  SELECT *
  FROM nft_poa_scores
  WHERE confidence_level != 'INSUFFICIENT'
),
ranked_nfts AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (ORDER BY poa_score DESC, random()) as leaderboard_position
  FROM meaningful_nfts
)
SELECT 
  id,
  token_id,
  name,
  image,
  collection_name,
  contract_address,
  current_elo,
  slider_average,
  slider_count,
  total_votes,
  wins,
  losses,
  fire_votes,
  poa_score,
  confidence_score,
  confidence_level,
  algorithm,
  system_mode,
  system_reason,
  leaderboard_position,
  (wins::NUMERIC / NULLIF(total_votes, 0)) * 100 as win_percentage
FROM ranked_nfts
ORDER BY leaderboard_position;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_dynamic_leaderboard_position 
ON public.dynamic_leaderboard_view(leaderboard_position);

-- Dynamic leaderboard function
DROP FUNCTION IF EXISTS public.get_dynamic_leaderboard(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.get_dynamic_leaderboard(limit_count INTEGER DEFAULT 20)
RETURNS SETOF public.dynamic_leaderboard_view AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.dynamic_leaderboard_view
  WHERE leaderboard_position <= limit_count
  ORDER BY leaderboard_position ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- System status and stats
DROP FUNCTION IF EXISTS public.dynamic_poa_system_status() CASCADE;

CREATE OR REPLACE FUNCTION public.dynamic_poa_system_status()
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
    'leaderboard_stats', (
      SELECT json_build_object(
        'total_meaningful_nfts', COUNT(*),
        'algorithm_distribution', (
          SELECT json_agg(
            json_build_object(
              'algorithm', algorithm,
              'count', count
            )
          )
          FROM (
            SELECT algorithm, COUNT(*) as count
            FROM public.dynamic_leaderboard_view
            GROUP BY algorithm
          ) alg_dist
        ),
        'confidence_distribution', (
          SELECT json_agg(
            json_build_object(
              'level', confidence_level,
              'count', count,
              'avg_poa_score', avg_score
            )
          )
          FROM (
            SELECT 
              confidence_level,
              COUNT(*) as count,
              AVG(poa_score) as avg_score
            FROM public.dynamic_leaderboard_view
            GROUP BY confidence_level
            ORDER BY 
              CASE confidence_level
                WHEN 'HIGH' THEN 1
                WHEN 'MEDIUM' THEN 2
                WHEN 'LOW' THEN 3
                ELSE 4
              END
          ) conf_dist
        )
      )
      FROM public.dynamic_leaderboard_view
    ),
    'next_milestone', (
      CASE mode_info.mode
        WHEN 'BOOTSTRAP' THEN json_build_object(
          'target', 'MATURE algorithm activation',
          'requirements', json_build_object(
            'meaningful_nfts', '1000+ (current: ' || (mode_info.stats->>'meaningful_nfts') || ')',
            'fire_votes', '50+ (current: ' || (mode_info.stats->>'total_fire_votes') || ')',
            'high_confidence_nfts', '25+ (current: ' || (mode_info.stats->>'high_confidence_nfts') || ')'
          )
        )
        ELSE json_build_object(
          'status', 'Mature algorithm active',
          'description', 'System has reached full maturity'
        )
      END
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.dynamic_leaderboard_view;

-- Test the dynamic system
SELECT 
  'Dynamic POA System Status' as test_name,
  (SELECT mode FROM public.get_poa_system_mode() LIMIT 1) as current_mode,
  COUNT(*) as meaningful_nfts,
  AVG(poa_score) as avg_poa_score,
  COUNT(CASE WHEN algorithm = 'BOOTSTRAP' THEN 1 END) as bootstrap_nfts,
  COUNT(CASE WHEN algorithm = 'MATURE' THEN 1 END) as mature_nfts
FROM public.dynamic_leaderboard_view;
