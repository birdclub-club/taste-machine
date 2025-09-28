-- ================================
-- 📊 PROOF OF AESTHETIC (POA) SCORING ANALYSIS
-- ================================
-- This query breaks down how the current scoring works and identifies confidence thresholds

-- Current scoring formula analysis
WITH scoring_breakdown AS (
  SELECT 
    n.id,
    n.name,
    n.collection_name,
    n.current_elo,
    n.slider_average,
    n.slider_count,
    n.total_votes,
    n.wins,
    n.losses,
    COALESCE(f.fire_votes, 0) as fire_votes,
    
    -- Current scoring components (from materialized view logic)
    CASE 
      WHEN n.current_elo IS NULL THEN 0
      ELSE GREATEST(0, LEAST(100, (n.current_elo - 1000) / 20))
    END as elo_normalized,
    
    COALESCE(n.slider_average, 0) as slider_score,
    
    CASE 
      WHEN n.total_votes > 0 THEN (n.wins::float / n.total_votes::float * 100) - 50
      ELSE 0 
    END as win_rate_bonus,
    
    COALESCE(f.fire_votes, 0) * 15 as fire_bonus,
    
    -- Calculate the weighted components
    (GREATEST(0, LEAST(100, (n.current_elo - 1000) / 20)) * 0.4) as elo_component,
    (COALESCE(n.slider_average, 0) * 0.2) as slider_component,
    (CASE 
      WHEN n.total_votes > 0 THEN (n.wins::float / n.total_votes::float * 100) - 50
      ELSE 0 
    END * 0.1) as win_rate_component,
    (LEAST(COALESCE(f.fire_votes, 0) * 15, 30) * 1.0) as fire_component,
    
      -- Confidence indicators
  n.total_votes as vote_count,
  n.slider_count as slider_data_count,
  COALESCE(f.fire_votes, 0) as fire_count
    
  FROM public.nfts n
  LEFT JOIN (
    SELECT 
      nft_id::uuid as nft_uuid,
      COUNT(*) as fire_votes
    FROM public.favorites 
    WHERE vote_type = 'fire'
    GROUP BY nft_id::uuid
  ) f ON n.id = f.nft_uuid
  WHERE n.current_elo IS NOT NULL
)
SELECT 
  'Current Scoring Analysis' as analysis_type,
  name,
  collection_name,
  current_elo,
  total_votes,
  slider_data_count,
  fire_votes,
  
  -- Component breakdown
  ROUND(elo_component::NUMERIC, 2) as elo_points,
  ROUND(slider_component::NUMERIC, 2) as slider_points,
  ROUND(win_rate_component::NUMERIC, 2) as win_rate_points,
  ROUND(fire_component::NUMERIC, 2) as fire_points,
  ROUND((elo_component + slider_component + win_rate_component + fire_component)::NUMERIC, 2) as total_poa_score,
  
  -- Confidence assessment
  CASE 
    WHEN total_votes >= 10 AND slider_data_count >= 3 AND fire_votes >= 1 THEN 'HIGH'
    WHEN total_votes >= 5 AND (slider_data_count >= 2 OR fire_votes >= 1) THEN 'MEDIUM'
    WHEN total_votes >= 3 OR slider_data_count >= 1 OR fire_votes >= 1 THEN 'LOW'
    ELSE 'INSUFFICIENT'
  END as confidence_level,
  
  -- Data completeness score (0-100)
  LEAST(100, 
    (LEAST(total_votes / 10.0, 1.0) * 40) +  -- Voting data: 40% weight
    (LEAST(slider_data_count / 5.0, 1.0) * 30) +   -- Slider data: 30% weight
    (LEAST(fire_votes / 2.0, 1.0) * 30)       -- Fire votes: 30% weight
  ) as data_completeness
  
FROM scoring_breakdown
ORDER BY (elo_component + slider_component + win_rate_component + fire_component) DESC
LIMIT 20;

-- Confidence threshold analysis
SELECT 
  'Confidence Distribution' as analysis_type,
  confidence_level,
  COUNT(*) as nft_count,
  AVG(current_elo) as avg_elo,
  COUNT(CASE WHEN fire_votes > 0 THEN 1 END) as nfts_with_fire
FROM (
  SELECT 
    n.*,
    COALESCE(f.fire_votes, 0) as fire_votes,
    CASE 
      WHEN n.total_votes >= 10 AND n.slider_count >= 3 AND COALESCE(f.fire_votes, 0) >= 1 THEN 'HIGH'
      WHEN n.total_votes >= 5 AND (n.slider_count >= 2 OR COALESCE(f.fire_votes, 0) >= 1) THEN 'MEDIUM'
      WHEN n.total_votes >= 3 OR n.slider_count >= 1 OR COALESCE(f.fire_votes, 0) >= 1 THEN 'LOW'
      ELSE 'INSUFFICIENT'
    END as confidence_level
  FROM public.nfts n
  LEFT JOIN (
    SELECT 
      nft_id::uuid as nft_uuid,
      COUNT(*) as fire_votes
    FROM public.favorites 
    WHERE vote_type = 'fire'
    GROUP BY nft_id::uuid
  ) f ON n.id = f.nft_uuid
  WHERE n.current_elo IS NOT NULL
) nfts_with_fire_data
GROUP BY analysis_type, confidence_level
ORDER BY 
  CASE confidence_level
    WHEN 'HIGH' THEN 1
    WHEN 'MEDIUM' THEN 2
    WHEN 'LOW' THEN 3
    WHEN 'INSUFFICIENT' THEN 4
  END;
