-- Check what leaderboard functions actually exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%leaderboard%'
ORDER BY routine_name;

-- Test the existing function if it exists
SELECT 
  'CURRENT_LEADERBOARD' as query_type,
  name,
  collection_name,
  total_votes,
  current_elo,
  wins,
  losses
FROM public.get_dynamic_leaderboard_lightweight(10)
ORDER BY 1;

-- Manual FIRE-first leaderboard calculation
WITH nft_fire_votes AS (
  SELECT 
    nft_id,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id
),
nft_with_fire AS (
  SELECT 
    n.id,
    n.name,
    n.collection_name,
    n.current_elo,
    n.total_votes,
    n.wins,
    n.losses,
    COALESCE(f.fire_count, 0) as fire_votes,
    (n.wins::NUMERIC / NULLIF(n.total_votes, 0)) * 100 as win_percentage
  FROM public.nfts n
  LEFT JOIN nft_fire_votes f ON n.id::text = f.nft_id
  WHERE n.current_elo IS NOT NULL 
    AND n.total_votes >= 1
)
SELECT 
  'MANUAL_FIRE_FIRST' as query_type,
  ROW_NUMBER() OVER (
    ORDER BY 
      fire_votes DESC,           -- FIRE votes first
      current_elo DESC,          -- Then Elo
      total_votes DESC,          -- Then vote count
      RANDOM()                   -- Random tie breaker
  ) as position,
  name,
  collection_name,
  fire_votes,
  total_votes,
  current_elo,
  win_percentage
FROM nft_with_fire
ORDER BY position
LIMIT 10;
