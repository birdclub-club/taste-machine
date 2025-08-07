-- ABSOLUTE FINAL FIX: Match exact API expectations
-- This ensures the function returns exactly what the API expects

DROP FUNCTION IF EXISTS get_fire_first_leaderboard_v3(integer);

CREATE OR REPLACE FUNCTION get_fire_first_leaderboard_v3(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  token_id text,
  name text,
  image text,
  collection_name text,
  contract_address text,
  current_elo integer,
  slider_average numeric,
  slider_count integer,
  total_votes integer,
  wins integer,
  losses integer,
  fire_votes bigint,
  poa_score numeric,
  confidence_score numeric,
  confidence_level text,
  algorithm text,
  system_mode text,
  leaderboard_position integer,
  win_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
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
    COALESCE(f.fire_count, 0)::bigint as fire_votes,
    (
      (n.current_elo::numeric / 100.0) * 0.3 +
      (COALESCE(n.slider_average, 50.0)) * 0.3 +
      ((n.wins::numeric / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
      (COALESCE(f.fire_count, 0) * 20.0) * 0.2
    )::numeric as poa_score,
    CASE 
      WHEN n.total_votes >= 10 AND n.slider_count >= 3 AND COALESCE(f.fire_count, 0) >= 1 THEN 95.0
      WHEN n.total_votes >= 5 AND n.slider_count >= 2 THEN 75.0
      WHEN n.total_votes >= 3 OR n.slider_count >= 1 THEN 50.0
      ELSE 25.0
    END::numeric as confidence_score,
    CASE 
      WHEN n.total_votes >= 10 AND n.slider_count >= 3 AND COALESCE(f.fire_count, 0) >= 1 THEN 'HIGH'
      WHEN n.total_votes >= 5 AND n.slider_count >= 2 THEN 'MEDIUM'
      WHEN n.total_votes >= 3 OR n.slider_count >= 1 THEN 'LOW'
      ELSE 'VERY_LOW'
    END as confidence_level,
    'Bootstrap POA v1.0' as algorithm,
    'Bootstrap Mode' as system_mode,
    ROW_NUMBER() OVER (
      ORDER BY 
        COALESCE(f.fire_count, 0) DESC,
        (
          (n.current_elo::numeric / 100.0) * 0.3 +
          (COALESCE(n.slider_average, 50.0)) * 0.3 +
          ((n.wins::numeric / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
          (COALESCE(f.fire_count, 0) * 20.0) * 0.2
        ) DESC,
        n.total_votes DESC,
        RANDOM()
    )::integer as leaderboard_position,
    (n.wins::numeric / NULLIF(n.total_votes, 0) * 100.0)::numeric as win_percentage
  FROM public.nfts n
  LEFT JOIN (
    SELECT 
      nft_id::uuid as nft_uuid, 
      COUNT(*) as fire_count 
    FROM public.favorites 
    WHERE vote_type = 'fire' 
    GROUP BY nft_id::uuid
  ) f ON n.id = f.nft_uuid
  WHERE n.current_elo IS NOT NULL 
    AND (n.total_votes >= 1 OR n.slider_count >= 1 OR COALESCE(f.fire_count, 0) > 0)
  ORDER BY 
    COALESCE(f.fire_count, 0) DESC,
    (
      (n.current_elo::numeric / 100.0) * 0.3 +
      (COALESCE(n.slider_average, 50.0)) * 0.3 +
      ((n.wins::numeric / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
      (COALESCE(f.fire_count, 0) * 20.0) * 0.2
    ) DESC,
    n.total_votes DESC,
    RANDOM()
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
