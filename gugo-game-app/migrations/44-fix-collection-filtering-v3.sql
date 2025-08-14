-- 🎛️ Fix Collection Filtering - Force Drop and Recreate (v3)
-- Aggressively drops all variations of the functions first

-- Drop all possible variations of the functions
DROP FUNCTION IF EXISTS public.find_optimal_slider_nft();
DROP FUNCTION IF EXISTS public.find_optimal_slider_nft(integer);
DROP FUNCTION IF EXISTS public.find_optimal_slider_nft(int);
DROP FUNCTION IF EXISTS find_optimal_slider_nft();
DROP FUNCTION IF EXISTS find_optimal_slider_nft(integer);
DROP FUNCTION IF EXISTS find_optimal_slider_nft(int);

DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite();
DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite(text);
DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite(text, integer);
DROP FUNCTION IF EXISTS public.find_optimal_same_collection_matchup_lite(text, int);
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite();
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite(text);
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite(text, integer);
DROP FUNCTION IF EXISTS find_optimal_same_collection_matchup_lite(text, int);

DROP FUNCTION IF EXISTS public.find_optimal_cross_collection_matchup_lite();
DROP FUNCTION IF EXISTS public.find_optimal_cross_collection_matchup_lite(integer);
DROP FUNCTION IF EXISTS public.find_optimal_cross_collection_matchup_lite(int);
DROP FUNCTION IF EXISTS find_optimal_cross_collection_matchup_lite();
DROP FUNCTION IF EXISTS find_optimal_cross_collection_matchup_lite(integer);
DROP FUNCTION IF EXISTS find_optimal_cross_collection_matchup_lite(int);

-- Now recreate with collection filtering

