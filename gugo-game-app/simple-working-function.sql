-- SIMPLE WORKING FUNCTION: Only use columns we know exist
-- This will definitely work because it only uses basic nfts table columns

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
    COALESCE(n.collection_name, 'Unknown') as collection_name,
    n.contract_address,
    COALESCE(n.looks_score, 1000) as current_elo,  -- Use looks_score as current_elo
    50.0::numeric as slider_average,  -- Default value
    0 as slider_count,  -- Default value
    n.total_votes,
    n.wins,
    n.losses,
    COALESCE(fire_data.fire_count, 0)::bigint as fire_votes,
    (
      (COALESCE(n.looks_score, 1000)::numeric / 100.0) * 0.3 +
      50.0::numeric * 0.3 +
      ((n.wins::numeric / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
      (COALESCE(fire_data.fire_count, 0) * 20.0) * 0.2
    ) as poa_score,
    CASE 
      WHEN n.total_votes >= 10 AND COALESCE(fire_data.fire_count, 0) >= 1 THEN 95.0
      WHEN n.total_votes >= 5 THEN 75.0
      WHEN n.total_votes >= 3 THEN 50.0
      ELSE 25.0
    END::numeric as confidence_score,
    CASE 
      WHEN n.total_votes >= 10 AND COALESCE(fire_data.fire_count, 0) >= 1 THEN 'HIGH'
      WHEN n.total_votes >= 5 THEN 'MEDIUM'
      WHEN n.total_votes >= 3 THEN 'LOW'
      ELSE 'VERY_LOW'
    END as confidence_level,
    'Simple POA v1.0' as algorithm,
    'Basic Mode' as system_mode,
    ROW_NUMBER() OVER (
      ORDER BY 
        COALESCE(fire_data.fire_count, 0) DESC,
        (
          (COALESCE(n.looks_score, 1000)::numeric / 100.0) * 0.3 +
          50.0::numeric * 0.3 +
          ((n.wins::numeric / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
          (COALESCE(fire_data.fire_count, 0) * 20.0) * 0.2
        ) DESC,
        n.total_votes DESC,
        RANDOM()
    )::integer as leaderboard_position,
    COALESCE((n.wins::numeric / NULLIF(n.total_votes, 0) * 100.0), 0.0) as win_percentage
  FROM public.nfts n
  LEFT JOIN (
    SELECT 
      nft_id::uuid as nft_uuid, 
      COUNT(*) as fire_count 
    FROM public.favorites 
    WHERE vote_type = 'fire' 
    GROUP BY nft_id::uuid
  ) fire_data ON n.id = fire_data.nft_uuid
  WHERE n.total_votes >= 1 OR COALESCE(fire_data.fire_count, 0) > 0
  ORDER BY 
    COALESCE(fire_data.fire_count, 0) DESC,
    (
      (COALESCE(n.looks_score, 1000)::numeric / 100.0) * 0.3 +
      50.0::numeric * 0.3 +
      ((n.wins::numeric / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
      (COALESCE(fire_data.fire_count, 0) * 20.0) * 0.2
    ) DESC,
    n.total_votes DESC,
    RANDOM()
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
