-- 🔄 STAGE 5: Clean Up Old Columns (FINAL MIGRATION)
-- This script removes old columns after successful validation
-- ⚠️  WARNING: This is irreversible - ensure Stage 4 testing is complete

-- ================================
-- 🛡️ SAFETY CHECKS
-- ================================

-- Require explicit confirmation that testing is complete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.migration_status 
        WHERE stage = 4 AND description LIKE '%testing and validation completed%'
    ) THEN
        RAISE EXCEPTION 'Stage 4 testing must be completed and validated before cleanup. Run 04-test-and-validate.sql first.';
    END IF;
    
    -- Additional safety check - ensure new system is being used
    IF (SELECT COUNT(*) FROM votes WHERE vote_type_v2 IS NOT NULL AND created_at > NOW() - INTERVAL '1 day') < 1 THEN
        RAISE WARNING 'No recent votes found with new schema. Ensure application is using new voting system before cleanup.';
    END IF;
END $$;

-- ================================
-- 📊 PRE-CLEANUP BACKUP VERIFICATION
-- ================================

-- Create final backup table with old data
CREATE TABLE IF NOT EXISTS public.migration_backup_old_schema AS
SELECT 
    'nfts_old_schema' as table_name,
    jsonb_build_object(
        'id', id,
        'looks_score', looks_score,
        'created_at', created_at
    ) as old_data
FROM public.nfts
WHERE looks_score IS NOT NULL

UNION ALL

SELECT 
    'votes_old_schema' as table_name,
    jsonb_build_object(
        'id', id,
        'vote_type', vote_type,
        'created_at', created_at
    ) as old_data
FROM public.votes
WHERE vote_type IS NOT NULL;

-- ================================
-- 🗑️ REMOVE OLD COLUMNS FROM NFTS
-- ================================

-- Drop old Elo system column
ALTER TABLE public.nfts 
DROP COLUMN IF EXISTS looks_score;

-- Add comment to track migration
COMMENT ON COLUMN public.nfts.current_elo IS 'Replaced looks_score in migration Stage 5';

-- ================================
-- 🗑️ REMOVE OLD COLUMNS FROM VOTES  
-- ================================

-- Drop old vote type column
ALTER TABLE public.votes 
DROP COLUMN IF EXISTS vote_type;

-- Drop old matchup dependency (votes now work with dynamic matchups)
ALTER TABLE public.votes 
DROP COLUMN IF EXISTS matchup_id;

-- Add comment to track migration
COMMENT ON COLUMN public.votes.vote_type_v2 IS 'Replaced vote_type in migration Stage 5';

-- ================================
-- 🗑️ CLEAN UP OLD MATCHUPS SYSTEM
-- ================================

-- Archive old matchups for historical reference
CREATE TABLE IF NOT EXISTS public.legacy_matchups AS
SELECT *, 'archived_stage_5' as migration_note
FROM public.matchups;

-- Drop the old matchups table (we now use dynamic selection)
DROP TABLE IF EXISTS public.matchups CASCADE;

-- ================================
-- 🔧 UPDATE CONSTRAINTS AND INDEXES
-- ================================

-- Rename vote_type_v2 to vote_type for cleaner schema
ALTER TABLE public.votes 
RENAME COLUMN vote_type_v2 TO vote_type;

-- Update constraint to reflect new column name
ALTER TABLE public.votes 
DROP CONSTRAINT IF EXISTS votes_vote_type_v2_check;

ALTER TABLE public.votes 
ADD CONSTRAINT votes_vote_type_check 
CHECK (vote_type IN ('same_coll', 'cross_coll', 'slider'));

-- Remove old unique constraint that included matchup_id
ALTER TABLE public.votes 
DROP CONSTRAINT IF EXISTS votes_user_id_matchup_id_key;

-- Add new unique constraint for slider votes
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_user_nft_slider 
ON public.votes(user_id, nft_a_id) 
WHERE vote_type = 'slider';

