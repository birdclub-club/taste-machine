-- 🔧 EMERGENCY: Temporarily Disable RLS for Development
-- This will completely open database access to fix the 23 console errors
-- ⚠️ THIS IS FOR DEVELOPMENT ONLY - RE-ENABLE RLS FOR PRODUCTION

-- ================================
-- DISABLE RLS ON ALL TABLES TEMPORARILY  
-- ================================

-- Disable RLS on all main tables
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchup_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_status DISABLE ROW LEVEL SECURITY;

-- ================================
-- GRANT FULL ACCESS TO ANON ROLE
-- ================================

-- Grant full table access to anonymous users
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Grant specific permissions for all main tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchup_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_status TO anon;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ================================
-- VERIFICATION
-- ================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== RLS STATUS AFTER DISABLING ===';
    
    FOR rec IN 
        SELECT schemaname, tablename, 
               CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'nfts', 'matchups', 'votes', 'matchup_queue', 'migration_status')
        ORDER BY tablename
    LOOP
        RAISE NOTICE 'Table: % - RLS: %', rec.tablename, rec.rls_status;
    END LOOP;
    
    RAISE NOTICE '=== ANONYMOUS PERMISSIONS ===';
    
    FOR rec IN
        SELECT table_name, privilege_type
        FROM information_schema.table_privileges 
        WHERE grantee = 'anon' 
        AND table_schema = 'public'
        AND table_name IN ('users', 'nfts', 'matchups', 'votes', 'matchup_queue', 'migration_status')
        ORDER BY table_name, privilege_type
    LOOP
        RAISE NOTICE 'Table: % | Permission: %', rec.table_name, rec.privilege_type;
    END LOOP;
    
    RAISE NOTICE '=== RLS COMPLETELY DISABLED FOR DEVELOPMENT ===';
    RAISE NOTICE '⚠️  REMEMBER TO RE-ENABLE RLS FOR PRODUCTION!';
END $$;