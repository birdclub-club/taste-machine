-- 🚀 STAGE 6: Performance Optimizations - Lightweight Setup
-- This sets up the queue system without heavy initial population
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

-- Simple indexes (no complex WHERE clauses)
CREATE INDEX IF NOT EXISTS idx_matchup_queue_vote_type ON public.matchup_queue(vote_type);
CREATE INDEX IF NOT EXISTS idx_matchup_queue_priority ON public.matchup_queue(priority_score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_matchup_queue_reserved ON public.matchup_queue(reserved_until);

-- ================================
-- ⚡ INSTANT MATCHUP DELIVERY (SIMPLIFIED)
-- ================================

-- Simplified function to get next matchup instantly from queue
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
    
    -- Try to get from queue first
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
        -- Emergency fallback: generate one on the spot and add to queue
        IF target_vote_type = 'slider' THEN
            -- Get a random NFT needing slider votes
            RETURN QUERY
            SELECT 
                NULL::UUID,
                'slider'::TEXT,
                NULL::UUID,
                NULL::UUID,
                (SELECT id FROM public.nfts WHERE slider_count < 10 ORDER BY slider_count ASC, RANDOM() LIMIT 1),
                0.0::FLOAT,
                100::INTEGER;
        ELSE
            -- Simple random matchup fallback
            RETURN QUERY
            SELECT 
                NULL::UUID,
                target_vote_type,
                a.id,
                b.id,
                NULL::UUID,
                ABS(a.current_elo - b.current_elo),
                50::INTEGER
            FROM public.nfts a
            JOIN public.nfts b ON a.id != b.id
            ORDER BY RANDOM()
            LIMIT 1;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🔄 SIMPLE QUEUE POPULATION
-- ================================

-- Simple function to add a few matchups to queue
CREATE OR REPLACE FUNCTION populate_queue_simple(count_per_type INTEGER DEFAULT 5)
RETURNS TEXT AS $$
DECLARE
    added_total INTEGER := 0;
BEGIN
    -- Add some slider votes (simple)
    INSERT INTO public.matchup_queue (vote_type, slider_nft_id, priority_score)
    SELECT 
        'slider',
        id,
        (10 - slider_count) * 10  -- Simple priority
    FROM public.nfts 
    WHERE slider_count < 5
    ORDER BY slider_count ASC, RANDOM()
    LIMIT count_per_type;
    
    GET DIAGNOSTICS added_total = ROW_COUNT;
    
    -- Add some same collection matchups (simple)
    INSERT INTO public.matchup_queue (vote_type, nft_a_id, nft_b_id, elo_diff, priority_score)
    SELECT 
        'same_coll',
        a.id,
        b.id,
        ABS(a.current_elo - b.current_elo),
        50
    FROM public.nfts a
    JOIN public.nfts b ON a.collection_name = b.collection_name AND a.id < b.id
    ORDER BY RANDOM()
    LIMIT count_per_type;
    
    -- Add some cross collection matchups (simple)
    INSERT INTO public.matchup_queue (vote_type, nft_a_id, nft_b_id, elo_diff, priority_score)
    SELECT 
        'cross_coll',
        a.id,
        b.id,
        ABS(a.current_elo - b.current_elo),
        25
    FROM public.nfts a
    JOIN public.nfts b ON a.collection_name != b.collection_name
    ORDER BY RANDOM()
    LIMIT count_per_type;
    
    RETURN 'Added ' || (added_total + count_per_type * 2)::TEXT || ' matchups to queue';
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🧹 SIMPLE CLEANUP
-- ================================

-- Simple cleanup function
CREATE OR REPLACE FUNCTION cleanup_matchup_queue()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Remove expired reservations
    DELETE FROM public.matchup_queue 
    WHERE reserved_until < NOW() - INTERVAL '10 minutes';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🚀 LIGHT INITIAL SETUP
-- ================================

-- Add just a few initial matchups (won't timeout)
SELECT populate_queue_simple(3);

-- Show what we created
SELECT 
    vote_type,
    COUNT(*) as ready_matchups
FROM public.matchup_queue
GROUP BY vote_type
ORDER BY vote_type;

-- Record completion
INSERT INTO public.migration_status (stage, description, notes)
VALUES (6, 'Performance optimizations added - lightweight queue system operational', 'Basic queue with fallback to dynamic generation');

COMMIT;