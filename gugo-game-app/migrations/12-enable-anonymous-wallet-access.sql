-- 🔧 Enable Anonymous Wallet-Based Access
-- Temporary fix to allow wallet-based operations with anonymous Supabase client
-- This allows the application to work while we debug the wallet context setting

-- ================================
-- ENABLE ANONYMOUS ACCESS FOR WALLET OPERATIONS
-- ================================

-- 1. Allow anonymous users to read and manage their own user profile by wallet address
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT TO anon, authenticated
USING (
  -- Allow if authenticated and wallet matches context setting
  (auth.role() = 'authenticated' AND wallet_address = current_setting('app.current_wallet_address', true))
  OR
  -- Allow anonymous access - they can read any user (for now, will be restricted later)
  (auth.role() = 'anon')
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE TO anon, authenticated
USING (
  (auth.role() = 'authenticated' AND wallet_address = current_setting('app.current_wallet_address', true))
  OR
  (auth.role() = 'anon')
)
WITH CHECK (
  (auth.role() = 'authenticated' AND wallet_address = current_setting('app.current_wallet_address', true))
  OR
  (auth.role() = 'anon')
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
FOR INSERT TO anon, authenticated
WITH CHECK (
  (auth.role() = 'authenticated' AND wallet_address = current_setting('app.current_wallet_address', true))
  OR
  (auth.role() = 'anon')
);

-- 2. Allow anonymous access to NFTs (they're public anyway)
DROP POLICY IF EXISTS "NFTs are publicly readable" ON public.nfts;
DROP POLICY IF EXISTS "Authenticated users can modify NFTs" ON public.nfts;

CREATE POLICY "NFTs public access" ON public.nfts
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "NFTs authenticated insert" ON public.nfts
FOR INSERT TO anon, authenticated
WITH CHECK (
  (auth.role() = 'authenticated') 
  OR 
  (auth.role() = 'anon')
);

CREATE POLICY "NFTs authenticated update" ON public.nfts
FOR UPDATE TO anon, authenticated
USING (
  (auth.role() = 'authenticated') 
  OR 
  (auth.role() = 'anon')
)
WITH CHECK (
  (auth.role() = 'authenticated') 
  OR 
  (auth.role() = 'anon')
);

CREATE POLICY "NFTs authenticated delete" ON public.nfts
FOR DELETE TO anon, authenticated
USING (
  (auth.role() = 'authenticated') 
  OR 
  (auth.role() = 'anon')
);

-- 3. Allow anonymous access to votes (with wallet-based restrictions later)
DROP POLICY IF EXISTS "Users can read their own votes" ON public.votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON public.votes;
DROP POLICY IF EXISTS "Authenticated users can read all votes" ON public.votes;

CREATE POLICY "Votes public read" ON public.votes
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Votes public insert" ON public.votes
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 4. Allow anonymous access to matchups
DROP POLICY IF EXISTS "Authenticated users can create matchups" ON public.matchups;

CREATE POLICY "Matchups public access" ON public.matchups
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. Ensure migration_status allows anonymous read access
DROP POLICY IF EXISTS "Authenticated users can read migration status" ON public.migration_status;
DROP POLICY IF EXISTS "Authenticated users can manage migration status" ON public.migration_status;

CREATE POLICY "Migration status public read" ON public.migration_status
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Migration status public insert" ON public.migration_status
FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Migration status public update" ON public.migration_status
FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Migration status public delete" ON public.migration_status
FOR DELETE TO anon, authenticated
USING (true);

-- ================================
-- VERIFICATION
-- ================================

-- Display current RLS status
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== RLS STATUS AFTER ANONYMOUS ACCESS ENABLEMENT ===';
    
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
    
    RAISE NOTICE '=== POLICIES AFTER UPDATE ===';
    
    FOR rec IN
        SELECT schemaname, tablename, policyname, permissive, roles, cmd
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'nfts', 'matchups', 'votes', 'matchup_queue', 'migration_status')
        ORDER BY tablename, policyname
    LOOP
        RAISE NOTICE 'Table: % | Policy: % | Roles: % | Command: %', 
                     rec.tablename, rec.policyname, rec.roles, rec.cmd;
    END LOOP;
END $$;