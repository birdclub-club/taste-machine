-- 🚀 STAGE 6: Ultra Minimal Queue Setup
-- Just creates the infrastructure, NO population
-- Run this after Stage 2 migration is complete

-- ================================
-- 🏎️ MATCHUP QUEUE TABLE ONLY
-- ================================

-- Create the queue table (no population)
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

-- Basic indexes only
CREATE INDEX IF NOT EXISTS idx_matchup_queue_vote_type ON public.matchup_queue(vote_type);
CREATE INDEX IF NOT EXISTS idx_matchup_queue_reserved ON public.matchup_queue(reserved_until);

-- ================================
-- ⚡ BASIC INSTANT DELIVERY FUNCTION
-- ================================

-- Ultra simple function - just checks queue, falls back to random
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
    
    -- Try to get from queue (if any exist)
    SELECT * INTO matchup_record
    FROM public.matchup_queue 
    WHERE vote_type = target_vote_type
    AND (reserved_until IS NULL OR reserved_until < NOW())
    ORDER BY priority_score DESC, created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
        -- Reserve this matchup
        UPDATE public.matchup_queue 
        SET reserved_until = NOW() + INTERVAL '5 minutes', reserved_by = user_session
        WHERE id = matchup_record.id;
        
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
        -- Fallback: return NULL (app will use old dynamic system)
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 🧹 BASIC CLEANUP FUNCTION
-- ================================

-- Simple cleanup - just remove expired
CREATE OR REPLACE FUNCTION cleanup_matchup_queue()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    DELETE FROM public.matchup_queue 
    WHERE reserved_until < NOW() - INTERVAL '10 minutes';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- ✅ RECORD COMPLETION
-- ================================

-- Just record that we set up the infrastructure
INSERT INTO public.migration_status (stage, description, notes)
VALUES (6, 'Queue infrastructure created - ready for gradual population', 'Ultra minimal setup - no initial population to avoid timeouts');

-- Show that table was created successfully
SELECT 'matchup_queue table created successfully' as status;

COMMIT;