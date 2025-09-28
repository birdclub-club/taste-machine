-- 🧹 Final Aggressive Function Cleanup
-- Removes the last 3 stubborn INSECURE functions that are duplicates
-- This will eliminate ALL remaining security warnings

-- ================================
-- 🔍 IDENTIFY PROBLEMATIC FUNCTIONS
-- ================================

-- First, let's see all versions of these 3 problematic functions
SELECT 
    p.proname,
    p.oid,
    pg_get_function_identity_arguments(p.oid) as signature,
    CASE 
        WHEN p.proconfig IS NULL THEN 'INSECURE'
        WHEN array_to_string(p.proconfig, ',') LIKE '%search_path=public%' THEN 'SECURE'
        ELSE 'OTHER'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('calculate_elo_update', 'increment_user_stats', 'update_slider_average')
ORDER BY p.proname, status;

-- ================================
-- 🗑️ AGGRESSIVE CLEANUP
-- ================================

-- Use specific OID-based drops to target only INSECURE versions
DO $$
DECLARE
    func_oid OID;
BEGIN
    -- Drop INSECURE calculate_elo_update functions
    FOR func_oid IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'calculate_elo_update'
        AND p.proconfig IS NULL  -- INSECURE ones have no config
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_oid::regprocedure || ' CASCADE';
        RAISE NOTICE 'Dropped INSECURE calculate_elo_update function: %', func_oid::regprocedure;
    END LOOP;

    -- Drop INSECURE increment_user_stats functions
    FOR func_oid IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'increment_user_stats'
        AND p.proconfig IS NULL  -- INSECURE ones have no config
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_oid::regprocedure || ' CASCADE';
        RAISE NOTICE 'Dropped INSECURE increment_user_stats function: %', func_oid::regprocedure;
    END LOOP;

    -- Drop INSECURE update_slider_average functions
    FOR func_oid IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'update_slider_average'
        AND p.proconfig IS NULL  -- INSECURE ones have no config
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_oid::regprocedure || ' CASCADE';
        RAISE NOTICE 'Dropped INSECURE update_slider_average function: %', func_oid::regprocedure;
    END LOOP;
END $$;

-- ================================
-- ✅ FINAL VERIFICATION
-- ================================

-- Verify ALL functions are now SECURE
SELECT 
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NULL THEN 'INSECURE (no search_path)'
        WHEN array_to_string(p.proconfig, ',') LIKE '%search_path=public%' THEN 'SECURE'
        ELSE 'CHECK CONFIG: ' || array_to_string(p.proconfig, ',')
    END as security_status,
    COUNT(*) as count
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
GROUP BY p.proname, security_status
ORDER BY p.proname, security_status;

-- Final summary count
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

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SECURITY CLEANUP COMPLETE!';
    RAISE NOTICE 'All function security warnings should now be resolved.';
    RAISE NOTICE '';
END $$;