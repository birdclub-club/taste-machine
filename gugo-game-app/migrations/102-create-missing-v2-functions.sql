-- 🔧 Create Missing V2 Enhanced Functions
-- The system health check is looking for v2 functions that don't exist
-- This creates them as aliases to the existing lite functions

-- Create find_optimal_same_collection_matchup_v2 as alias to lite version
CREATE OR REPLACE FUNCTION public.find_optimal_same_collection_matchup_v2(
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
    -- Simply call the existing lite function
    RETURN QUERY
    SELECT * FROM public.find_optimal_same_collection_matchup_lite(target_collection, max_candidates);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create find_optimal_cross_collection_matchup_v2 if it doesn't exist
CREATE OR REPLACE FUNCTION public.find_optimal_cross_collection_matchup_v2(
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
            COALESCE(n.current_elo, 1200) as current_elo,
            COALESCE(n.total_votes, 0) as total_votes,
            -- Simplified uncertainty (faster calculation)
            CASE 
                WHEN COALESCE(n.total_votes, 0) = 0 THEN 100.0
                WHEN COALESCE(n.total_votes, 0) < 5 THEN 80.0
                WHEN COALESCE(n.total_votes, 0) < 15 THEN 60.0
                ELSE 40.0
            END as uncertainty
        FROM public.nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        -- Simplified unrevealed filtering (faster)
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Present"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND n.collection_name IS NOT NULL
        LIMIT 100  -- Limit for performance
    ),
    cross_collection_pairs AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            -- Information score based on uncertainty and elo difference
            (n1.uncertainty + n2.uncertainty) * 0.6 + 
            (ABS(n1.current_elo - n2.current_elo) / 100.0) * 0.4 as information_score,
            ABS(n1.current_elo - n2.current_elo) as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            'Cross-collection matchup for diversity' as selection_reason
        FROM eligible_nfts n1
        CROSS JOIN eligible_nfts n2
        WHERE n1.collection_name != n2.collection_name  -- Different collections
        AND n1.id < n2.id  -- Prevent duplicates
    )
    SELECT 
        cp.nft_a_id,
        cp.nft_b_id,
        cp.information_score::DECIMAL(6,4),
        cp.elo_diff::INTEGER,
        cp.uncertainty_a::DECIMAL(5,2),
        cp.uncertainty_b::DECIMAL(5,2),
        cp.selection_reason
    FROM cross_collection_pairs cp
    ORDER BY cp.information_score DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create find_optimal_slider_nft_v2 if it doesn't exist
CREATE OR REPLACE FUNCTION public.find_optimal_slider_nft_v2(
    max_candidates INTEGER DEFAULT 5
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
            COALESCE(n.slider_count, 0) as slider_count,
            COALESCE(n.total_votes, 0) as total_votes,
            -- Calculate uncertainty for slider voting
            CASE 
                WHEN COALESCE(n.slider_count, 0) = 0 THEN 100.0
                WHEN COALESCE(n.slider_count, 0) < 3 THEN 80.0
                WHEN COALESCE(n.slider_count, 0) < 8 THEN 60.0
                ELSE 40.0
            END as uncertainty,
            -- Information potential (higher for less-rated NFTs)
            CASE 
                WHEN COALESCE(n.slider_count, 0) = 0 THEN 100.0
                WHEN COALESCE(n.slider_count, 0) < 5 THEN 80.0
                ELSE 50.0
            END as info_potential
        FROM public.nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        -- Simplified unrevealed filtering
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Present"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND n.collection_name IS NOT NULL
    )
    SELECT 
        en.id as nft_id,
        en.info_potential::DECIMAL(6,4) as information_score,
        en.uncertainty::DECIMAL(5,2),
        'High information potential for slider rating' as selection_reason
    FROM eligible_nfts en
    ORDER BY en.info_potential DESC, RANDOM()
    LIMIT max_candidates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verify the functions were created
SELECT 
    routine_name, 
    routine_type,
    specific_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%_v2'
ORDER BY routine_name;
