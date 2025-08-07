-- 🔄 STAGE 6B: Gradual Queue Population
-- Run this AFTER the lightweight setup (06-light) completes successfully
-- This populates the queue in small batches to avoid timeouts

-- ================================
-- 🎯 BATCH POPULATION FUNCTIONS
-- ================================

-- Function to add slider votes in batches
CREATE OR REPLACE FUNCTION add_slider_batch(batch_size INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
    added_count INTEGER := 0;
BEGIN
    INSERT INTO public.matchup_queue (vote_type, slider_nft_id, priority_score)
    SELECT 
        'slider',
        id,
        CASE 
            WHEN slider_count = 0 THEN 100
            WHEN slider_count < 3 THEN 75
            WHEN slider_count < 5 THEN 50
            ELSE 25
        END as priority
    FROM public.nfts 
    WHERE slider_count < 10
    AND id NOT IN (SELECT slider_nft_id FROM public.matchup_queue WHERE vote_type = 'slider' AND slider_nft_id IS NOT NULL)
    ORDER BY slider_count ASC, total_votes ASC, RANDOM()
    LIMIT batch_size;
    
    GET DIAGNOSTICS added_count = ROW_COUNT;
    RETURN added_count;
END;
$$ LANGUAGE plpgsql;

-- Function to add same collection matchups in batches
CREATE OR REPLACE FUNCTION add_same_coll_batch(batch_size INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
    added_count INTEGER := 0;
BEGIN
    INSERT INTO public.matchup_queue (vote_type, nft_a_id, nft_b_id, elo_diff, priority_score)
    SELECT 
        'same_coll',
        a.id,
        b.id,
        ABS(a.current_elo - b.current_elo) as elo_diff,
        CASE 
            WHEN ABS(a.current_elo - b.current_elo) < 50 THEN 75
            WHEN ABS(a.current_elo - b.current_elo) < 100 THEN 50
            ELSE 25
        END as priority
    FROM public.nfts a
    JOIN public.nfts b ON a.collection_name = b.collection_name AND a.id < b.id
    WHERE ABS(a.current_elo - b.current_elo) < 200
    AND NOT EXISTS (
        SELECT 1 FROM public.matchup_queue 
        WHERE vote_type = 'same_coll'
        AND ((nft_a_id = a.id AND nft_b_id = b.id) OR (nft_a_id = b.id AND nft_b_id = a.id))
    )
    ORDER BY ABS(a.current_elo - b.current_elo), RANDOM()
    LIMIT batch_size;
    
    GET DIAGNOSTICS added_count = ROW_COUNT;
    RETURN added_count;
END;
$$ LANGUAGE plpgsql;

-- Function to add cross collection matchups in batches
CREATE OR REPLACE FUNCTION add_cross_coll_batch(batch_size INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
    added_count INTEGER := 0;
BEGIN
    INSERT INTO public.matchup_queue (vote_type, nft_a_id, nft_b_id, elo_diff, priority_score)
    SELECT 
        'cross_coll',
        a.id,
        b.id,
        ABS(a.current_elo - b.current_elo) as elo_diff,
        CASE 
            WHEN ABS(a.current_elo - b.current_elo) BETWEEN 50 AND 150 THEN 75
            WHEN ABS(a.current_elo - b.current_elo) BETWEEN 25 AND 200 THEN 50
            ELSE 25
        END as priority
    FROM public.nfts a
    JOIN public.nfts b ON a.collection_name != b.collection_name
    WHERE ABS(a.current_elo - b.current_elo) BETWEEN 25 AND 300
    AND NOT EXISTS (
        SELECT 1 FROM public.matchup_queue 
        WHERE vote_type = 'cross_coll'
        AND ((nft_a_id = a.id AND nft_b_id = b.id) OR (nft_a_id = b.id AND nft_b_id = a.id))
    )
    ORDER BY ABS(a.current_elo - b.current_elo), RANDOM()
    LIMIT batch_size;
    
    GET DIAGNOSTICS added_count = ROW_COUNT;
    RETURN added_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🚀 POPULATE IN SMALL BATCHES
-- ================================

-- Populate slider queue (small batches)
SELECT add_slider_batch(15) as slider_added;
SELECT add_slider_batch(15) as slider_added_2;

-- Show progress
SELECT 'Slider votes added: ' || COUNT(*)::TEXT FROM public.matchup_queue WHERE vote_type = 'slider';

-- Populate same collection queue (small batches)
SELECT add_same_coll_batch(10) as same_coll_added;
SELECT add_same_coll_batch(10) as same_coll_added_2;

-- Show progress
SELECT 'Same collection matchups: ' || COUNT(*)::TEXT FROM public.matchup_queue WHERE vote_type = 'same_coll';

-- Populate cross collection queue (small batches)
SELECT add_cross_coll_batch(10) as cross_coll_added;
SELECT add_cross_coll_batch(10) as cross_coll_added_2;

-- Show final status
SELECT 
    vote_type,
    COUNT(*) as ready_matchups,
    AVG(priority_score)::DECIMAL(10,2) as avg_priority
FROM public.matchup_queue
WHERE reserved_until IS NULL OR reserved_until < NOW()
GROUP BY vote_type
ORDER BY vote_type;

-- Record completion
INSERT INTO public.migration_status (stage, description, notes)
VALUES (7, 'Queue populated in batches - ready for high-speed voting', 'Gradual population completed successfully');

COMMIT;