-- Enhanced slider function with active collection filtering
CREATE FUNCTION public.find_optimal_slider_nft(
    max_candidates INTEGER DEFAULT 10
)
RETURNS TABLE (
    nft_id UUID,
    information_score DECIMAL(6,4),
    uncertainty DECIMAL(5,2),
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH active_collections AS (
        -- Get collections that are active (default to true if not in management table)
        SELECT DISTINCT n.collection_name
        FROM public.nfts n
        LEFT JOIN public.collection_management cm ON n.collection_name = cm.collection_name
        WHERE COALESCE(cm.active, true) = true
          AND n.collection_name IS NOT NULL
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            n.total_votes,
            n.slider_count,
            -- Simple uncertainty calculation
            CASE 
                WHEN n.total_votes <= 1 THEN 0.95
                WHEN n.total_votes <= 3 THEN 0.80
                WHEN n.total_votes <= 7 THEN 0.60
                WHEN n.total_votes <= 15 THEN 0.40
                ELSE 0.20
            END as uncertainty_score,
            -- Information potential
            (CASE 
                WHEN n.total_votes <= 1 THEN 0.95
                WHEN n.total_votes <= 3 THEN 0.80
                WHEN n.total_votes <= 7 THEN 0.60
                WHEN n.total_votes <= 15 THEN 0.40
                ELSE 0.20
            END * 0.7) + 
            (CASE 
                WHEN COALESCE(n.slider_count, 0) = 0 THEN 0.30
                WHEN COALESCE(n.slider_count, 0) <= 2 THEN 0.20
                ELSE 0.10
            END * 0.3) as info_potential
        FROM public.nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
        ORDER BY info_potential DESC, RANDOM()
        LIMIT 50
    )
    SELECT 
        en.id as nft_id,
        ROUND(en.info_potential::NUMERIC, 4) as information_score,
        ROUND(en.uncertainty_score::NUMERIC, 2) as uncertainty,
        FORMAT('Active collection (%s), %s votes', en.collection_name, en.total_votes) as selection_reason
    FROM eligible_nfts en
    ORDER BY en.info_potential DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced same collection function with active collection filtering
CREATE FUNCTION public.find_optimal_same_collection_matchup_lite(
    target_collection TEXT DEFAULT NULL,
    max_candidates INTEGER DEFAULT 10
)
RETURNS TABLE (
    nft_a_id UUID,
    nft_b_id UUID,
    information_score DECIMAL(6,4),
    elo_diff INTEGER,
    uncertainty_a DECIMAL(5,2),
    uncertainty_b DECIMAL(5,2),
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH active_collections AS (
        -- Get collections that are active
        SELECT DISTINCT n.collection_name
        FROM public.nfts n
        LEFT JOIN public.collection_management cm ON n.collection_name = cm.collection_name
        WHERE COALESCE(cm.active, true) = true
          AND n.collection_name IS NOT NULL
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            -- Simple uncertainty buckets
            CASE 
                WHEN n.total_votes <= 1 THEN 0.95
                WHEN n.total_votes <= 5 THEN 0.70
                WHEN n.total_votes <= 15 THEN 0.40
                ELSE 0.20
            END as uncertainty,
            -- Vote deficit score
            CASE 
                WHEN n.total_votes <= 3 THEN 0.30
                WHEN n.total_votes <= 7 THEN 0.20
                ELSE 0.10
            END as vote_deficit
        FROM public.nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
          AND (target_collection IS NULL OR n.collection_name = target_collection)
        ORDER BY RANDOM()
        LIMIT 100
    ),
    collection_groups AS (
        SELECT 
            collection_name,
            COUNT(*) as nft_count
        FROM eligible_nfts
        GROUP BY collection_name
        HAVING COUNT(*) >= 2
        ORDER BY RANDOM()
        LIMIT 10
    ),
    potential_matchups AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            n1.collection_name,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            -- Information score calculation
            (n1.uncertainty + n2.uncertainty) * 0.5 +
            (n1.vote_deficit + n2.vote_deficit) * 0.3 +
            (CASE 
                WHEN ABS(n1.current_elo - n2.current_elo) <= 100 THEN 0.20
                WHEN ABS(n1.current_elo - n2.current_elo) <= 200 THEN 0.15
                ELSE 0.05
            END) as info_score
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name = n2.collection_name AND n1.id < n2.id
        JOIN collection_groups cg ON n1.collection_name = cg.collection_name
    )
    SELECT 
        pm.nft_a_id,
        pm.nft_b_id,
        ROUND(pm.info_score::NUMERIC, 4) as information_score,
        pm.elo_diff,
        ROUND(pm.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(pm.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        FORMAT('Active collection (%s), Elo diff: %s', pm.collection_name, pm.elo_diff) as selection_reason
    FROM potential_matchups pm
    ORDER BY pm.info_score DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced cross collection function with active collection filtering
CREATE FUNCTION public.find_optimal_cross_collection_matchup_lite(
    max_candidates INTEGER DEFAULT 10
)
RETURNS TABLE (
    nft_a_id UUID,
    nft_b_id UUID,
    information_score DECIMAL(6,4),
    elo_diff INTEGER,
    uncertainty_a DECIMAL(5,2),
    uncertainty_b DECIMAL(5,2),
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH active_collections AS (
        -- Get collections that are active
        SELECT DISTINCT n.collection_name
        FROM public.nfts n
        LEFT JOIN public.collection_management cm ON n.collection_name = cm.collection_name
        WHERE COALESCE(cm.active, true) = true
          AND n.collection_name IS NOT NULL
    ),
    collection_counts AS (
        SELECT 
            n.collection_name,
            COUNT(*) as nft_count
        FROM public.nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
        GROUP BY n.collection_name
        ORDER BY nft_count DESC
        LIMIT 8
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            -- Simple uncertainty buckets
            CASE 
                WHEN n.total_votes <= 1 THEN 0.95
                WHEN n.total_votes <= 5 THEN 0.70
                WHEN n.total_votes <= 15 THEN 0.40
                ELSE 0.20
            END as uncertainty,
            -- Vote deficit score
            CASE 
                WHEN n.total_votes <= 3 THEN 0.30
                WHEN n.total_votes <= 7 THEN 0.20
                ELSE 0.10
            END as vote_deficit
        FROM public.nfts n
        INNER JOIN collection_counts cc ON n.collection_name = cc.collection_name
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
        ORDER BY RANDOM()
        LIMIT 200
    ),
    potential_matchups AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            n1.collection_name as collection_a,
            n2.collection_name as collection_b,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            -- Information score with cross-collection bonus
            (n1.uncertainty + n2.uncertainty) * 0.5 +
            (n1.vote_deficit + n2.vote_deficit) * 0.3 +
            0.2 +  -- Cross-collection bonus
            (CASE 
                WHEN ABS(n1.current_elo - n2.current_elo) <= 100 THEN 0.20
                WHEN ABS(n1.current_elo - n2.current_elo) <= 200 THEN 0.15
                ELSE 0.05
            END) as info_score
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name != n2.collection_name AND n1.id < n2.id
    )
    SELECT 
        pm.nft_a_id,
        pm.nft_b_id,
        ROUND(pm.info_score::NUMERIC, 4) as information_score,
        pm.elo_diff,
        ROUND(pm.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(pm.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        FORMAT('Active collections (%s vs %s), Elo diff: %s', pm.collection_a, pm.collection_b, pm.elo_diff) as selection_reason
    FROM potential_matchups pm
    ORDER BY pm.info_score DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

