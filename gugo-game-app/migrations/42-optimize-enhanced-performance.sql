-- 🚀 Optimize Enhanced Matchup Performance
-- Faster, more efficient enhanced functions

-- Create ultra-fast same collection matchup (reduced complexity)
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
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        -- Simplified unrevealed filtering (faster)
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Zombee"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Present"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND (target_collection IS NULL OR n.collection_name = target_collection)
        AND n.collection_name IS NOT NULL
        LIMIT 50  -- Reduced limit for speed
    ),
    matchup_candidates AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            
            -- Simplified scoring (faster)
            CASE 
                WHEN (n1.uncertainty > 70 OR n2.uncertainty > 70) THEN 1.0
                WHEN ABS(n1.current_elo - n2.current_elo) < 100 THEN 0.9
                ELSE 0.8
            END as info_score,
            
            -- Fast selection reason
            CASE 
                WHEN (n1.uncertainty > 70 OR n2.uncertainty > 70) THEN 'High learning potential'
                WHEN ABS(n1.current_elo - n2.current_elo) < 100 THEN 'Competitive matchup'
                ELSE 'Balanced pairing'
            END as reason
            
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name = n2.collection_name 
        WHERE n1.id < n2.id
        ORDER BY info_score DESC, RANDOM()  -- Add randomness for variety
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        mc.info_score::DECIMAL(6,4) as information_score,
        mc.elo_diff,
        mc.uncertainty_a::DECIMAL(5,2) as uncertainty_a,
        mc.uncertainty_b::DECIMAL(5,2) as uncertainty_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create ultra-fast cross collection matchup (simplified)
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
    WITH popular_collections AS (
        -- Only use top collections for speed
        SELECT collection_name
        FROM public.nfts 
        WHERE collection_name IS NOT NULL
        AND image NOT ILIKE '%.mp4%'
        AND image NOT ILIKE '%.mov%'
        GROUP BY collection_name
        HAVING COUNT(*) > 100  -- Only collections with enough NFTs
        ORDER BY COUNT(*) DESC
        LIMIT 8  -- Top 8 collections only
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.collection_name,
            COALESCE(n.current_elo, 1200) as current_elo,
            COALESCE(n.total_votes, 0) as total_votes,
            -- Simplified uncertainty
            CASE 
                WHEN COALESCE(n.total_votes, 0) = 0 THEN 100.0
                WHEN COALESCE(n.total_votes, 0) < 5 THEN 80.0
                ELSE 50.0
            END as uncertainty
        FROM public.nfts n
        JOIN popular_collections pc ON n.collection_name = pc.collection_name
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        -- Fast unrevealed filtering (key collections only)
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Robot"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        ORDER BY RANDOM()  -- Randomize for variety
        LIMIT 40  -- Much smaller limit for speed
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
            
            -- Simplified cross-collection scoring
            CASE 
                WHEN (n1.uncertainty > 70 OR n2.uncertainty > 70) THEN 1.0
                WHEN ABS(n1.current_elo - n2.current_elo) < 150 THEN 0.95
                ELSE 0.85
            END as info_score,
            
            'Cross-collection variety' as reason
            
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name != n2.collection_name
        WHERE n1.id < n2.id
        ORDER BY info_score DESC, RANDOM()
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        mc.info_score::DECIMAL(6,4) as information_score,
        mc.elo_diff,
        mc.uncertainty_a::DECIMAL(5,2) as uncertainty_a,
        mc.uncertainty_b::DECIMAL(5,2) as uncertainty_b,
        mc.collection_a,
        mc.collection_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create ultra-fast slider selection
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
            COALESCE(n.slider_count, 0) as slider_count,
            COALESCE(n.total_votes, 0) as total_votes,
            -- Fast uncertainty calculation
            CASE 
                WHEN COALESCE(n.slider_count, 0) = 0 THEN 100.0
                WHEN COALESCE(n.slider_count, 0) < 3 THEN 80.0
                ELSE 50.0
            END as uncertainty,
            -- Simple vote deficit
            GREATEST(0, 5 - COALESCE(n.slider_count, 0)) as vote_deficit
        FROM public.nfts n
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        -- Fast filtering
        AND NOT (n.traits @> '[{"trait_type": "Hive", "value": "Regular"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND n.collection_name IS NOT NULL
        AND COALESCE(n.slider_count, 0) < 5  -- Focus on NFTs that need votes
        ORDER BY n.slider_count ASC, RANDOM()
        LIMIT 20  -- Small limit for speed
    ),
    scored_nfts AS (
        SELECT 
            en.id as nft_id,
            en.uncertainty,
            en.vote_deficit,
            -- Simple scoring
            CASE 
                WHEN en.slider_count = 0 THEN 1.0
                WHEN en.slider_count < 3 THEN 0.8
                ELSE 0.6
            END as info_score,
            -- Fast reason
            CASE 
                WHEN en.slider_count = 0 THEN 'New NFT needs data'
                WHEN en.slider_count < 3 THEN 'Low vote count'
                ELSE 'Balanced selection'
            END as reason
        FROM eligible_nfts en
        ORDER BY info_score DESC, RANDOM()
        LIMIT max_candidates
    )
    SELECT 
        sn.nft_id,
        sn.info_score::DECIMAL(6,4) as information_score,
        sn.uncertainty::DECIMAL(5,2) as uncertainty,
        sn.vote_deficit::INTEGER as vote_deficit,
        sn.reason as selection_reason
    FROM scored_nfts sn
    ORDER BY sn.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Performance test
SELECT 'Optimized enhanced functions deployed!' as status;

