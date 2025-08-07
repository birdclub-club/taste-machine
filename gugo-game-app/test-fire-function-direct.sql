-- Test our FIRE function directly and compare with simple query

-- 1. Simple direct query for FIRE votes (should show 7)
SELECT 
    n.name,
    n.total_votes,
    COUNT(f.*) as fire_count
FROM nfts n
INNER JOIN favorites f ON n.id = f.nft_id::uuid
WHERE f.vote_type = 'fire'
  AND n.total_votes > 0
GROUP BY n.id, n.name, n.total_votes
ORDER BY fire_count DESC, n.total_votes DESC;

-- 2. Test our function directly (should show FIRE votes > 0)
SELECT 
    name,
    total_votes,
    fire_votes,
    poa_score,
    leaderboard_position
FROM get_fire_first_leaderboard_v2(20)
WHERE fire_votes > 0
ORDER BY fire_votes DESC;

-- 3. Check if function returns ANY results at all
SELECT COUNT(*) as total_returned
FROM get_fire_first_leaderboard_v2(20);

-- 4. Check top 5 from function with all details
SELECT 
    name,
    collection_name,
    total_votes,
    fire_votes,
    poa_score,
    leaderboard_position
FROM get_fire_first_leaderboard_v2(20)
ORDER BY leaderboard_position
LIMIT 5;