-- Add new unique constraint for matchup votes  
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_user_matchup
ON public.votes(user_id, nft_a_id, nft_b_id, vote_type) 
WHERE vote_type IN ('same_coll', 'cross_coll');

-- ================================
-- 🔄 UPDATE RLS POLICIES
-- ================================

-- Update RLS policies to work with new schema
DROP POLICY IF EXISTS "Users can read their own votes" ON public.votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON public.votes;

-- Recreate policies with new column names
CREATE POLICY "Users can read their own votes" ON public.votes
    FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own votes" ON public.votes
    FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- ================================
-- 📈 OPTIMIZE NEW SCHEMA
-- ================================

-- Add optimized indexes for new voting patterns
CREATE INDEX IF NOT EXISTS idx_nfts_elo_collection ON public.nfts(collection_name, current_elo DESC);
CREATE INDEX IF NOT EXISTS idx_votes_engagement ON public.votes USING gin(engagement_data);
CREATE INDEX IF NOT EXISTS idx_votes_created_at_type ON public.votes(created_at DESC, vote_type);

-- Update table statistics
ANALYZE public.nfts;
ANALYZE public.votes;
ANALYZE public.users;

-- ================================
-- 🎯 FINAL VALIDATION
-- ================================

-- Verify cleanup was successful
DO $$
DECLARE
    old_columns_exist BOOLEAN := FALSE;
BEGIN
    -- Check if old columns were properly removed
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'nfts' 
        AND column_name = 'looks_score'
        AND table_schema = 'public'
    ) INTO old_columns_exist;
    
    IF old_columns_exist THEN
        RAISE EXCEPTION 'Cleanup failed: old columns still exist';
    END IF;
    
    -- Verify new system is functional
    PERFORM find_cold_start_nfts(1);
    PERFORM find_same_collection_matchup();
    PERFORM decide_vote_type();
    
    RAISE NOTICE '✅ Cleanup successful: Old schema removed, new system operational';
END $$;

-- ================================
-- 📊 FINAL STATISTICS REPORT
-- ================================

-- Generate final migration statistics
SELECT '🎉 MIGRATION COMPLETE' as status;

SELECT 
    'Database Tables' as component,
    COUNT(*) as count,
    array_agg(table_name ORDER BY table_name) as tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name NOT LIKE 'migration_%'
AND table_name NOT LIKE 'legacy_%';

SELECT 
    'NFT Statistics' as component,
    COUNT(*) as total_nfts,
    COUNT(DISTINCT collection_name) as collections,
    AVG(current_elo)::DECIMAL(10,2) as avg_elo,
    AVG(slider_count)::DECIMAL(10,2) as avg_slider_count
FROM public.nfts;

SELECT 
    'Vote Statistics' as component,
    COUNT(*) as total_votes,
    COUNT(*) FILTER (WHERE vote_type = 'same_coll') as same_coll_votes,
    COUNT(*) FILTER (WHERE vote_type = 'cross_coll') as cross_coll_votes,
    COUNT(*) FILTER (WHERE vote_type = 'slider') as slider_votes
FROM public.votes;

-- Record final migration completion
INSERT INTO public.migration_status (stage, description, notes)
VALUES (5, 'Migration cleanup completed - new voting system fully operational', 
        'Legacy schema removed, production system ready');

-- ================================
-- 🎯 POST-MIGRATION RECOMMENDATIONS
-- ================================

SELECT '📋 POST-MIGRATION RECOMMENDATIONS' as recommendations;

SELECT 
    'Monitor cold start progress' as recommendation,
    'Track NFTs with slider_count < 5 and adjust vote type distribution if needed' as action;

SELECT 
    'Monitor Elo distribution' as recommendation,  
    'Watch for Elo inflation/deflation and consider periodic recalibration' as action;

SELECT 
    'Analytics setup' as recommendation,
    'Set up monitoring for vote patterns, user engagement, and system performance' as action;

SELECT 
    'Backup retention' as recommendation,
    'Keep migration_backup_old_schema and legacy_matchups tables for audit trail' as action;

COMMIT;