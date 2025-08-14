-- 📉 Step-by-Step Retroactive NO Vote Counting
-- Run each query separately to avoid timeouts

-- ===== STEP 1: ANALYSIS (Run this first) =====
-- Check if you have NO votes to process
SELECT 
  'NO Votes Found' as status,
  COUNT(*) as total_no_votes,
  SUM(CASE WHEN (engagement_data->>'super_vote')::boolean = true THEN 1 ELSE 0 END) as super_no_votes,
  SUM(CASE WHEN COALESCE((engagement_data->>'super_vote')::boolean, false) = false THEN 1 ELSE 0 END) as regular_no_votes
FROM votes 
WHERE winner_id IS NULL 
  AND nft_a_id IS NOT NULL 
  AND nft_b_id IS NOT NULL
  AND (engagement_data->>'no_vote')::boolean = true;

-- ===== STEP 2: CREATE TEMP TRACKING TABLE (Run this second) =====
-- Create a table to track which NFTs need vote count updates
CREATE TEMP TABLE IF NOT EXISTS no_vote_updates (
  nft_id uuid,
  vote_increase integer,
  processed boolean DEFAULT false
);

-- ===== STEP 3: POPULATE TRACKING TABLE - REGULAR NO VOTES =====
-- Find all NFTs affected by regular NO votes (weight = 1)
INSERT INTO no_vote_updates (nft_id, vote_increase)
SELECT 
  nft_id,
  COUNT(*) as vote_increase
FROM (
  -- NFT A positions in regular NO votes
  SELECT nft_a_id::uuid as nft_id
  FROM votes 
  WHERE winner_id IS NULL 
    AND nft_a_id IS NOT NULL 
    AND nft_b_id IS NOT NULL
    AND (engagement_data->>'no_vote')::boolean = true
    AND COALESCE((engagement_data->>'super_vote')::boolean, false) = false
  
  UNION ALL
  
  -- NFT B positions in regular NO votes  
  SELECT nft_b_id::uuid as nft_id
  FROM votes 
  WHERE winner_id IS NULL 
    AND nft_a_id IS NOT NULL 
    AND nft_b_id IS NOT NULL
    AND (engagement_data->>'no_vote')::boolean = true
    AND COALESCE((engagement_data->>'super_vote')::boolean, false) = false
) all_nft_positions
GROUP BY nft_id
ON CONFLICT (nft_id) DO UPDATE SET 
  vote_increase = no_vote_updates.vote_increase + EXCLUDED.vote_increase;

-- ===== STEP 4: ADD SUPER NO VOTES TO TRACKING =====
-- Find all NFTs affected by super NO votes (weight = 5)
INSERT INTO no_vote_updates (nft_id, vote_increase)
SELECT 
  nft_id,
  COUNT(*) * 5 as vote_increase  -- Super votes count as 5
FROM (
  -- NFT A positions in super NO votes
  SELECT nft_a_id::uuid as nft_id
  FROM votes 
  WHERE winner_id IS NULL 
    AND nft_a_id IS NOT NULL 
    AND nft_b_id IS NOT NULL
    AND (engagement_data->>'no_vote')::boolean = true
    AND (engagement_data->>'super_vote')::boolean = true
  
  UNION ALL
  
  -- NFT B positions in super NO votes
  SELECT nft_b_id::uuid as nft_id
  FROM votes 
  WHERE winner_id IS NULL 
    AND nft_a_id IS NOT NULL 
    AND nft_b_id IS NOT NULL
    AND (engagement_data->>'no_vote')::boolean = true
    AND (engagement_data->>'super_vote')::boolean = true
) all_nft_positions
GROUP BY nft_id
ON CONFLICT (nft_id) DO UPDATE SET 
  vote_increase = no_vote_updates.vote_increase + EXCLUDED.vote_increase;

-- ===== STEP 5: PREVIEW CHANGES =====
-- Show what will be updated (top 20 most affected NFTs)
SELECT 
  n.name,
  n.collection_name,
  n.total_votes as current_votes,
  nvu.vote_increase,
  n.total_votes + nvu.vote_increase as new_total
FROM no_vote_updates nvu
JOIN nfts n ON n.id = nvu.nft_id
WHERE nvu.vote_increase > 0
ORDER BY nvu.vote_increase DESC
LIMIT 20;

-- ===== STEP 6: APPLY UPDATES (Run this after reviewing step 5) =====
-- Update NFT vote counts based on tracking table
UPDATE nfts 
SET 
  total_votes = COALESCE(total_votes, 0) + nvu.vote_increase,
  updated_at = NOW()
FROM no_vote_updates nvu
WHERE nfts.id = nvu.nft_id 
  AND nvu.vote_increase > 0;

-- ===== STEP 7: MARK AS PROCESSED =====
UPDATE no_vote_updates SET processed = true WHERE vote_increase > 0;

-- ===== STEP 8: FINAL VERIFICATION =====
-- Show summary of changes made
SELECT 
  'Update Summary' as status,
  COUNT(*) as nfts_updated,
  SUM(vote_increase) as total_votes_added,
  MAX(vote_increase) as max_increase_single_nft,
  AVG(vote_increase) as avg_increase_per_nft
FROM no_vote_updates 
WHERE processed = true;

-- Show sample of updated NFTs
SELECT 
  'Sample Updated NFTs' as info,
  n.name,
  n.collection_name,
  n.total_votes as final_vote_count,
  nvu.vote_increase as added_from_no_votes
FROM no_vote_updates nvu
JOIN nfts n ON n.id = nvu.nft_id
WHERE nvu.processed = true
ORDER BY nvu.vote_increase DESC
LIMIT 10;

