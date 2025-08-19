-- 🎛️ Fix Slider V2 Function Collection Filtering
-- The slider v2 function was missing collection management filtering
-- This adds the same collection filtering logic as the other v2 functions

CREATE OR REPLACE FUNCTION public.find_optimal_slider_nft_v2(
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
    WITH active_collections AS (
        -- Get collections that are explicitly marked as active
        SELECT DISTINCT cm.collection_name
        FROM public.collection_management cm
        WHERE cm.active = true
          AND cm.collection_name IS NOT NULL
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            COALESCE(n.slider_count, 0) as slider_count,
            COALESCE(n.total_votes, 0) as total_votes,
            -- Ultra-fast uncertainty
            CASE 
                WHEN COALESCE(n.slider_count, 0) = 0 THEN 100.0
                WHEN COALESCE(n.slider_count, 0) < 3 THEN 80.0
                ELSE 50.0
            END as uncertainty,
            -- Simple deficit calculation
            GREATEST(0, 5 - COALESCE(n.slider_count, 0)) as vote_deficit
        FROM nfts n
        INNER JOIN active_collections ac ON n.collection_name = ac.collection_name  -- ← ADDED COLLECTION FILTERING
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        -- Minimal filtering for maximum speed
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND n.collection_name IS NOT NULL
        AND COALESCE(n.slider_count, 0) < 8  -- Focus on NFTs that need votes
        ORDER BY n.slider_count ASC  -- Deterministic ordering
        LIMIT 15  -- Small limit for speed
    ),
    scored_nfts AS (
        SELECT 
            en.id as nft_id,
            en.uncertainty,
            en.vote_deficit,
            -- Ultra-simple scoring
            CASE 
                WHEN en.slider_count = 0 THEN 1.0
                WHEN en.slider_count < 3 THEN 0.8
                ELSE 0.6
            END as info_score,
            -- Fast reason
            CASE 
                WHEN en.slider_count = 0 THEN 'New NFT needs data'
                ELSE 'Low vote count'
            END as reason
        FROM eligible_nfts en
        ORDER BY info_score DESC
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
