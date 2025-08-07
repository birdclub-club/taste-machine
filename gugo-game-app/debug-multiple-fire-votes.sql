-- Debug: Find NFTs with multiple FIRE votes
-- These should be at the very top of leaderboard

SELECT 
  'Multiple FIRE Detection' as analysis_type,
  n.id,
  n.token_id,
  n.name,
  n.collection_name,
  n.current_elo,
  n.total_votes,
  n.slider_count,
  COALESCE(f.fire_count, 0) as fire_votes_detected,
  CASE 
    WHEN COALESCE(f.fire_count, 0) >= 3 THEN 'TRIPLE+ FIRE (Ultimate)'
    WHEN COALESCE(f.fire_count, 0) >= 2 THEN 'DOUBLE FIRE (Elite)'
    WHEN COALESCE(f.fire_count, 0) >= 1 THEN 'Single FIRE'
    ELSE 'No FIRE'
  END as fire_tier,
  CASE 
    WHEN n.current_elo IS NULL THEN 'No Elo'
    WHEN n.total_votes < 1 AND n.slider_count < 1 AND COALESCE(f.fire_count, 0) < 1 THEN 'Insufficient Data'
    ELSE 'Eligible'
  END as eligibility_status,
  -- Calculate what their priority score would be
  CASE 
    WHEN COALESCE(f.fire_count, 0) >= 3 THEN 1200 + (COALESCE(n.current_elo, 50) * 0.5)
    WHEN COALESCE(f.fire_count, 0) >= 2 THEN 1100 + (COALESCE(n.current_elo, 50) * 0.5)
    WHEN COALESCE(f.fire_count, 0) >= 1 THEN 1000 + (COALESCE(n.current_elo, 50) * 0.5)
    ELSE 500 + (COALESCE(n.current_elo, 50) * 0.5)
  END as expected_priority_score
FROM public.nfts n
LEFT JOIN (
  SELECT 
    nft_id::uuid as nft_uuid,
    COUNT(*) as fire_count
  FROM public.favorites 
  WHERE vote_type = 'fire'
  GROUP BY nft_id::uuid
) f ON n.id = f.nft_uuid
WHERE COALESCE(f.fire_count, 0) > 0 -- Only show NFTs with FIRE votes
ORDER BY fire_votes_detected DESC, n.total_votes DESC, n.current_elo DESC;

-- Also check the raw favorites table for multiple FIRE votes
SELECT 
  'Raw FIRE Vote Counts' as analysis_type,
  nft_id,
  COUNT(*) as fire_vote_count,
  COUNT(DISTINCT wallet_address) as unique_voters
FROM public.favorites 
WHERE vote_type = 'fire'
GROUP BY nft_id
ORDER BY fire_vote_count DESC, unique_voters DESC;
