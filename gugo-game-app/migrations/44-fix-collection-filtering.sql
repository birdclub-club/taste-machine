-- 🎛️ Fix Collection Filtering in Enhanced Functions
-- Updates all enhanced functions to properly respect active/inactive collection settings

-- Update enhanced slider function to filter by active collections
CREATE OR REPLACE FUNCTION public.find_optimal_slider_nft(
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
        -- Get collections that are explicitly set as active, or default to active if not in management table
        SELECT DISTINCT n.collection_name
        FROM public.nfts n
        LEFT JOIN public.collection_management cm ON n.collection_name = cm.collection_name
        WHERE COALESCE(cm.active, true) = true  -- Default to active if not in management table
          AND n.collection_name IS NOT NULL
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            n.total_votes,
            n.slider_count,
            n.current_elo,
            -- Simple uncertainty calculation (higher for fewer votes)
            CASE 
                WHEN n.total_votes <= 1 THEN 0.95
                WHEN n.total_votes <= 3 THEN 0.80
                WHEN n.total_votes <= 7 THEN 0.60
                WHEN n.total_votes <= 15 THEN 0.40
                ELSE 0.20
            END as uncertainty_score,
            -- Information potential (prioritize high uncertainty, low slider counts)
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
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name  -- Only active collections
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
        FORMAT('High uncertainty (%s votes), slider priority', en.total_votes) as selection_reason
    FROM eligible_nfts en
    ORDER BY en.info_potential DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update enhanced same collection function to filter by active collections
CREATE OR REPLACE FUNCTION public.find_optimal_same_collection_matchup_lite(
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
        -- Get collections that are explicitly set as active, or default to active if not in management table
        SELECT DISTINCT n.collection_name
        FROM public.nfts n
        LEFT JOIN public.collection_management cm ON n.collection_name = cm.collection_name
        WHERE COALESCE(cm.active, true) = true  -- Default to active if not in management table
          AND n.collection_name IS NOT NULL
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            -- Simple uncertainty buckets for performance
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
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name  -- Only active collections
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
          AND (target_collection IS NULL OR n.collection_name = target_collection)
        ORDER BY RANDOM()
        LIMIT 100  -- Limit dataset for performance
    ),
    collection_groups AS (
        SELECT 
            collection_name,
            COUNT(*) as nft_count
        FROM eligible_nfts
        GROUP BY collection_name
        HAVING COUNT(*) >= 2  -- Need at least 2 NFTs for same collection matchup
        ORDER BY RANDOM()
        LIMIT 10  -- Limit collections for performance
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
            (n1.uncertainty + n2.uncertainty) * 0.5 +  -- Average uncertainty
            (n1.vote_deficit + n2.vote_deficit) * 0.3 +  -- Vote deficit bonus
            (CASE 
                WHEN ABS(n1.current_elo - n2.current_elo) <= 100 THEN 0.20
                WHEN ABS(n1.current_elo - n2.current_elo) <= 200 THEN 0.15
                ELSE 0.05
            END) as info_score  -- Elo proximity bonus
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
        FORMAT('Same collection (%s), Elo diff: %s', pm.collection_name, pm.elo_diff) as selection_reason
    FROM potential_matchups pm
    ORDER BY pm.info_score DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update enhanced cross collection function to filter by active collections
CREATE OR REPLACE FUNCTION public.find_optimal_cross_collection_matchup_lite(
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
        -- Get collections that are explicitly set as active, or default to active if not in management table
        SELECT DISTINCT n.collection_name
        FROM public.nfts n
        LEFT JOIN public.collection_management cm ON n.collection_name = cm.collection_name
        WHERE COALESCE(cm.active, true) = true  -- Default to active if not in management table
          AND n.collection_name IS NOT NULL
    ),
    collection_counts AS (
        SELECT 
            n.collection_name,
            COUNT(*) as nft_count
        FROM public.nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name  -- Only active collections
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
        GROUP BY n.collection_name
        ORDER BY nft_count DESC
        LIMIT 8  -- Top 8 active collections only
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
        INNER JOIN collection_counts cc ON n.collection_name = cc.collection_name  -- Only from top active collections
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
        ORDER BY RANDOM()
        LIMIT 200  -- Limit for performance
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
            (n1.uncertainty + n2.uncertainty) * 0.5 +  -- Average uncertainty
            (n1.vote_deficit + n2.vote_deficit) * 0.3 +  -- Vote deficit bonus
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
        FORMAT('Cross-collection (%s vs %s), Elo diff: %s', pm.collection_a, pm.collection_b, pm.elo_diff) as selection_reason
    FROM potential_matchups pm
    ORDER BY pm.info_score DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

