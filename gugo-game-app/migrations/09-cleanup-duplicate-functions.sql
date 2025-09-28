-- 🧹 Cleanup Duplicate Functions
-- Removes old insecure function versions that weren't properly dropped
-- This will eliminate the remaining 4 INSECURE function entries

-- ================================
-- 🗑️ REMOVE OLD FUNCTION VERSIONS
-- ================================

-- Find and drop all versions of the problematic functions
-- We'll use CASCADE to ensure we get all dependencies

-- 1. Clean up calculate_elo_update
DROP FUNCTION IF EXISTS public.calculate_elo_update() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_elo_update(integer) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_elo_update(integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_elo_update(integer, integer, text) CASCADE;

-- 2. Clean up decide_vote_type  
DROP FUNCTION IF EXISTS public.decide_vote_type() CASCADE;
DROP FUNCTION IF EXISTS public.decide_vote_type(text) CASCADE;

-- 3. Clean up increment_user_stats
DROP FUNCTION IF EXISTS public.increment_user_stats() CASCADE;
DROP FUNCTION IF EXISTS public.increment_user_stats(text) CASCADE;
DROP FUNCTION IF EXISTS public.increment_user_stats(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.increment_user_stats(text, integer, integer) CASCADE;

-- 4. Clean up update_slider_average
DROP FUNCTION IF EXISTS public.update_slider_average() CASCADE;
DROP FUNCTION IF EXISTS public.update_slider_average(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_slider_average(uuid, integer) CASCADE;

-- ================================
-- 🔄 RECREATE SECURE VERSIONS ONLY
-- ================================

-- Recreate calculate_elo_update (secure version)
CREATE OR REPLACE FUNCTION public.calculate_elo_update(
    winner_elo INTEGER,
    loser_elo INTEGER,
    vote_type TEXT DEFAULT 'standard'
) RETURNS TABLE(winner_new_elo INTEGER, loser_new_elo INTEGER) AS $$
DECLARE
    k_factor INTEGER := 32;
    expected_winner FLOAT;
    expected_loser FLOAT;
    winner_change INTEGER;
    loser_change INTEGER;
BEGIN
    -- Apply multiplier for super votes
    IF vote_type = 'super' THEN
        k_factor := k_factor * 2;
    END IF;
    
    -- Calculate expected scores
    expected_winner := 1.0 / (1.0 + pow(10.0, (loser_elo - winner_elo) / 400.0));
    expected_loser := 1.0 - expected_winner;
    
    -- Calculate Elo changes
    winner_change := round(k_factor * (1.0 - expected_winner));
    loser_change := round(k_factor * (0.0 - expected_loser));
    
    -- Return new Elo ratings
    winner_new_elo := winner_elo + winner_change;
    loser_new_elo := loser_elo + loser_change;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate decide_vote_type (secure version)
CREATE OR REPLACE FUNCTION public.decide_vote_type()
RETURNS TEXT AS $$
DECLARE
    cold_start_count INTEGER;
    random_choice FLOAT;
BEGIN
    -- Check if we need more slider votes for cold start NFTs
    SELECT COUNT(*) INTO cold_start_count
    FROM nfts n
    WHERE COALESCE(n.slider_count, 0) < 3
    AND NOT (n.traits @> '{"Reveal": "Unrevealed"}');
    
    IF cold_start_count > 50 THEN
        RETURN 'slider';
    END IF;
    
    -- Random choice between same_coll and cross_coll
    random_choice := RANDOM();
    IF random_choice < 0.6 THEN
        RETURN 'same_coll';
    ELSE
        RETURN 'cross_coll';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate increment_user_stats (secure version)
CREATE OR REPLACE FUNCTION public.increment_user_stats(
    user_wallet_address TEXT,
    xp_to_add INTEGER DEFAULT 0,
    votes_to_add INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET 
        xp = COALESCE(xp, 0) + xp_to_add,
        total_votes = COALESCE(total_votes, 0) + votes_to_add,
        updated_at = NOW()
    WHERE wallet_address = user_wallet_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate update_slider_average (secure version)
CREATE OR REPLACE FUNCTION public.update_slider_average(
    nft_uuid UUID,
    new_rating INTEGER
) RETURNS VOID AS $$
DECLARE
    current_avg FLOAT;
    current_count INTEGER;
    new_avg FLOAT;
BEGIN
    SELECT slider_average, slider_count 
    INTO current_avg, current_count
    FROM nfts 
    WHERE id = nft_uuid;
    
    IF current_count IS NULL OR current_count = 0 THEN
        new_avg := new_rating;
        current_count := 1;
    ELSE
        new_avg := ((current_avg * current_count) + new_rating) / (current_count + 1);
        current_count := current_count + 1;
    END IF;
    
    UPDATE nfts 
    SET 
        slider_average = new_avg,
        slider_count = current_count,
        updated_at = NOW()
    WHERE id = nft_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================
-- ✅ FINAL VERIFICATION
-- ================================

-- Verify all functions are now secure
SELECT 
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NULL THEN 'INSECURE (no search_path)'
        WHEN array_to_string(p.proconfig, ',') LIKE '%search_path=public%' THEN 'SECURE'
        ELSE 'CHECK CONFIG: ' || array_to_string(p.proconfig, ',')
    END as security_status,
    COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'increment_user_stats',
    'calculate_elo_update', 
    'update_slider_average',
    'add_user_votes',
    'get_user_vote_balance',
    'get_instant_matchup',
    'cleanup_matchup_queue',
    'find_cold_start_nfts',
    'find_same_collection_matchup',
    'decide_vote_type',
    'validate_migration_stage_2',
    'find_cross_collection_matchup',
    'update_updated_at_column',
    'set_config'
)
GROUP BY p.proname, security_status
ORDER BY p.proname, security_status;

-- Summary count
SELECT 
    CASE 
        WHEN p.proconfig IS NULL THEN 'INSECURE'
        WHEN array_to_string(p.proconfig, ',') LIKE '%search_path=public%' THEN 'SECURE'
        ELSE 'OTHER'
    END as security_status,
    COUNT(*) as total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'increment_user_stats', 'calculate_elo_update', 'update_slider_average',
    'add_user_votes', 'get_user_vote_balance', 'get_instant_matchup',
    'cleanup_matchup_queue', 'find_cold_start_nfts', 'find_same_collection_matchup',
    'decide_vote_type', 'validate_migration_stage_2', 'find_cross_collection_matchup',
    'update_updated_at_column', 'set_config'
)
GROUP BY security_status
ORDER BY security_status;