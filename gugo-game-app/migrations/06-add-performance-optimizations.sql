-- 🚀 STAGE 6: Performance Optimizations - Matchup Queue System
-- This adds instant matchup delivery for fast voting experience
-- Run this after Stage 2 migration is complete

-- ================================
-- 🏎️ MATCHUP QUEUE TABLE
-- ================================

-- Create pre-generated matchup queue for instant delivery
CREATE TABLE IF NOT EXISTS public.matchup_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('same_coll', 'cross_coll', 'slider')),
    
    -- For matchup votes (same_coll, cross_coll)
    nft_a_id UUID REFERENCES public.nfts(id),
    nft_b_id UUID REFERENCES public.nfts(id),
    
    -- For slider votes
    slider_nft_id UUID REFERENCES public.nfts(id),
    
    -- Metadata
    elo_diff FLOAT,
    priority_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reserved_until TIMESTAMP WITH TIME ZONE,
    reserved_by TEXT,
    
    -- Constraints
    CHECK (
        (vote_type IN ('same_coll', 'cross_coll') AND nft_a_id IS NOT NULL AND nft_b_id IS NOT NULL AND slider_nft_id IS NULL)
        OR 
        (vote_type = 'slider' AND slider_nft_id IS NOT NULL AND nft_a_id IS NULL AND nft_b_id IS NULL)
    ),
    CHECK (nft_a_id != nft_b_id OR nft_a_id IS NULL OR nft_b_id IS NULL)
);

