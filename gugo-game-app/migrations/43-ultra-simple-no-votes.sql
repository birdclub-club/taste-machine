-- 📉 Ultra-Simple NO Vote Counting (One tiny query at a time)
-- Run each query separately, wait for completion before next

-- ===== QUERY 1: Check if NO votes exist =====
SELECT COUNT(*) as no_vote_count
FROM votes 
WHERE winner_id IS NULL 
  AND (engagement_data->>'no_vote')::boolean = true
LIMIT 1;

-- ===== QUERY 2: Get first 10 NO votes to examine =====
SELECT id, nft_a_id, nft_b_id, engagement_data->>'super_vote' as is_super
FROM votes 
WHERE winner_id IS NULL 
  AND (engagement_data->>'no_vote')::boolean = true
LIMIT 10;

-- ===== QUERY 3: Update first batch of NFTs (only 5 votes) =====
-- Copy the NFT IDs from Query 2 and update them manually
-- Example (replace with actual IDs from your data):
-- UPDATE nfts SET total_votes = total_votes + 1 WHERE id = 'nft_a_id_from_query_2';
-- UPDATE nfts SET total_votes = total_votes + 1 WHERE id = 'nft_b_id_from_query_2';

-- ===== IF Query 1 shows you have NO votes, try this minimal update: =====
-- Update just ONE NFT at a time to test
-- First, find one NFT affected by NO votes:
SELECT DISTINCT nft_a_id
FROM votes 
WHERE winner_id IS NULL 
  AND (engagement_data->>'no_vote')::boolean = true
LIMIT 1;

-- Then update that one NFT (replace 'YOUR_NFT_ID' with actual ID):
-- UPDATE nfts SET total_votes = total_votes + 1 WHERE id = 'YOUR_NFT_ID';

