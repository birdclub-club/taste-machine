-- 🎛️ Fix Collection Filtering - STRICT MODE (v4)
-- Only include collections that are EXPLICITLY marked as active
-- This fixes the issue where Fugz appears despite being marked inactive

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

-- Enhanced slider function with STRICT active collection filtering
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
        -- STRICT: Only collections explicitly marked as active
        SELECT DISTINCT cm.collection_name
        FROM public.collection_management cm
        WHERE cm.active = true
          AND cm.collection_name IS NOT NULL
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
        CASE 
            WHEN en.total_votes = 0 THEN 'New NFT needs data'
            WHEN en.total_votes <= 3 THEN 'Low vote count'
            WHEN COALESCE(en.slider_count, 0) = 0 THEN 'No slider data'
            ELSE 'Information gathering'
        END as selection_reason
    FROM eligible_nfts en
    ORDER BY en.info_potential DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced same collection function with STRICT active collection filtering
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
        -- STRICT: Only collections explicitly marked as active
        SELECT DISTINCT cm.collection_name
        FROM public.collection_management cm
        WHERE cm.active = true
          AND cm.collection_name IS NOT NULL
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            -- Simple uncertainty calculation
            CASE 
                WHEN n.total_votes <= 1 THEN 0.95
                WHEN n.total_votes <= 3 THEN 0.80
                WHEN n.total_votes <= 7 THEN 0.60
                WHEN n.total_votes <= 15 THEN 0.40
                ELSE 0.20
            END as uncertainty_score
        FROM public.nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
          AND (target_collection IS NULL OR n.collection_name = target_collection)
    ),
    collection_pairs AS (
        SELECT 
            a.id as nft_a_id,
            b.id as nft_b_id,
            a.collection_name,
            ABS(a.current_elo - b.current_elo) as elo_diff,
            a.uncertainty_score as uncertainty_a,
            b.uncertainty_score as uncertainty_b,
            -- Information score based on uncertainty and elo difference
            (a.uncertainty_score + b.uncertainty_score) * 0.6 + 
            (CASE 
                WHEN ABS(a.current_elo - b.current_elo) BETWEEN 50 AND 200 THEN 0.4
                WHEN ABS(a.current_elo - b.current_elo) BETWEEN 20 AND 300 THEN 0.3
                ELSE 0.2
            END) as info_score
        FROM eligible_nfts a
        CROSS JOIN eligible_nfts b
        WHERE a.id != b.id
          AND a.collection_name = b.collection_name
        ORDER BY info_score DESC, RANDOM()
        LIMIT max_candidates * 2
    )
    SELECT 
        cp.nft_a_id,
        cp.nft_b_id,
        ROUND(cp.info_score::NUMERIC, 4) as information_score,
        cp.elo_diff::INTEGER,
        ROUND(cp.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(cp.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        CASE 
            WHEN cp.elo_diff BETWEEN 50 AND 200 THEN 'Optimal elo difference'
            WHEN cp.uncertainty_a > 0.7 OR cp.uncertainty_b > 0.7 THEN 'High uncertainty matchup'
            ELSE 'Information gathering'
        END as selection_reason
    FROM collection_pairs cp
    ORDER BY cp.info_score DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced cross collection function with STRICT active collection filtering
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
        -- STRICT: Only collections explicitly marked as active
        SELECT DISTINCT cm.collection_name
        FROM public.collection_management cm
        WHERE cm.active = true
          AND cm.collection_name IS NOT NULL
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
        LIMIT 8  -- Top 8 active collections only
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            -- Simple uncertainty calculation
            CASE 
                WHEN n.total_votes <= 1 THEN 0.95
                WHEN n.total_votes <= 3 THEN 0.80
                WHEN n.total_votes <= 7 THEN 0.60
                WHEN n.total_votes <= 15 THEN 0.40
                ELSE 0.20
            END as uncertainty_score
        FROM public.nfts n
        INNER JOIN collection_counts cc ON n.collection_name = cc.collection_name
        WHERE n.current_elo IS NOT NULL
          AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
          AND NOT (n.traits @> '[{"trait_type": "revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Revealed", "value": "false"}]')
          AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Unrevealed"}]')
    ),
    cross_collection_pairs AS (
        SELECT 
            a.id as nft_a_id,
            b.id as nft_b_id,
            a.collection_name as collection_a,
            b.collection_name as collection_b,
            ABS(a.current_elo - b.current_elo) as elo_diff,
            a.uncertainty_score as uncertainty_a,
            b.uncertainty_score as uncertainty_b,
            -- Information score for cross-collection
            (a.uncertainty_score + b.uncertainty_score) * 0.5 + 
            (CASE 
                WHEN ABS(a.current_elo - b.current_elo) BETWEEN 50 AND 200 THEN 0.4
                WHEN ABS(a.current_elo - b.current_elo) BETWEEN 20 AND 300 THEN 0.3
                ELSE 0.2
            END) + 0.1 as info_score  -- Cross-collection bonus
        FROM eligible_nfts a
        CROSS JOIN eligible_nfts b
        WHERE a.id != b.id
          AND a.collection_name != b.collection_name
        ORDER BY info_score DESC, RANDOM()
        LIMIT max_candidates * 2
    )
    SELECT 
        ccp.nft_a_id,
        ccp.nft_b_id,
        ROUND(ccp.info_score::NUMERIC, 4) as information_score,
        ccp.elo_diff::INTEGER,
        ROUND(ccp.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(ccp.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        CASE 
            WHEN ccp.elo_diff BETWEEN 50 AND 200 THEN 'Cross-collection optimal elo'
            WHEN ccp.uncertainty_a > 0.7 OR ccp.uncertainty_b > 0.7 THEN 'Cross-collection high uncertainty'
            ELSE 'Cross-collection information'
        END as selection_reason
    FROM cross_collection_pairs ccp
    ORDER BY ccp.info_score DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
