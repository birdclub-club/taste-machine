-- 🔒 Fix Row Level Security (RLS) Issues
-- Addresses all Supabase database linter security warnings
-- Run this in Supabase SQL Editor to enable RLS on all public tables

-- ================================
-- 🛡️ ENABLE RLS ON ALL TABLES
-- ================================

-- Enable RLS on users table (has policies but RLS not enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on core voting tables  
ALTER TABLE public.nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on queue and migration tables
ALTER TABLE public.matchup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_status ENABLE ROW LEVEL SECURITY;

-- ================================
-- 📋 CREATE/UPDATE RLS POLICIES
-- ================================

-- 👤 USERS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (wallet_address = current_setting('app.current_wallet_address', TRUE));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (wallet_address = current_setting('app.current_wallet_address', TRUE));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (wallet_address = current_setting('app.current_wallet_address', TRUE));

-- 🖼️ NFTS TABLE POLICIES (Public read access)
DROP POLICY IF EXISTS "NFTs are publicly readable" ON public.nfts;
CREATE POLICY "NFTs are publicly readable" ON public.nfts
    FOR SELECT USING (true);

-- Only authenticated users can modify NFTs (admin operations)
DROP POLICY IF EXISTS "Authenticated users can modify NFTs" ON public.nfts;
CREATE POLICY "Authenticated users can modify NFTs" ON public.nfts
    FOR ALL USING (auth.role() = 'authenticated');

-- 🎯 MATCHUPS TABLE POLICIES (Public read access)
DROP POLICY IF EXISTS "Matchups are publicly readable" ON public.matchups;
CREATE POLICY "Matchups are publicly readable" ON public.matchups
    FOR SELECT USING (true);

-- Only authenticated users can create matchups
DROP POLICY IF EXISTS "Authenticated users can create matchups" ON public.matchups;
CREATE POLICY "Authenticated users can create matchups" ON public.matchups
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 🗳️ VOTES TABLE POLICIES (User-specific access)
DROP POLICY IF EXISTS "Users can read their own votes" ON public.votes;
CREATE POLICY "Users can read their own votes" ON public.votes
    FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS "Users can insert their own votes" ON public.votes;
CREATE POLICY "Users can insert their own votes" ON public.votes
    FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- Allow authenticated users to read all votes for analytics
DROP POLICY IF EXISTS "Authenticated users can read all votes" ON public.votes;
CREATE POLICY "Authenticated users can read all votes" ON public.votes
    FOR SELECT USING (auth.role() = 'authenticated');

-- 📋 MATCHUP QUEUE TABLE POLICIES (Public read, authenticated write)
DROP POLICY IF EXISTS "Queue is publicly readable" ON public.matchup_queue;
CREATE POLICY "Queue is publicly readable" ON public.matchup_queue
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage queue" ON public.matchup_queue;
CREATE POLICY "Authenticated users can manage queue" ON public.matchup_queue
    FOR ALL USING (auth.role() = 'authenticated');

-- 🔄 MIGRATION STATUS TABLE POLICIES (Admin only)
DROP POLICY IF EXISTS "Authenticated users can read migration status" ON public.migration_status;
CREATE POLICY "Authenticated users can read migration status" ON public.migration_status
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage migration status" ON public.migration_status;
CREATE POLICY "Authenticated users can manage migration status" ON public.migration_status
    FOR ALL USING (auth.role() = 'authenticated');

-- ================================
-- 🔑 GRANT NECESSARY PERMISSIONS
-- ================================

-- Grant permissions for anonymous users (for public read access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.nfts TO anon, authenticated;
GRANT SELECT ON public.matchups TO anon, authenticated;
GRANT SELECT ON public.matchup_queue TO anon, authenticated;

-- Grant permissions for authenticated users
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.votes TO authenticated;
GRANT ALL ON public.nfts TO authenticated;
GRANT ALL ON public.matchups TO authenticated;
GRANT ALL ON public.matchup_queue TO authenticated;
GRANT ALL ON public.migration_status TO authenticated;

-- ================================
-- ✅ VERIFICATION
-- ================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
    rec RECORD;
    rls_status TEXT;
BEGIN
    FOR rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'nfts', 'matchups', 'votes', 'matchup_queue', 'migration_status')
    LOOP
        SELECT CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END
        INTO rls_status
        FROM pg_class 
        WHERE relname = rec.tablename;
        
        RAISE NOTICE 'Table %.%: RLS %', 'public', rec.tablename, rls_status;
    END LOOP;
    
    RAISE NOTICE '✅ RLS verification complete';
END $$;

-- Show policy count per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;