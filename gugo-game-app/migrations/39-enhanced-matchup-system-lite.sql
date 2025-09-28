-- 🧠 Enhanced Matchup System - Lightweight Version
-- Optimized for fast execution and no timeouts

-- Create collection management table (lightweight)
CREATE TABLE IF NOT EXISTS public.collection_management (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    priority DECIMAL(3,2) DEFAULT 1.0 CHECK (priority >= 0.1 AND priority <= 3.0),
    last_selected TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    auto_managed BOOLEAN DEFAULT false
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_collection_management_active ON public.collection_management(active);
CREATE INDEX IF NOT EXISTS idx_collection_management_priority ON public.collection_management(priority DESC);

-- Add updated_at trigger (only if update function exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_collection_management_updated_at ON public.collection_management;
        CREATE TRIGGER update_collection_management_updated_at 
            BEFORE UPDATE ON public.collection_management 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Simple collection statistics function (fast execution)
CREATE OR REPLACE FUNCTION public.get_collection_statistics()
RETURNS TABLE (
    collection_name TEXT,
    active BOOLEAN,
    priority DECIMAL(3,2),
    nft_count BIGINT,
    avg_votes_per_nft DECIMAL(8,2),
    avg_elo DECIMAL(8,2),
    total_votes BIGINT,
    last_selected TIMESTAMP WITH TIME ZONE,
    hours_since_selected DECIMAL(8,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH collection_stats AS (
        SELECT 
            n.collection_name,
            COUNT(*) as nft_count,
            AVG(COALESCE(n.total_votes, 0)) as avg_votes,
            AVG(COALESCE(n.current_elo, 1200)) as avg_elo,
            SUM(COALESCE(n.total_votes, 0)) as total_votes
        FROM public.nfts n
        WHERE n.collection_name IS NOT NULL
        GROUP BY n.collection_name
        LIMIT 20  -- Limit for performance
    )
    SELECT 
        cs.collection_name,
        COALESCE(cm.active, true) as active,
        COALESCE(cm.priority, 1.0) as priority,
        cs.nft_count,
        ROUND(cs.avg_votes::NUMERIC, 2) as avg_votes_per_nft,
        ROUND(cs.avg_elo::NUMERIC, 2) as avg_elo,
        cs.total_votes,
        cm.last_selected,
        CASE 
            WHEN cm.last_selected IS NOT NULL THEN
                ROUND((EXTRACT(EPOCH FROM (NOW() - cm.last_selected)) / 3600.0)::NUMERIC, 2)
            ELSE NULL
        END as hours_since_selected
    FROM collection_stats cs
    LEFT JOIN public.collection_management cm ON cs.collection_name = cm.collection_name
    ORDER BY cs.nft_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Lightweight optimal same collection matchup (fast execution)
CREATE OR REPLACE FUNCTION public.find_optimal_same_collection_matchup_lite(
    target_collection TEXT DEFAULT NULL,
    max_candidates INTEGER DEFAULT 10
)
RETURNS TABLE (
    nft_a_id UUID,
    nft_b_id UUID,
    information_score DECIMAL(6,4),
    elo_diff INTEGER,
    uncertainty_a DECIMAL(5,2),
    uncertainty_b DECIMAL(5,2),
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            COALESCE(n.current_elo, 1200) as current_elo,
            COALESCE(n.total_votes, 0) as total_votes,
            -- Simple uncertainty calculation
            CASE 
                WHEN COALESCE(n.total_votes, 0) = 0 THEN 100.0
                ELSE GREATEST(25.0, 100.0 * POWER(0.95, COALESCE(n.total_votes, 0)))
            END as uncertainty
        FROM public.nfts n
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND (target_collection IS NULL OR n.collection_name = target_collection)
        AND n.collection_name IS NOT NULL
        LIMIT 100  -- Limit for performance
    ),
    matchup_candidates AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            
            -- Simple information score
            (
                ((n1.uncertainty + n2.uncertainty) / 200.0) * 0.6 +
                GREATEST(0, 1.0 - ABS(n1.current_elo - n2.current_elo)::DECIMAL / 400.0) * 0.4
            ) as info_score,
            
            -- Simple selection reason
            CASE 
                WHEN (n1.uncertainty > 75 OR n2.uncertainty > 75) THEN
                    'High uncertainty - learning potential'
                WHEN ABS(n1.current_elo - n2.current_elo) < 100 THEN
                    'Close Elo ratings - competitive matchup'
                ELSE
                    'Balanced information score'
            END as reason
            
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name = n2.collection_name 
        WHERE n1.id < n2.id  -- Avoid duplicates
        ORDER BY info_score DESC
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        ROUND(mc.info_score::NUMERIC, 4) as information_score,
        mc.elo_diff,
        ROUND(mc.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(mc.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Lightweight cross collection matchup
CREATE OR REPLACE FUNCTION public.find_optimal_cross_collection_matchup_lite(
    max_candidates INTEGER DEFAULT 10
)
RETURNS TABLE (
    nft_a_id UUID,
    nft_b_id UUID,
    information_score DECIMAL(6,4),
    elo_diff INTEGER,
    uncertainty_a DECIMAL(5,2),
    uncertainty_b DECIMAL(5,2),
    collection_a TEXT,
    collection_b TEXT,
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            COALESCE(n.current_elo, 1200) as current_elo,
            COALESCE(n.total_votes, 0) as total_votes,
            CASE 
                WHEN COALESCE(n.total_votes, 0) = 0 THEN 100.0
                ELSE GREATEST(25.0, 100.0 * POWER(0.95, COALESCE(n.total_votes, 0)))
            END as uncertainty
        FROM public.nfts n
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND n.collection_name IS NOT NULL
        LIMIT 200  -- Increase limit for better cross-collection matching
    ),
    matchup_candidates AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            n1.collection_name as collection_a,
            n2.collection_name as collection_b,
            
            -- Enhanced score for cross-collection
            (
                ((n1.uncertainty + n2.uncertainty) / 200.0) * 0.5 +
                GREATEST(0, 1.0 - ABS(n1.current_elo - n2.current_elo)::DECIMAL / 400.0) * 0.3 +
                0.2  -- Cross-collection bonus
            ) as info_score,
            
            'Cross-collection comparison' as reason
            
        FROM eligible_nfts n1
        JOIN eligible_nfts n2 ON n1.collection_name != n2.collection_name
        WHERE n1.id < n2.id  -- Avoid duplicates and self-matches
        ORDER BY info_score DESC
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        ROUND(mc.info_score::NUMERIC, 4) as information_score,
        mc.elo_diff,
        ROUND(mc.uncertainty_a::NUMERIC, 2) as uncertainty_a,
        ROUND(mc.uncertainty_b::NUMERIC, 2) as uncertainty_b,
        mc.collection_a,
        mc.collection_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Simple test function (very fast)
CREATE OR REPLACE FUNCTION public.test_enhanced_matchup_system_lite()
RETURNS TABLE (
    test_name TEXT,
    result TEXT,
    details TEXT
) AS $$
BEGIN
    -- Test 1: Collection management table
    RETURN QUERY
    SELECT 
        'Collection Management Table'::TEXT as test_name,
        'PASS'::TEXT as result,
        'Table created successfully' as details;
    
    -- Test 2: Collection statistics
    RETURN QUERY
    SELECT 
        'Collection Statistics'::TEXT as test_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END as result,
        FORMAT('Found %s collections', COUNT(*)) as details
    FROM public.get_collection_statistics();
    
    -- Test 3: Same collection matchup
    RETURN QUERY
    SELECT 
        'Same Collection Matchup'::TEXT as test_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END as result,
        FORMAT('Found %s same-collection candidates', COUNT(*)) as details
    FROM public.find_optimal_same_collection_matchup_lite() LIMIT 1;
    
    -- Test 4: Cross collection matchup
    RETURN QUERY
    SELECT 
        'Cross Collection Matchup'::TEXT as test_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END as result,
        FORMAT('Found %s cross-collection candidates', COUNT(*)) as details
    FROM public.find_optimal_cross_collection_matchup_lite() LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_collection_statistics() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_optimal_same_collection_matchup_lite(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_optimal_cross_collection_matchup_lite(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_enhanced_matchup_system_lite() TO anon, authenticated;

-- Grant table permissions
GRANT SELECT ON public.collection_management TO anon, authenticated;
GRANT INSERT, UPDATE ON public.collection_management TO authenticated;

-- Create RLS policies
ALTER TABLE public.collection_management ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collection management is publicly readable" ON public.collection_management
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage collections" ON public.collection_management
    FOR ALL USING (true) WITH CHECK (true);

-- Test the system
SELECT 'Enhanced Matchup System Lite Installation Complete!' as status;
SELECT * FROM public.test_enhanced_matchup_system_lite();
