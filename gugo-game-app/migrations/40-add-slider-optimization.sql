-- 🎚️ Enhanced Slider NFT Selection
-- Adds optimized slider selection for enhanced integration

-- Create optimized slider selection function
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.find_optimal_slider_nft(INTEGER) TO anon, authenticated;

-- Test the function
SELECT 'Enhanced Slider Optimization Function Added!' as status;

