-- FORCE REFRESH: Drop and recreate function with completely new definition
-- This bypasses any Supabase caching issues

-- First, drop the existing function completely
DROP FUNCTION IF EXISTS get_fire_first_leaderboard_v2(integer);

-- Create the function with correct data types from scratch
CREATE OR REPLACE FUNCTION get_fire_first_leaderboard_v3(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  token_id text,
  name text,
  image text,
  collection_name text,
  contract_address text,
  current_elo integer,
  slider_average double precision,
  slider_count integer,
  total_votes integer,
  wins integer,
  losses integer,
  fire_votes bigint,
  poa_score double precision,
  confidence_score double precision,
  confidence_level text,
  algorithm text,
  system_mode text,
  leaderboard_position integer,
  win_percentage double precision
) AS $$
BEGIN
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
      -- Bootstrap POA Score: Simple weighted average favoring FIRE votes
      (
        (n.current_elo::DOUBLE PRECISION / 100.0) * 0.3 +
        (COALESCE(n.slider_average, 50.0)) * 0.3 +
        ((n.wins::DOUBLE PRECISION / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
        (COALESCE(f.fire_count, 0) * 20.0) * 0.2
      ) as poa_score,
      -- Confidence based on data volume
      CASE 
        WHEN n.total_votes >= 10 AND n.slider_count >= 3 AND COALESCE(f.fire_count, 0) >= 1 THEN 95.0
        WHEN n.total_votes >= 5 AND n.slider_count >= 2 THEN 75.0
        WHEN n.total_votes >= 3 OR n.slider_count >= 1 THEN 50.0
        ELSE 25.0
      END as confidence_score,
      CASE 
        WHEN n.total_votes >= 10 AND n.slider_count >= 3 AND COALESCE(f.fire_count, 0) >= 1 THEN 'HIGH'
        WHEN n.total_votes >= 5 AND n.slider_count >= 2 THEN 'MEDIUM'
        WHEN n.total_votes >= 3 OR n.slider_count >= 1 THEN 'LOW'
        ELSE 'VERY_LOW'
      END as confidence_level,
      'Bootstrap POA v1.0' as algorithm,
      'Bootstrap Mode' as system_mode,
      (n.wins::DOUBLE PRECISION / NULLIF(n.total_votes, 0)) * 100.0 as win_percentage
    FROM public.nfts n
    LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
    WHERE n.current_elo IS NOT NULL 
      AND (n.total_votes >= 1 OR n.slider_count >= 1 OR COALESCE(f.fire_count, 0) > 0)
  ),
  ranked_nfts AS (
    SELECT 
      *,
      ROW_NUMBER() OVER (
        ORDER BY 
          fire_votes DESC,  -- FIRE votes first
          poa_score DESC,   -- Then POA score
          total_votes DESC, -- Then total votes
          RANDOM()          -- Random tie-breaker
      ) as leaderboard_position
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
    r.fire_votes,
    r.poa_score,
    r.confidence_score,
    r.confidence_level,
    r.algorithm,
    r.system_mode,
    r.leaderboard_position,
    r.win_percentage
  FROM ranked_nfts r
  WHERE r.leaderboard_position <= limit_count
  ORDER BY r.leaderboard_position;
END;
$$ LANGUAGE plpgsql;