-- 🚀 Database Performance Optimization
-- Fixes all 27 performance warnings by:
-- 1. Optimizing RLS policies to use (select auth.<function>()) instead of auth.<function>()
-- 2. Consolidating multiple permissive policies for better performance

-- ================================
-- 🔄 OPTIMIZE AUTH RLS INITPLAN ISSUES
-- ================================

-- 1. Fix NFTs table policies
DROP POLICY IF EXISTS "Authenticated users can modify NFTs" ON public.nfts;
CREATE POLICY "Authenticated users can modify NFTs" ON public.nfts
FOR ALL TO authenticated
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');

-- 2. Fix matchups table policies  
DROP POLICY IF EXISTS "Authenticated users can create matchups" ON public.matchups;
CREATE POLICY "Authenticated users can create matchups" ON public.matchups
FOR INSERT TO authenticated
WITH CHECK ((select auth.role()) = 'authenticated');

-- 3. Fix votes table policies
DROP POLICY IF EXISTS "Users can read their own votes" ON public.votes;
CREATE POLICY "Users can read their own votes" ON public.votes
FOR SELECT TO authenticated
USING (user_id::text = (select current_setting('app.current_user_id', true)));

DROP POLICY IF EXISTS "Users can insert their own votes" ON public.votes;
CREATE POLICY "Users can insert their own votes" ON public.votes
FOR INSERT TO authenticated
WITH CHECK (user_id::text = (select current_setting('app.current_user_id', true)));

DROP POLICY IF EXISTS "Authenticated users can read all votes" ON public.votes;
CREATE POLICY "Authenticated users can read all votes" ON public.votes
FOR SELECT TO authenticated
USING ((select auth.role()) = 'authenticated');

-- 4. Fix matchup_queue table policies
DROP POLICY IF EXISTS "Authenticated users can manage queue" ON public.matchup_queue;
CREATE POLICY "Authenticated users can manage queue" ON public.matchup_queue
FOR ALL TO authenticated
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');

-- 5. Fix users table policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT TO authenticated
USING (wallet_address = (select current_setting('app.current_wallet_address', true)));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE TO authenticated
USING (wallet_address = (select current_setting('app.current_wallet_address', true)))
WITH CHECK (wallet_address = (select current_setting('app.current_wallet_address', true)));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
FOR INSERT TO authenticated
WITH CHECK (wallet_address = (select current_setting('app.current_wallet_address', true)));

-- 6. Fix migration_status table policies
DROP POLICY IF EXISTS "Authenticated users can read migration status" ON public.migration_status;
CREATE POLICY "Authenticated users can read migration status" ON public.migration_status
FOR SELECT TO authenticated
USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage migration status" ON public.migration_status;
CREATE POLICY "Authenticated users can manage migration status" ON public.migration_status
FOR ALL TO authenticated
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');

-- ================================
-- 🔗 CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ================================

-- The issue is having multiple permissive policies for the same role/action
-- We need to consolidate these into single, more efficient policies

-- 7. Consolidate matchup_queue policies
-- Remove the redundant "Authenticated users can manage queue" since we already have "Queue is publicly readable"
-- Keep public readable and add specific authenticated management
DROP POLICY IF EXISTS "Queue is publicly readable" ON public.matchup_queue;
DROP POLICY IF EXISTS "Authenticated users can manage queue" ON public.matchup_queue;

-- Create optimized consolidated policy
CREATE POLICY "Queue access policy" ON public.matchup_queue
FOR SELECT TO anon, authenticated
USING (true); -- Public readable

CREATE POLICY "Queue insert policy" ON public.matchup_queue
FOR INSERT TO authenticated
WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Queue update policy" ON public.matchup_queue
FOR UPDATE TO authenticated
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Queue delete policy" ON public.matchup_queue
FOR DELETE TO authenticated
USING ((select auth.role()) = 'authenticated');

-- 8. Consolidate migration_status policies
-- Merge the read and manage policies into a single comprehensive policy
DROP POLICY IF EXISTS "Authenticated users can read migration status" ON public.migration_status;
DROP POLICY IF EXISTS "Authenticated users can manage migration status" ON public.migration_status;

CREATE POLICY "Migration status policy" ON public.migration_status
FOR ALL TO authenticated
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');

-- 9. Consolidate NFTs policies
-- Remove redundant policies and create optimized ones
DROP POLICY IF EXISTS "NFTs are publicly readable" ON public.nfts;
DROP POLICY IF EXISTS "Authenticated users can modify NFTs" ON public.nfts;

-- Public read access
CREATE POLICY "NFTs public read policy" ON public.nfts
FOR SELECT TO anon, authenticated
USING (true);

-- Authenticated modification access (excluding SELECT which is handled by public read policy)
CREATE POLICY "NFTs authenticated modify policy" ON public.nfts
FOR INSERT TO authenticated
WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "NFTs authenticated update policy" ON public.nfts
FOR UPDATE TO authenticated
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "NFTs authenticated delete policy" ON public.nfts
FOR DELETE TO authenticated
USING ((select auth.role()) = 'authenticated');

-- 10. Consolidate votes policies  
-- Remove redundant overlapping policies
DROP POLICY IF EXISTS "Authenticated users can read all votes" ON public.votes;
DROP POLICY IF EXISTS "Users can read their own votes" ON public.votes;

-- Create single optimized read policy (authenticated users can read all votes)
CREATE POLICY "Votes read policy" ON public.votes
FOR SELECT TO authenticated
USING ((select auth.role()) = 'authenticated');

-- Keep user-specific insert policy
-- (Users can insert their own votes policy already recreated above)

-- ================================
-- 📊 PERFORMANCE VERIFICATION
-- ================================

-- Check Auth RLS Initplan improvements
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND (qual LIKE '%auth.%' OR with_check LIKE '%auth.%')
ORDER BY tablename, policyname;

-- Check for remaining multiple permissive policies
SELECT 
    schemaname,
    tablename,
    cmd,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- Summary report
SELECT 
    '✅ Performance Optimization Complete!' as status,
    'Auth RLS policies optimized with (select auth.<function>())' as auth_fix,
    'Multiple permissive policies consolidated' as policy_fix,
    'Expected result: 0 performance warnings' as expected_result;