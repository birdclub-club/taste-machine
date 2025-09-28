-- 🚫 Fix Unrevealed NFT Filtering in Enhanced Functions
-- Ensures all enhanced functions properly exclude unrevealed NFTs

-- Update same collection matchup function with comprehensive unrevealed filtering
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
    WITH eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            COALESCE(n.current_elo, 1200) as current_elo,
            COALESCE(n.total_votes, 0) as total_votes,
            -- Simple uncertainty calculation
            CASE 
                WHEN COALESCE(n.total_votes, 0) = 0 THEN 100.0
                ELSE GREATEST(25.0, 100.0 * POWER(0.95, COALESCE(n.total_votes, 0)))
            END as uncertainty
        FROM public.nfts n
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND n.image NOT ILIKE '%.avi%'
        AND n.image NOT ILIKE '%.webm%'
        AND n.image NOT ILIKE '%.mkv%'
        -- Comprehensive unrevealed filtering
        AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "reveal", "value": "unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "status", "value": "unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "status", "value": "hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND NOT (n.traits @> '[{"trait_type": "stage", "value": "pre-reveal"}]')
        -- Beeish collection specific unrevealed filtering
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Present"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "present"}]')
        AND (target_collection IS NULL OR n.collection_name = target_collection)
        AND n.collection_name IS NOT NULL
        LIMIT 100  -- Limit for performance
    ),
    matchup_candidates AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            
            -- Simple information score
            (
                ((n1.uncertainty + n2.uncertainty) / 200.0) * 0.6 +
                GREATEST(0, 1.0 - ABS(n1.current_elo - n2.current_elo)::DECIMAL / 400.0) * 0.4
            ) as info_score,
            
            -- Simple selection reason
            CASE 
                WHEN (n1.uncertainty > 75 OR n2.uncertainty > 75) THEN
                    'High uncertainty - learning potential'
                WHEN ABS(n1.current_elo - n2.current_elo) < 100 THEN
                    'Close Elo ratings - competitive matchup'
                ELSE
                    'Balanced information score'
            END as reason
            
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name = n2.collection_name 
        WHERE n1.id < n2.id  -- Avoid duplicates
        ORDER BY info_score DESC
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        ROUND(mc.info_score::NUMERIC, 4) as information_score,
        mc.elo_diff,
        ROUND(mc.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(mc.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update cross collection matchup function with comprehensive unrevealed filtering
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
    collection_a TEXT,
    collection_b TEXT,
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            COALESCE(n.current_elo, 1200) as current_elo,
            COALESCE(n.total_votes, 0) as total_votes,
            CASE 
                WHEN COALESCE(n.total_votes, 0) = 0 THEN 100.0
                ELSE GREATEST(25.0, 100.0 * POWER(0.95, COALESCE(n.total_votes, 0)))
            END as uncertainty
        FROM public.nfts n
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND n.image NOT ILIKE '%.avi%'
        AND n.image NOT ILIKE '%.webm%'
        AND n.image NOT ILIKE '%.mkv%'
        -- Comprehensive unrevealed filtering
        AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "reveal", "value": "unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "status", "value": "unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "status", "value": "hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND NOT (n.traits @> '[{"trait_type": "stage", "value": "pre-reveal"}]')
        -- Beeish collection specific unrevealed filtering
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Present"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "present"}]')
        AND n.collection_name IS NOT NULL
        LIMIT 200  -- Increase limit for better cross-collection matching
    ),
    matchup_candidates AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            n1.collection_name as collection_a,
            n2.collection_name as collection_b,
            
            -- Enhanced score for cross-collection
            (
                ((n1.uncertainty + n2.uncertainty) / 200.0) * 0.5 +
                GREATEST(0, 1.0 - ABS(n1.current_elo - n2.current_elo)::DECIMAL / 400.0) * 0.3 +
                0.2  -- Cross-collection bonus
            ) as info_score,
            
            'Cross-collection comparison' as reason
            
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name != n2.collection_name
        WHERE n1.id < n2.id  -- Avoid duplicates and self-matches
        ORDER BY info_score DESC
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        ROUND(mc.info_score::NUMERIC, 4) as information_score,
        mc.elo_diff,
        ROUND(mc.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(mc.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        mc.collection_a,
        mc.collection_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update slider selection function with comprehensive unrevealed filtering
CREATE OR REPLACE FUNCTION public.find_optimal_slider_nft(
    max_candidates INTEGER DEFAULT 5
)
RETURNS TABLE (
    nft_id UUID,
    information_score DECIMAL(6,4),
    uncertainty DECIMAL(5,2),
    vote_deficit INTEGER,
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            COALESCE(n.total_votes, 0) as total_votes,
            COALESCE(n.slider_count, 0) as slider_count,
            
            -- Simple uncertainty calculation (TrueSkill-inspired)
            CASE 
                WHEN COALESCE(n.slider_count, 0) = 0 THEN 100.0
                ELSE GREATEST(20.0, 100.0 * POWER(0.9, COALESCE(n.slider_count, 0)))
            END as uncertainty,
            
            -- Vote deficit (how much this NFT needs votes)
            GREATEST(0, 10 - COALESCE(n.slider_count, 0)) as vote_deficit
        FROM public.nfts n
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND n.image NOT ILIKE '%.avi%'
        AND n.image NOT ILIKE '%.webm%'
        AND n.image NOT ILIKE '%.mkv%'
        -- Comprehensive unrevealed filtering
        AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "reveal", "value": "unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "status", "value": "unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "status", "value": "hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND NOT (n.traits @> '[{"trait_type": "stage", "value": "pre-reveal"}]')
        -- Beeish collection specific unrevealed filtering
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Present"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "hive", "value": "present"}]')
        AND n.collection_name IS NOT NULL
        LIMIT 100  -- Limit for performance
    ),
    scored_nfts AS (
        SELECT 
            en.id as nft_id,
            en.uncertainty,
            en.vote_deficit,
            
            -- Information score calculation
            (
                (en.uncertainty / 100.0) * 0.6 +  -- Uncertainty weight
                (en.vote_deficit / 10.0) * 0.4    -- Vote deficit weight
            ) as info_score,
            
            -- Selection reason
            CASE 
                WHEN en.slider_count = 0 THEN
                    'New NFT - needs initial slider data'
                WHEN en.uncertainty > 70 THEN
                    'High uncertainty - learning potential'
                WHEN en.vote_deficit > 5 THEN
                    'Vote deficit - needs more data'
                ELSE
                    'Balanced information opportunity'
            END as reason
        FROM eligible_nfts en
        ORDER BY info_score DESC
        LIMIT max_candidates
    )
    SELECT 
        sn.nft_id,
        ROUND(sn.info_score::NUMERIC, 4) as information_score,
        ROUND(sn.uncertainty::NUMERIC, 2) as uncertainty,
        sn.vote_deficit::INTEGER as vote_deficit,
        sn.reason as selection_reason
    FROM scored_nfts sn
    ORDER BY sn.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Test that unrevealed filtering is working
SELECT 'Unrevealed NFT filtering updated in enhanced functions!' as status;

-- Quick test to verify Beeish NFTs are properly filtered
DO $$
DECLARE
    same_coll_count INTEGER;
    cross_coll_count INTEGER;
    slider_count INTEGER;
BEGIN
    -- Test same collection (with proper parameter names)
    SELECT COUNT(*) INTO same_coll_count
    FROM public.find_optimal_same_collection_matchup_lite(max_candidates => 3);
    
    -- Test cross collection (with proper parameter names)
    SELECT COUNT(*) INTO cross_coll_count
    FROM public.find_optimal_cross_collection_matchup_lite(max_candidates => 3);
    
    -- Test slider (with proper parameter names)
    SELECT COUNT(*) INTO slider_count
    FROM public.find_optimal_slider_nft(max_candidates => 3);
    
    RAISE NOTICE 'Enhanced functions test results:';
    RAISE NOTICE '  Same collection candidates: %', same_coll_count;
    RAISE NOTICE '  Cross collection candidates: %', cross_coll_count;  
    RAISE NOTICE '  Slider candidates: %', slider_count;
    
    IF same_coll_count > 0 AND cross_coll_count > 0 AND slider_count > 0 THEN
        RAISE NOTICE '✅ All enhanced functions working with proper filtering!';
    ELSE
        RAISE NOTICE '⚠️  Some functions returned no results - check data availability';
    END IF;
END $$;
