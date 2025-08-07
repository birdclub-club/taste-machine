-- FINAL FIX: Resolve ALL column ambiguities by using explicit table prefixes
-- This ensures no conflicts between CTE columns and function return columns

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
  nft_scores AS (
    SELECT 
      n.id as nft_id,
      n.token_id as nft_token_id,
      n.name as nft_name,
      n.image as nft_image,
      n.collection_name as nft_collection,
      n.contract_address as nft_contract,
      n.current_elo as nft_elo,
      n.slider_average as nft_slider_avg,
      n.slider_count as nft_slider_count,
      n.total_votes as nft_total_votes,
      n.wins as nft_wins,
      n.losses as nft_losses,
      COALESCE(f.fire_count, 0) as nft_fire_count,
      -- Bootstrap POA Score
      (
        (n.current_elo::DOUBLE PRECISION / 100.0) * 0.3 +
        (COALESCE(n.slider_average, 50.0)) * 0.3 +
        ((n.wins::DOUBLE PRECISION / NULLIF(n.total_votes, 0)) * 100.0) * 0.2 +
        (COALESCE(f.fire_count, 0) * 20.0) * 0.2
      ) as nft_poa_score,
      -- Confidence score
      CASE 
        WHEN n.total_votes >= 10 AND n.slider_count >= 3 AND COALESCE(f.fire_count, 0) >= 1 THEN 95.0
        WHEN n.total_votes >= 5 AND n.slider_count >= 2 THEN 75.0
        WHEN n.total_votes >= 3 OR n.slider_count >= 1 THEN 50.0
        ELSE 25.0
      END as nft_confidence_score,
      CASE 
        WHEN n.total_votes >= 10 AND n.slider_count >= 3 AND COALESCE(f.fire_count, 0) >= 1 THEN 'HIGH'
        WHEN n.total_votes >= 5 AND n.slider_count >= 2 THEN 'MEDIUM'
        WHEN n.total_votes >= 3 OR n.slider_count >= 1 THEN 'LOW'
        ELSE 'VERY_LOW'
      END as nft_confidence_level,
      'Bootstrap POA v1.0' as nft_algorithm,
      'Bootstrap Mode' as nft_system_mode,
      (n.wins::DOUBLE PRECISION / NULLIF(n.total_votes, 0)) * 100.0 as nft_win_pct
    FROM public.nfts n
    LEFT JOIN nft_fire_votes f ON n.id = f.nft_uuid
    WHERE n.current_elo IS NOT NULL 
      AND (n.total_votes >= 1 OR n.slider_count >= 1 OR COALESCE(f.fire_count, 0) > 0)
  ),
  ranked_nfts AS (
    SELECT 
      s.*,
      ROW_NUMBER() OVER (
        ORDER BY 
          s.nft_fire_count DESC,  -- FIRE votes first
          s.nft_poa_score DESC,   -- Then POA score
          s.nft_total_votes DESC, -- Then total votes
          RANDOM()                -- Random tie-breaker
      ) as rank_position
    FROM nft_scores s
  )
  SELECT 
    r.nft_id,
    r.nft_token_id,
    r.nft_name,
    r.nft_image,
    r.nft_collection,
    r.nft_contract,
    r.nft_elo,
    r.nft_slider_avg,
    r.nft_slider_count,
    r.nft_total_votes,
    r.nft_wins,
    r.nft_losses,
    r.nft_fire_count,
    r.nft_poa_score,
    r.nft_confidence_score,
    r.nft_confidence_level,
    r.nft_algorithm,
    r.nft_system_mode,
    r.rank_position,
    r.nft_win_pct
  FROM ranked_nfts r
  WHERE r.rank_position <= limit_count
  ORDER BY r.rank_position;
END;
$$ LANGUAGE plpgsql;
