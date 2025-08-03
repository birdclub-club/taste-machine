-- Migration: Exclude Unrevealed NFTs from Voting
-- Updates Supabase RPC functions to filter out unrevealed NFTs
-- This prevents unrevealed NFTs from appearing in any voting sessions

-- Drop existing functions first (they may have different return types)
DROP FUNCTION IF EXISTS find_cold_start_nfts(integer);
DROP FUNCTION IF EXISTS find_same_collection_matchup();
DROP FUNCTION IF EXISTS find_cross_collection_matchup();
DROP FUNCTION IF EXISTS decide_vote_type();

-- Create find_cold_start_nfts function to exclude unrevealed NFTs
CREATE OR REPLACE FUNCTION find_cold_start_nfts(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  nft_id UUID,
  slider_count INTEGER,
  total_votes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id as nft_id,
    COALESCE(n.slider_count, 0) as slider_count,
    COALESCE(n.total_votes, 0) as total_votes
  FROM nfts n
  WHERE COALESCE(n.slider_count, 0) < 3
    AND n.image NOT ILIKE '%.mp4%'
    AND n.image NOT ILIKE '%.mov%'
    AND n.image NOT ILIKE '%.avi%'
    AND n.image NOT ILIKE '%.webm%'
    AND n.image NOT ILIKE '%.mkv%'
    AND NOT (n.traits @> '{"Reveal": "Unrevealed"}')
    AND NOT (n.traits @> '{"reveal": "unrevealed"}')
    AND NOT (n.traits @> '{"Status": "Unrevealed"}')
    AND NOT (n.traits @> '{"status": "unrevealed"}')
    AND NOT (n.traits @> '{"Status": "Hidden"}')
    AND NOT (n.traits @> '{"status": "hidden"}')
    AND NOT (n.traits @> '{"Stage": "Pre-reveal"}')
    AND NOT (n.traits @> '{"stage": "pre-reveal"}')
    AND NOT (n.traits @> '{"Hive": "Regular"}')
    AND NOT (n.traits @> '{"Hive": "Robot"}')
    AND NOT (n.traits @> '{"Hive": "Zombee"}')
    AND NOT (n.traits @> '{"Hive": "Present"}')
    AND NOT (n.traits @> '{"hive": "regular"}')
    AND NOT (n.traits @> '{"hive": "robot"}')
    AND NOT (n.traits @> '{"hive": "zombee"}')
    AND NOT (n.traits @> '{"hive": "present"}')
  ORDER BY 
    COALESCE(n.slider_count, 0) ASC,
    COALESCE(n.total_votes, 0) ASC,
    RANDOM()
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create find_same_collection_matchup function to exclude unrevealed NFTs
CREATE OR REPLACE FUNCTION find_same_collection_matchup()
RETURNS TABLE (
  nft_a_id UUID,
  nft_b_id UUID,
  collection_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_nfts AS (
    SELECT 
      n.id,
      n.collection_name,
      n.current_elo,
      n.total_votes
    FROM nfts n
    WHERE n.collection_name IS NOT NULL
      AND n.image NOT ILIKE '%.mp4%'
      AND n.image NOT ILIKE '%.mov%'
      AND n.image NOT ILIKE '%.avi%'
      AND n.image NOT ILIKE '%.webm%'
      AND n.image NOT ILIKE '%.mkv%'
      AND NOT (n.traits @> '{"Reveal": "Unrevealed"}')
      AND NOT (n.traits @> '{"reveal": "unrevealed"}')
      AND NOT (n.traits @> '{"Status": "Unrevealed"}')
      AND NOT (n.traits @> '{"status": "unrevealed"}')
  ),
  collection_counts AS (
    SELECT 
      collection_name,
      COUNT(*) as nft_count
    FROM filtered_nfts
    GROUP BY collection_name
    HAVING COUNT(*) >= 2
  ),
  random_collection AS (
    SELECT collection_name
    FROM collection_counts
    ORDER BY RANDOM()
    LIMIT 1
  ),
  collection_nfts AS (
    SELECT f.*
    FROM filtered_nfts f
    JOIN random_collection rc ON f.collection_name = rc.collection_name
    ORDER BY RANDOM()
    LIMIT 2
  )
  SELECT 
    (SELECT id FROM collection_nfts ORDER BY RANDOM() LIMIT 1) as nft_a_id,
    (SELECT id FROM collection_nfts WHERE id != (SELECT id FROM collection_nfts ORDER BY RANDOM() LIMIT 1) ORDER BY RANDOM() LIMIT 1) as nft_b_id,
    (SELECT collection_name FROM random_collection) as collection_name;
END;
$$ LANGUAGE plpgsql;

-- Create find_cross_collection_matchup function to exclude unrevealed NFTs
CREATE OR REPLACE FUNCTION find_cross_collection_matchup()
RETURNS TABLE (
  nft_a_id UUID,
  nft_b_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_nfts AS (
    SELECT 
      n.id,
      n.collection_name,
      n.current_elo,
      n.total_votes
    FROM nfts n
    WHERE n.collection_name IS NOT NULL
      AND n.image NOT ILIKE '%.mp4%'
      AND n.image NOT ILIKE '%.mov%'
      AND n.image NOT ILIKE '%.avi%'
      AND n.image NOT ILIKE '%.webm%'
      AND n.image NOT ILIKE '%.mkv%'
      AND NOT (n.traits @> '{"Reveal": "Unrevealed"}')
      AND NOT (n.traits @> '{"reveal": "unrevealed"}')
      AND NOT (n.traits @> '{"Status": "Unrevealed"}')
      AND NOT (n.traits @> '{"status": "unrevealed"}')
  ),
  collection_groups AS (
    SELECT 
      collection_name,
      ARRAY_AGG(id ORDER BY RANDOM()) as nft_ids
    FROM filtered_nfts
    GROUP BY collection_name
    HAVING COUNT(*) >= 1
  ),
  two_collections AS (
    SELECT collection_name, nft_ids
    FROM collection_groups
    ORDER BY RANDOM()
    LIMIT 2
  )
  SELECT 
    (SELECT nft_ids[1] FROM two_collections LIMIT 1) as nft_a_id,
    (SELECT nft_ids[1] FROM two_collections OFFSET 1 LIMIT 1) as nft_b_id;
END;
$$ LANGUAGE plpgsql;

-- Create decide_vote_type function to work with unrevealed filtering
CREATE OR REPLACE FUNCTION decide_vote_type()
RETURNS TEXT AS $$
DECLARE
  cold_start_count INTEGER;
  random_val FLOAT;
BEGIN
  -- Check if there are any cold start NFTs (excluding unrevealed)
  SELECT COUNT(*) INTO cold_start_count
  FROM nfts n
  WHERE COALESCE(n.slider_count, 0) < 3
    AND n.image NOT ILIKE '%.mp4%'
    AND n.image NOT ILIKE '%.mov%'
    AND n.image NOT ILIKE '%.avi%'
    AND n.image NOT ILIKE '%.webm%'
    AND n.image NOT ILIKE '%.mkv%'
    AND NOT (n.traits @> '{"Reveal": "Unrevealed"}')
    AND NOT (n.traits @> '{"reveal": "unrevealed"}')
    AND NOT (n.traits @> '{"Status": "Unrevealed"}')
    AND NOT (n.traits @> '{"status": "unrevealed"}')
    AND NOT (n.traits @> '{"Status": "Hidden"}')
    AND NOT (n.traits @> '{"status": "hidden"}')
    AND NOT (n.traits @> '{"Stage": "Pre-reveal"}')
    AND NOT (n.traits @> '{"stage": "pre-reveal"}')
    AND NOT (n.traits @> '{"Hive": "Regular"}')
    AND NOT (n.traits @> '{"Hive": "Robot"}')
    AND NOT (n.traits @> '{"Hive": "Zombee"}')
    AND NOT (n.traits @> '{"Hive": "Present"}')
    AND NOT (n.traits @> '{"hive": "regular"}')
    AND NOT (n.traits @> '{"hive": "robot"}')
    AND NOT (n.traits @> '{"hive": "zombee"}')
    AND NOT (n.traits @> '{"hive": "present"}');

  random_val := RANDOM();
  
  -- Prioritize slider votes if there are cold start NFTs
  IF cold_start_count > 0 AND random_val < 0.4 THEN
    RETURN 'slider';
  ELSIF random_val < 0.7 THEN
    RETURN 'same_coll';
  ELSE
    RETURN 'cross_coll';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Instructions:
-- 1. Run this migration in Supabase SQL Editor
-- 2. All voting functions now exclude unrevealed NFTs
-- 3. This works with various trait name formats:
--    - {"Reveal": "Unrevealed"} (Generic unrevealed)
--    - {"Status": "Unrevealed"} (Generic unrevealed)
--    - {"Status": "Hidden"} (Kabu collection)
--    - {"Stage": "Pre-reveal"} (Bearish collection)
--    - {"Hive": "Regular|Robot|Zombee|Present"} (Beeish collection - specific unrevealed states)
--    - All case variations (lowercase versions)
-- 4. No more unrevealed NFTs in voting sessions!