-- Indexes for lightning-fast queue operations
CREATE INDEX IF NOT EXISTS idx_matchup_queue_vote_type ON public.matchup_queue(vote_type);
CREATE INDEX IF NOT EXISTS idx_matchup_queue_priority ON public.matchup_queue(priority_score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_matchup_queue_available ON public.matchup_queue(vote_type, priority_score DESC) 
    WHERE reserved_until IS NULL OR reserved_until < NOW();
CREATE INDEX IF NOT EXISTS idx_matchup_queue_reserved ON public.matchup_queue(reserved_until) 
    WHERE reserved_until IS NOT NULL;

-- ================================
-- 🎯 PRIORITY SCORING SYSTEM
-- ================================

-- Function to calculate priority score for NFTs needing votes
CREATE OR REPLACE FUNCTION calculate_nft_priority(nft_id UUID)
RETURNS INTEGER AS $$
DECLARE
    nft_record RECORD;
    priority INTEGER := 0;
BEGIN
    SELECT 
        slider_count,
        total_votes,
        current_elo,
        created_at
    INTO nft_record
    FROM public.nfts 
    WHERE id = nft_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Cold start priority (needs slider votes)
    IF nft_record.slider_count < 5 THEN
        priority := priority + (5 - nft_record.slider_count) * 100;
    END IF;
    
    -- Low vote count priority
    IF nft_record.total_votes < 10 THEN
        priority := priority + (10 - nft_record.total_votes) * 20;
    END IF;
    
    -- New NFT priority (within last 7 days)
    IF nft_record.created_at > NOW() - INTERVAL '7 days' THEN
        priority := priority + 50;
    END IF;
    
    -- Extreme Elo adjustment needed
    IF nft_record.current_elo > 2000 OR nft_record.current_elo < 1000 THEN
        priority := priority + 30;
    END IF;
    
    RETURN priority;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- ⚡ INSTANT MATCHUP DELIVERY
-- ================================

-- Function to get next matchup instantly from queue
CREATE OR REPLACE FUNCTION get_instant_matchup(
    preferred_vote_type TEXT DEFAULT NULL,
    user_session TEXT DEFAULT 'anonymous'
)
RETURNS TABLE(
    queue_id UUID,
    vote_type TEXT,
    nft_a_id UUID,
    nft_b_id UUID,
    slider_nft_id UUID,
    elo_diff FLOAT,
    priority_score INTEGER
) AS $$
DECLARE
    target_vote_type TEXT;
    matchup_record RECORD;
BEGIN
    -- Decide vote type if not specified
    IF preferred_vote_type IS NULL THEN
        target_vote_type := decide_vote_type();
    ELSE
        target_vote_type := preferred_vote_type;
    END IF;
    
    -- Reserve and return the highest priority available matchup
    UPDATE public.matchup_queue 
    SET 
        reserved_until = NOW() + INTERVAL '5 minutes',
        reserved_by = user_session
    WHERE id = (
        SELECT id 
        FROM public.matchup_queue 
        WHERE vote_type = target_vote_type
        AND (reserved_until IS NULL OR reserved_until < NOW())
        ORDER BY priority_score DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO matchup_record;
    
    IF FOUND THEN
        RETURN QUERY
        SELECT 
            matchup_record.id,
            matchup_record.vote_type,
            matchup_record.nft_a_id,
            matchup_record.nft_b_id,
            matchup_record.slider_nft_id,
            matchup_record.elo_diff,
            matchup_record.priority_score;
    ELSE
        -- Emergency fallback: generate one on the spot
        RAISE NOTICE 'Queue empty for %, generating emergency matchup', target_vote_type;
        
        IF target_vote_type = 'slider' THEN
            RETURN QUERY
            SELECT 
                NULL::UUID,
                'slider'::TEXT,
                NULL::UUID,
                NULL::UUID,
                (SELECT id FROM public.nfts ORDER BY slider_count ASC, RANDOM() LIMIT 1),
                0.0::FLOAT,
                1000::INTEGER;
        ELSE
            -- Return a simple random matchup as fallback
            RETURN QUERY
            SELECT 
                NULL::UUID,
                target_vote_type,
                a.id,
                b.id,
                NULL::UUID,
                ABS(a.current_elo - b.current_elo),
                100::INTEGER
            FROM public.nfts a
            JOIN public.nfts b ON a.id < b.id
            ORDER BY RANDOM()
            LIMIT 1;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🔄 QUEUE POPULATION FUNCTIONS
-- ================================

-- Function to populate same collection matchups
CREATE OR REPLACE FUNCTION populate_same_collection_queue(target_count INTEGER DEFAULT 20)
RETURNS INTEGER AS $$
DECLARE
    added_count INTEGER := 0;
    matchup_record RECORD;
    priority INTEGER;
BEGIN
    FOR matchup_record IN
        WITH prioritized_nfts AS (
            SELECT 
                id,
                collection_name,
                current_elo,
                calculate_nft_priority(id) as priority
            FROM public.nfts
            ORDER BY calculate_nft_priority(id) DESC
        ),
        matchup_candidates AS (
            SELECT 
                a.id as nft_a_id,
                b.id as nft_b_id,
                ABS(a.current_elo - b.current_elo) as elo_diff,
                GREATEST(a.priority, b.priority) as max_priority
            FROM prioritized_nfts a
            JOIN prioritized_nfts b ON a.collection_name = b.collection_name AND a.id < b.id
            WHERE ABS(a.current_elo - b.current_elo) < 150
        )
        SELECT * FROM matchup_candidates
        ORDER BY max_priority DESC, elo_diff ASC, RANDOM()
        LIMIT target_count
    LOOP
        -- Check if this matchup already exists in queue
        IF NOT EXISTS (
            SELECT 1 FROM public.matchup_queue 
            WHERE vote_type = 'same_coll'
            AND ((nft_a_id = matchup_record.nft_a_id AND nft_b_id = matchup_record.nft_b_id)
                OR (nft_a_id = matchup_record.nft_b_id AND nft_b_id = matchup_record.nft_a_id))
        ) THEN
            INSERT INTO public.matchup_queue (
                vote_type, nft_a_id, nft_b_id, elo_diff, priority_score
            ) VALUES (
                'same_coll',
                matchup_record.nft_a_id,
                matchup_record.nft_b_id,
                matchup_record.elo_diff,
                matchup_record.max_priority
            );
            added_count := added_count + 1;
        END IF;
    END LOOP;
    
    RETURN added_count;
END;
$$ LANGUAGE plpgsql;

-- Function to populate cross collection matchups  
CREATE OR REPLACE FUNCTION populate_cross_collection_queue(target_count INTEGER DEFAULT 20)
RETURNS INTEGER AS $$
DECLARE
    added_count INTEGER := 0;
    matchup_record RECORD;
BEGIN
    FOR matchup_record IN
        WITH prioritized_nfts AS (
            SELECT 
                id,
                collection_name,
                current_elo,
                calculate_nft_priority(id) as priority
            FROM public.nfts
            ORDER BY calculate_nft_priority(id) DESC
            LIMIT 200  -- Limit for performance
        ),
        matchup_candidates AS (
            SELECT 
                a.id as nft_a_id,
                b.id as nft_b_id,
                ABS(a.current_elo - b.current_elo) as elo_diff,
                GREATEST(a.priority, b.priority) as max_priority
            FROM prioritized_nfts a
            JOIN prioritized_nfts b ON a.collection_name != b.collection_name
            WHERE ABS(a.current_elo - b.current_elo) BETWEEN 50 AND 250
        )
        SELECT * FROM matchup_candidates
        ORDER BY max_priority DESC, elo_diff ASC, RANDOM()
        LIMIT target_count
    LOOP
        -- Check if this matchup already exists in queue
        IF NOT EXISTS (
            SELECT 1 FROM public.matchup_queue 
            WHERE vote_type = 'cross_coll'
            AND ((nft_a_id = matchup_record.nft_a_id AND nft_b_id = matchup_record.nft_b_id)
                OR (nft_a_id = matchup_record.nft_b_id AND nft_b_id = matchup_record.nft_a_id))
        ) THEN
            INSERT INTO public.matchup_queue (
                vote_type, nft_a_id, nft_b_id, elo_diff, priority_score
            ) VALUES (
                'cross_coll',
                matchup_record.nft_a_id,
                matchup_record.nft_b_id,
                matchup_record.elo_diff,
                matchup_record.max_priority
            );
            added_count := added_count + 1;
        END IF;
    END LOOP;
    
    RETURN added_count;
END;
$$ LANGUAGE plpgsql;

-- Function to populate slider queue
CREATE OR REPLACE FUNCTION populate_slider_queue(target_count INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    added_count INTEGER := 0;
    nft_record RECORD;
BEGIN
    FOR nft_record IN
        SELECT 
            id,
            calculate_nft_priority(id) as priority
        FROM public.nfts
        WHERE slider_count < 20  -- Focus on NFTs needing slider votes
        ORDER BY calculate_nft_priority(id) DESC, slider_count ASC, RANDOM()
        LIMIT target_count
    LOOP
        -- Check if this NFT already has a slider vote queued
        IF NOT EXISTS (
            SELECT 1 FROM public.matchup_queue 
            WHERE vote_type = 'slider' AND slider_nft_id = nft_record.id
        ) THEN
            INSERT INTO public.matchup_queue (
                vote_type, slider_nft_id, priority_score
            ) VALUES (
                'slider',
                nft_record.id,
                nft_record.priority
            );
            added_count := added_count + 1;
        END IF;
    END LOOP;
    
    RETURN added_count;
END;
$$ LANGUAGE plpgsql;

-- Master function to populate entire queue
CREATE OR REPLACE FUNCTION populate_matchup_queue()
RETURNS TABLE(
    vote_type TEXT,
    added_count INTEGER,
    total_in_queue INTEGER
) AS $$
DECLARE
    same_coll_added INTEGER;
    cross_coll_added INTEGER;
    slider_added INTEGER;
BEGIN
    -- Clean up expired reservations first
    UPDATE public.matchup_queue 
    SET reserved_until = NULL, reserved_by = NULL
    WHERE reserved_until < NOW();
    
    -- Populate each queue type
    SELECT populate_same_collection_queue(20) INTO same_coll_added;
    SELECT populate_cross_collection_queue(20) INTO cross_coll_added;
    SELECT populate_slider_queue(30) INTO slider_added;
    
    -- Return results
    RETURN QUERY
    SELECT 'same_coll'::TEXT, same_coll_added, (SELECT COUNT(*)::INTEGER FROM matchup_queue WHERE vote_type = 'same_coll')
    UNION ALL
    SELECT 'cross_coll'::TEXT, cross_coll_added, (SELECT COUNT(*)::INTEGER FROM matchup_queue WHERE vote_type = 'cross_coll')
    UNION ALL
    SELECT 'slider'::TEXT, slider_added, (SELECT COUNT(*)::INTEGER FROM matchup_queue WHERE vote_type = 'slider');
    
    RAISE NOTICE 'Queue populated: same_coll=%, cross_coll=%, slider=%', same_coll_added, cross_coll_added, slider_added;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🤖 AUTO-REFILL TRIGGER
-- ================================

-- Function to auto-refill queue when it gets low
CREATE OR REPLACE FUNCTION auto_refill_queue()
RETURNS TRIGGER AS $$
DECLARE
    queue_count INTEGER;
BEGIN
    -- Check if any queue type is running low
    FOR queue_count IN
        SELECT COUNT(*)
        FROM public.matchup_queue
        WHERE vote_type = NEW.vote_type
        AND (reserved_until IS NULL OR reserved_until < NOW())
    LOOP
        IF queue_count < 5 THEN
            -- Async refill (don't block the vote)
            PERFORM populate_matchup_queue();
            EXIT;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-refill when matchups are consumed
CREATE OR REPLACE TRIGGER trigger_auto_refill_queue
    AFTER UPDATE ON public.matchup_queue
    FOR EACH ROW
    WHEN (OLD.reserved_until IS NULL AND NEW.reserved_until IS NOT NULL)
    EXECUTE FUNCTION auto_refill_queue();

-- ================================
-- 🧹 CLEANUP FUNCTIONS
-- ================================

-- Function to remove used matchups and clean expired reservations
CREATE OR REPLACE FUNCTION cleanup_matchup_queue()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Remove expired reservations
    UPDATE public.matchup_queue 
    SET reserved_until = NULL, reserved_by = NULL
    WHERE reserved_until < NOW() - INTERVAL '1 minute';
    
    -- Remove old completed/reserved matchups
    DELETE FROM public.matchup_queue 
    WHERE reserved_until < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🚀 INITIAL QUEUE POPULATION
-- ================================

-- Populate the queue immediately
SELECT populate_matchup_queue();

-- Show initial queue status
SELECT 
    vote_type,
    COUNT(*) as ready_matchups,
    AVG(priority_score)::DECIMAL(10,2) as avg_priority
FROM public.matchup_queue
WHERE reserved_until IS NULL OR reserved_until < NOW()
GROUP BY vote_type
ORDER BY vote_type;

-- Record performance optimization completion
INSERT INTO public.migration_status (stage, description, notes)
VALUES (6, 'Performance optimizations added - matchup queue system operational', 'Instant matchup delivery with smart prioritization');

COMMIT;