-- 📉 Simple Retroactive NO Vote Counting (Optimized for Supabase)
-- Lightweight version to avoid timeouts

-- Step 1: Quick analysis (run this first to see what we have)
SELECT 
  COUNT(*) as total_no_votes,
  SUM(CASE WHEN (engagement_data->>'super_vote')::boolean = true THEN 10 ELSE 2 END) as total_vote_additions
FROM votes 
WHERE winner_id IS NULL 
  AND nft_a_id IS NOT NULL 
  AND nft_b_id IS NOT NULL
  AND (engagement_data->>'no_vote')::boolean = true
LIMIT 1;

-- Step 2: Process regular NO votes (weight = 1 each, affects 2 NFTs = +2 total per vote)
WITH regular_no_votes AS (
  SELECT DISTINCT nft_a_id, nft_b_id
  FROM votes 
  WHERE winner_id IS NULL 
    AND nft_a_id IS NOT NULL 
    AND nft_b_id IS NOT NULL
    AND (engagement_data->>'no_vote')::boolean = true
    AND COALESCE((engagement_data->>'super_vote')::boolean, false) = false
  LIMIT 100  -- Process in small batches to avoid timeout
),
nft_vote_counts AS (
  SELECT nft_id, COUNT(*) as vote_increase
  FROM (
    SELECT nft_a_id::uuid as nft_id FROM regular_no_votes
    UNION ALL
    SELECT nft_b_id::uuid as nft_id FROM regular_no_votes
  ) expanded
  GROUP BY nft_id
)
UPDATE nfts 
SET total_votes = COALESCE(total_votes, 0) + nvc.vote_increase,
    updated_at = NOW()
FROM nft_vote_counts nvc
WHERE nfts.id = nvc.nft_id;

-- Step 3: Process super NO votes (weight = 5 each, affects 2 NFTs = +10 total per vote)
WITH super_no_votes AS (
  SELECT DISTINCT nft_a_id, nft_b_id
  FROM votes 
  WHERE winner_id IS NULL 
    AND nft_a_id IS NOT NULL 
    AND nft_b_id IS NOT NULL
    AND (engagement_data->>'no_vote')::boolean = true
    AND (engagement_data->>'super_vote')::boolean = true
  LIMIT 50  -- Smaller batch for super votes
),
nft_vote_counts AS (
  SELECT nft_id, COUNT(*) * 5 as vote_increase  -- Super votes = 5x weight
  FROM (
    SELECT nft_a_id::uuid as nft_id FROM super_no_votes
    UNION ALL
    SELECT nft_b_id::uuid as nft_id FROM super_no_votes
  ) expanded
  GROUP BY nft_id
)
UPDATE nfts 
SET total_votes = COALESCE(total_votes, 0) + nvc.vote_increase,
    updated_at = NOW()
FROM nft_vote_counts nvc
WHERE nfts.id = nvc.nft_id;

-- Step 4: Verification - show updated NFTs with highest NO vote impact
SELECT 
  n.name,
  n.collection_name,
  n.total_votes,
  COUNT(v.id) as no_votes_received
FROM nfts n
JOIN votes v ON (n.id = v.nft_a_id::uuid OR n.id = v.nft_b_id::uuid)
WHERE v.winner_id IS NULL 
  AND v.nft_a_id IS NOT NULL 
  AND v.nft_b_id IS NOT NULL
  AND (v.engagement_data->>'no_vote')::boolean = true
GROUP BY n.id, n.name, n.collection_name, n.total_votes
HAVING COUNT(v.id) >= 2
ORDER BY COUNT(v.id) DESC
LIMIT 10;

