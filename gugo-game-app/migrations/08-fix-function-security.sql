-- 🔒 Fix Function Security Issues
-- Addresses all "Function Search Path Mutable" security warnings
-- Sets fixed search_path for all functions to prevent search path injection attacks

-- ================================
-- 🛡️ FIX FUNCTION SEARCH PATHS
-- ================================

-- Fix increment_user_stats function
DROP FUNCTION IF EXISTS public.increment_user_stats(text, integer, integer);
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

-- Fix calculate_elo_update function
DROP FUNCTION IF EXISTS public.calculate_elo_update(integer, integer, text);
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

-- Fix update_slider_average function
DROP FUNCTION IF EXISTS public.update_slider_average(uuid, integer);
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

-- Fix add_user_votes function
DROP FUNCTION IF EXISTS public.add_user_votes(text, integer);
CREATE OR REPLACE FUNCTION public.add_user_votes(
    user_wallet_address TEXT,
    votes_to_add INTEGER
) RETURNS VOID AS $$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid 
    FROM users 
    WHERE wallet_address = user_wallet_address;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User not found with wallet address: %', user_wallet_address;
    END IF;
    
    UPDATE users 
    SET 
        available_votes = COALESCE(available_votes, 0) + votes_to_add,
        updated_at = NOW()
    WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix get_user_vote_balance function
DROP FUNCTION IF EXISTS public.get_user_vote_balance(text);
CREATE OR REPLACE FUNCTION public.get_user_vote_balance(
    user_wallet_address TEXT
) RETURNS INTEGER AS $$
DECLARE
    vote_balance INTEGER;
