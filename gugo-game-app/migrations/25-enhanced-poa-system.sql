-- Enhanced POA System with Realistic Confidence Thresholds
-- Based on actual data distribution analysis

-- First, let's create a more realistic confidence system
DROP FUNCTION IF EXISTS public.calculate_poa_confidence(INTEGER, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_poa_confidence(
  total_votes INTEGER,
  slider_count INTEGER, 
  fire_votes INTEGER
)
RETURNS TABLE(
  confidence_score NUMERIC(5,2),
  confidence_level TEXT,
  is_meaningful BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Confidence Score (0-100)
    LEAST(100.0, 
      (LEAST(total_votes::NUMERIC / 5.0, 1.0) * 50.0) +           -- 50% from vote volume
      (LEAST(slider_count::NUMERIC / 3.0, 1.0) * 30.0) +         -- 30% from slider data  
      (LEAST(fire_votes::NUMERIC / 1.0, 1.0) * 20.0)             -- 20% from FIRE votes
    ) as confidence_score,
    
    -- Confidence Level
    CASE 
      WHEN total_votes >= 5 AND (slider_count >= 2 OR fire_votes >= 1) THEN 'HIGH'
      WHEN total_votes >= 3 AND (slider_count >= 1 OR fire_votes >= 1) THEN 'MEDIUM' 
      WHEN total_votes >= 2 OR slider_count >= 1 OR fire_votes >= 1 THEN 'LOW'
      ELSE 'INSUFFICIENT'
    END as confidence_level,
    
    -- Is Meaningful (should appear on leaderboard)
    CASE 
      WHEN total_votes >= 2 OR slider_count >= 1 OR fire_votes >= 1 THEN true
      ELSE false
    END as is_meaningful;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enhanced POA calculation with confidence weighting
DROP FUNCTION IF EXISTS public.calculate_enhanced_poa(
  current_elo NUMERIC,
  slider_average NUMERIC,
  slider_count INTEGER,
  total_votes INTEGER,
  wins INTEGER,
  losses INTEGER,
  fire_votes INTEGER
) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_enhanced_poa(
  current_elo NUMERIC,
  slider_average NUMERIC, 
  slider_count INTEGER,
  total_votes INTEGER,
  wins INTEGER,
  losses INTEGER,
  fire_votes INTEGER
)
RETURNS TABLE(
  poa_score NUMERIC(5,2),
  raw_score NUMERIC(5,2),
  confidence_weighted_score NUMERIC(5,2),
  confidence_score NUMERIC(5,2),
  confidence_level TEXT,
  is_meaningful BOOLEAN
) AS $$
DECLARE
  elo_normalized NUMERIC;
  slider_normalized NUMERIC; 
  win_rate NUMERIC;
  fire_component NUMERIC;
  raw_poa NUMERIC;
  conf_data RECORD;
BEGIN
  -- Normalize components (0-100 scale)
  elo_normalized := LEAST(GREATEST((current_elo - 800.0) / 600.0 * 100.0, 0), 100);
  slider_normalized := COALESCE(slider_average, 50.0);
  win_rate := CASE 
    WHEN total_votes > 0 THEN (wins::NUMERIC / total_votes::NUMERIC) * 100.0 
    ELSE 50.0 
  END;
  fire_component := LEAST(fire_votes * 20.0, 40.0); -- 20 points per FIRE, max 40
  
  -- Calculate raw POA score
  raw_poa := (elo_normalized * 0.35) +     -- 35% Elo
             (slider_normalized * 0.25) +  -- 25% Slider
             (win_rate * 0.15) +           -- 15% Win Rate  
             (fire_component * 0.25);      -- 25% FIRE votes
  
  -- Get confidence data
  SELECT * INTO conf_data 
  FROM public.calculate_poa_confidence(total_votes, slider_count, fire_votes);
  
  -- Apply confidence weighting (scale down if low confidence)
  RETURN QUERY
  SELECT 
    -- Final POA score (confidence-weighted)
    CASE 
      WHEN conf_data.confidence_level = 'HIGH' THEN raw_poa
      WHEN conf_data.confidence_level = 'MEDIUM' THEN raw_poa * 0.9
      WHEN conf_data.confidence_level = 'LOW' THEN raw_poa * 0.8
      ELSE raw_poa * 0.7
    END as poa_score,
    
    raw_poa as raw_score,
    
    -- Confidence-weighted score for comparison
    raw_poa * (conf_data.confidence_score / 100.0) as confidence_weighted_score,
    
    conf_data.confidence_score,
    conf_data.confidence_level,
    conf_data.is_meaningful;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create enhanced leaderboard view with new POA system
DROP MATERIALIZED VIEW IF EXISTS public.enhanced_leaderboard_view CASCADE;

CREATE MATERIALIZED VIEW public.enhanced_leaderboard_view AS
WITH nft_fire_votes AS (
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
    poa.*
  FROM public.nfts n
  LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
  CROSS JOIN LATERAL public.calculate_enhanced_poa(
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
  WHERE is_meaningful = true
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
  raw_score,
  confidence_weighted_score,
  confidence_score,
  confidence_level,
  is_meaningful,
  leaderboard_position,
  (wins::NUMERIC / NULLIF(total_votes, 0)) * 100 as win_percentage
FROM ranked_nfts
ORDER BY leaderboard_position;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_enhanced_leaderboard_position 
ON public.enhanced_leaderboard_view(leaderboard_position);

-- Enhanced leaderboard function
DROP FUNCTION IF EXISTS public.get_enhanced_leaderboard(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.get_enhanced_leaderboard(limit_count INTEGER DEFAULT 20)
RETURNS SETOF public.enhanced_leaderboard_view AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.enhanced_leaderboard_view
  WHERE leaderboard_position <= limit_count
  ORDER BY leaderboard_position ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enhanced stats function
DROP FUNCTION IF EXISTS public.enhanced_leaderboard_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.enhanced_leaderboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_meaningful_nfts', (SELECT COUNT(*) FROM public.enhanced_leaderboard_view),
    'confidence_distribution', (
      SELECT json_agg(
        json_build_object(
          'level', confidence_level,
          'count', nft_count,
          'avg_poa_score', avg_score
        )
      )
      FROM (
        SELECT 
          confidence_level,
          COUNT(*) as nft_count,
          AVG(poa_score) as avg_score
        FROM public.enhanced_leaderboard_view
        GROUP BY confidence_level
        ORDER BY 
          CASE confidence_level
            WHEN 'HIGH' THEN 1
            WHEN 'MEDIUM' THEN 2  
            WHEN 'LOW' THEN 3
            ELSE 4
          END
      ) stats
    ),
    'top_collections', (
      SELECT json_agg(
        json_build_object(
          'collection', collection_name,
          'count', nft_count,
          'avg_poa_score', avg_score
        )
      )
      FROM (
        SELECT 
          collection_name,
          COUNT(*) as nft_count,
          AVG(poa_score) as avg_score
        FROM public.enhanced_leaderboard_view
        GROUP BY collection_name
        ORDER BY AVG(poa_score) DESC
        LIMIT 10
      ) top_colls
    ),
    'fire_vote_impact', (
      SELECT json_build_object(
        'nfts_with_fire_votes', COUNT(*),
        'avg_poa_boost', AVG(poa_score - confidence_weighted_score)
      )
      FROM public.enhanced_leaderboard_view
      WHERE fire_votes > 0
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.enhanced_leaderboard_view;

-- Test the new system
SELECT 
  'Enhanced POA System Test' as test_name,
  COUNT(*) as meaningful_nfts,
  AVG(poa_score) as avg_poa_score,
  MAX(poa_score) as max_poa_score,
  COUNT(CASE WHEN confidence_level = 'HIGH' THEN 1 END) as high_confidence,
  COUNT(CASE WHEN confidence_level = 'MEDIUM' THEN 1 END) as medium_confidence,
  COUNT(CASE WHEN confidence_level = 'LOW' THEN 1 END) as low_confidence
FROM public.enhanced_leaderboard_view;