BEGIN
    SELECT COALESCE(available_votes, 0) INTO vote_balance
    FROM users 
    WHERE wallet_address = user_wallet_address;
    
    RETURN COALESCE(vote_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix get_instant_matchup function
DROP FUNCTION IF EXISTS public.get_instant_matchup(text, text);
CREATE OR REPLACE FUNCTION public.get_instant_matchup(
    preferred_vote_type TEXT DEFAULT NULL,
    user_session TEXT DEFAULT 'anonymous'
) RETURNS TABLE(
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
BEGIN
    -- Simple logic: try queue first, fallback to random generation
    target_vote_type := COALESCE(preferred_vote_type, 'same_coll');
    
    -- Try to get from queue first
    SELECT q.id, q.vote_type, q.nft_a_id, q.nft_b_id, q.slider_nft_id, q.elo_diff, q.priority_score
    INTO queue_id, vote_type, nft_a_id, nft_b_id, slider_nft_id, elo_diff, priority_score
    FROM matchup_queue q
    WHERE q.vote_type = target_vote_type
    AND (q.reserved_until IS NULL OR q.reserved_until < NOW())
    ORDER BY q.priority_score DESC, q.created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
        -- Reserve this matchup
        UPDATE matchup_queue 
        SET reserved_until = NOW() + INTERVAL '5 minutes',
            reserved_by = user_session
        WHERE id = queue_id;
        
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- No queue item found, generate random (simplified)
    SELECT NULL, 'same_coll', n1.id, n2.id, NULL::UUID, 0.0, 0
    INTO queue_id, vote_type, nft_a_id, nft_b_id, slider_nft_id, elo_diff, priority_score
    FROM nfts n1, nfts n2
    WHERE n1.id != n2.id
    ORDER BY RANDOM()
    LIMIT 1;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix cleanup_matchup_queue function
DROP FUNCTION IF EXISTS public.cleanup_matchup_queue();
CREATE OR REPLACE FUNCTION public.cleanup_matchup_queue() RETURNS VOID AS $$
BEGIN
    DELETE FROM matchup_queue 
    WHERE reserved_until IS NOT NULL 
    AND reserved_until < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix find_cold_start_nfts function
DROP FUNCTION IF EXISTS public.find_cold_start_nfts(integer);
CREATE OR REPLACE FUNCTION public.find_cold_start_nfts(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    nft_id UUID,
    slider_count INTEGER,
    total_votes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id as nft_id,
        COALESCE(n.slider_count, 0) as slider_count,
        COALESCE(n.total_votes, 0) as total_votes
    FROM nfts n
    WHERE COALESCE(n.slider_count, 0) < 3
    AND n.image NOT ILIKE '%.mp4%'
    AND n.image NOT ILIKE '%.mov%'
    AND n.image NOT ILIKE '%.avi%'
    AND n.image NOT ILIKE '%.webm%'
    AND n.image NOT ILIKE '%.mkv%'
    AND NOT (n.traits @> '{"Reveal": "Unrevealed"}')
    AND NOT (n.traits @> '{"reveal": "unrevealed"}')
    AND NOT (n.traits @> '{"Status": "Unrevealed"}')
    AND NOT (n.traits @> '{"status": "unrevealed"}')
    ORDER BY 
        COALESCE(n.slider_count, 0) ASC,
        COALESCE(n.total_votes, 0) ASC,
        RANDOM()
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix find_same_collection_matchup function
DROP FUNCTION IF EXISTS public.find_same_collection_matchup();
CREATE OR REPLACE FUNCTION public.find_same_collection_matchup()
RETURNS TABLE (
    nft_a_id UUID,
    nft_b_id UUID,
    elo_diff FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH collection_pairs AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo) as elo_diff
        FROM nfts n1
        JOIN nfts n2 ON n1.collection_name = n2.collection_name 
        WHERE n1.id != n2.id
        AND n1.image NOT ILIKE '%.mp4%'
        AND n2.image NOT ILIKE '%.mp4%'
        AND NOT (n1.traits @> '{"Reveal": "Unrevealed"}')
        AND NOT (n2.traits @> '{"Reveal": "Unrevealed"}')
        ORDER BY elo_diff ASC, RANDOM()
        LIMIT 1
    )
    SELECT cp.nft_a_id, cp.nft_b_id, cp.elo_diff
    FROM collection_pairs cp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix find_cross_collection_matchup function
DROP FUNCTION IF EXISTS public.find_cross_collection_matchup();
CREATE OR REPLACE FUNCTION public.find_cross_collection_matchup()
RETURNS TABLE (
    nft_a_id UUID,
    nft_b_id UUID,
    elo_diff FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH cross_pairs AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo) as elo_diff
        FROM nfts n1
        JOIN nfts n2 ON n1.collection_name != n2.collection_name
        WHERE n1.image NOT ILIKE '%.mp4%'
        AND n2.image NOT ILIKE '%.mp4%'
        AND NOT (n1.traits @> '{"Reveal": "Unrevealed"}')
        AND NOT (n2.traits @> '{"Reveal": "Unrevealed"}')
        ORDER BY elo_diff ASC, RANDOM()
        LIMIT 1
    )
    SELECT cp.nft_a_id, cp.nft_b_id, cp.elo_diff
    FROM cross_pairs cp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix decide_vote_type function
DROP FUNCTION IF EXISTS public.decide_vote_type();
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

-- Fix validate_migration_stage_2 function
DROP FUNCTION IF EXISTS public.validate_migration_stage_2();
CREATE OR REPLACE FUNCTION public.validate_migration_stage_2()
RETURNS TABLE (
    test_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Test 1: Check if new columns exist
    RETURN QUERY
    SELECT 
        'New columns exist'::TEXT,
        CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Found ' || COUNT(*)::TEXT || ' new columns'::TEXT
    FROM information_schema.columns 
    WHERE table_name = 'nfts' 
    AND column_name IN ('current_elo', 'slider_average', 'slider_count');
    
    -- Test 2: Check if functions exist
    RETURN QUERY
    SELECT 
        'Functions exist'::TEXT,
        CASE WHEN COUNT(*) >= 5 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Found ' || COUNT(*)::TEXT || ' functions'::TEXT
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN ('find_cold_start_nfts', 'find_same_collection_matchup', 'decide_vote_type');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_updated_at_column function (handle trigger dependency)
-- Drop triggers that depend on this function first
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_nfts_updated_at ON public.nfts;

-- Now drop and recreate the function
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nfts_updated_at
    BEFORE UPDATE ON public.nfts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Fix set_config function
DROP FUNCTION IF EXISTS public.set_config(text, text, boolean);
CREATE OR REPLACE FUNCTION public.set_config(
    setting_name TEXT, 
    setting_value TEXT, 
    is_local BOOLEAN DEFAULT FALSE
) RETURNS TEXT AS $$
BEGIN
    PERFORM set_config(setting_name, setting_value, is_local);
    RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================
-- ✅ VERIFICATION
-- ================================

-- Verify all functions now have secure search_path
SELECT 
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NULL THEN 'INSECURE (no search_path)'
        WHEN array_to_string(p.proconfig, ',') LIKE '%search_path=public%' THEN 'SECURE'
        ELSE 'CHECK CONFIG: ' || array_to_string(p.proconfig, ',')
    END as security_status
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
ORDER BY p.proname;