-- 🧠 Enhanced Matchup System with Information Theory and Collection Management
-- This migration adds advanced matchup selection capabilities for maximum information gain

-- Create collection management table
CREATE TABLE IF NOT EXISTS public.collection_management (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    priority DECIMAL(3,2) DEFAULT 1.0 CHECK (priority >= 0.1 AND priority <= 3.0),
    last_selected TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata for collection insights
    notes TEXT,
    auto_managed BOOLEAN DEFAULT false,
    
    -- Constraints
    CONSTRAINT valid_collection_name CHECK (collection_name IS NOT NULL AND LENGTH(collection_name) > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_management_active ON public.collection_management(active);
CREATE INDEX IF NOT EXISTS idx_collection_management_priority ON public.collection_management(priority DESC);
CREATE INDEX IF NOT EXISTS idx_collection_management_last_selected ON public.collection_management(last_selected);

-- Add updated_at trigger
CREATE TRIGGER update_collection_management_updated_at 
    BEFORE UPDATE ON public.collection_management 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create collection management table (for programmatic access)
CREATE OR REPLACE FUNCTION public.create_collection_management_table()
RETURNS VOID AS $$
BEGIN
    -- Table creation is idempotent due to IF NOT EXISTS above
    -- This function exists primarily for the enhanced matchup engine
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced matchup selection function with information theory
CREATE OR REPLACE FUNCTION public.find_optimal_same_collection_matchup(
    target_collection TEXT DEFAULT NULL,
    max_candidates INTEGER DEFAULT 50
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
DECLARE
    uncertainty_weight DECIMAL := 0.4;
    proximity_weight DECIMAL := 0.3;
    vote_deficit_weight DECIMAL := 0.2;
    diversity_weight DECIMAL := 0.1;
BEGIN
    RETURN QUERY
    WITH active_collections AS (
        SELECT cm.collection_name, cm.priority
        FROM public.collection_management cm
        WHERE cm.active = true
        
        UNION ALL
        
        -- Include collections not in management table (default active)
        SELECT DISTINCT n.collection_name, 1.0 as priority
        FROM public.nfts n
        WHERE n.collection_name IS NOT NULL
        AND n.collection_name NOT IN (
            SELECT collection_name FROM public.collection_management
        )
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            n.wins,
            n.losses,
            n.slider_count,
            ac.priority as collection_priority,
            
            -- Calculate uncertainty (TrueSkill-inspired)
            CASE 
                WHEN n.total_votes = 0 THEN 100.0
                ELSE GREATEST(25.0, 100.0 * POWER(0.95, n.total_votes))
            END as uncertainty,
            
            -- Calculate information potential
            CASE 
                WHEN n.total_votes = 0 THEN 1.0
                ELSE (
                    -- Uncertainty factor
                    (GREATEST(25.0, 100.0 * POWER(0.95, n.total_votes)) / 100.0) * 0.5 +
                    -- Vote scarcity factor
                    GREATEST(0, 1.0 - (n.total_votes::DECIMAL / 50.0)) * 0.3 +
                    -- Balance factor (50% win rate = highest uncertainty)
                    (1.0 - ABS((COALESCE(n.wins, 0)::DECIMAL / GREATEST(1, n.total_votes)) - 0.5) * 2.0) * 0.2
                )
            END as information_potential
            
        FROM public.nfts n
        JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND n.image NOT ILIKE '%.avi%'
        AND n.image NOT ILIKE '%.webm%'
        AND n.image NOT ILIKE '%.mkv%'
        AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND (target_collection IS NULL OR n.collection_name = target_collection)
    ),
    collection_stats AS (
        SELECT 
            collection_name,
            AVG(total_votes) as avg_collection_votes,
            COUNT(*) as collection_size
        FROM eligible_nfts
        GROUP BY collection_name
    ),
    nfts_with_metrics AS (
        SELECT 
            en.*,
            -- Vote deficit (how underrepresented compared to collection average)
            GREATEST(0, (cs.avg_collection_votes - en.total_votes) / GREATEST(1, cs.avg_collection_votes)) as vote_deficit
        FROM eligible_nfts en
        JOIN collection_stats cs ON en.collection_name = cs.collection_name
    ),
    matchup_candidates AS (
        SELECT 
            n1.id as nft_a_id,
            n2.id as nft_b_id,
            ABS(n1.current_elo - n2.current_elo)::INTEGER as elo_diff,
            n1.uncertainty as uncertainty_a,
            n2.uncertainty as uncertainty_b,
            
            -- Calculate information score
            (
                -- Uncertainty component (higher = better)
                ((n1.uncertainty + n2.uncertainty) / 200.0) * uncertainty_weight +
                
                -- Elo proximity component (closer = better)
                GREATEST(0, 1.0 - ABS(n1.current_elo - n2.current_elo)::DECIMAL / 400.0) * proximity_weight +
                
                -- Vote deficit component (more underrepresented = better)
                ((n1.vote_deficit + n2.vote_deficit) / 2.0) * vote_deficit_weight +
                
                -- Collection diversity component
                ((n1.collection_priority + n2.collection_priority) / 2.0) * diversity_weight
            ) as info_score,
            
            -- Generate selection reason
            CASE 
                WHEN (n1.uncertainty > 75 OR n2.uncertainty > 75) AND ABS(n1.current_elo - n2.current_elo) < 100 THEN
                    'High uncertainty + close Elo ratings - maximum learning potential'
                WHEN n1.uncertainty > 75 OR n2.uncertainty > 75 THEN
                    'High uncertainty - strong learning potential'
                WHEN ABS(n1.current_elo - n2.current_elo) < 100 THEN
                    'Close Elo ratings - competitive matchup'
                WHEN (n1.vote_deficit + n2.vote_deficit) / 2.0 > 0.3 THEN
                    'Underrepresented NFTs - balancing dataset'
                ELSE
                    'Optimal information score'
            END as reason
            
        FROM nfts_with_metrics n1
        JOIN nfts_with_metrics n2 ON n1.collection_name = n2.collection_name 
        WHERE n1.id < n2.id  -- Avoid duplicates and self-pairs
        ORDER BY info_score DESC
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        ROUND(mc.info_score, 4) as information_score,
        mc.elo_diff,
        ROUND(mc.uncertainty_a, 2) as uncertainty_a,
        ROUND(mc.uncertainty_b, 2) as uncertainty_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced cross-collection matchup function
CREATE OR REPLACE FUNCTION public.find_optimal_cross_collection_matchup(
    max_candidates INTEGER DEFAULT 50
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
DECLARE
    uncertainty_weight DECIMAL := 0.4;
    proximity_weight DECIMAL := 0.3;
    vote_deficit_weight DECIMAL := 0.2;
    diversity_weight DECIMAL := 0.1;
BEGIN
    RETURN QUERY
    WITH active_collections AS (
        SELECT cm.collection_name, cm.priority
        FROM public.collection_management cm
        WHERE cm.active = true
        
        UNION ALL
        
        -- Include collections not in management table (default active)
        SELECT DISTINCT n.collection_name, 1.0 as priority
        FROM public.nfts n
        WHERE n.collection_name IS NOT NULL
        AND n.collection_name NOT IN (
            SELECT collection_name FROM public.collection_management
        )
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            n.wins,
            n.losses,
            ac.priority as collection_priority,
            
            -- Calculate uncertainty
            CASE 
                WHEN n.total_votes = 0 THEN 100.0
                ELSE GREATEST(25.0, 100.0 * POWER(0.95, n.total_votes))
            END as uncertainty,
            
            -- Information potential calculation
            CASE 
                WHEN n.total_votes = 0 THEN 1.0
                ELSE (
                    (GREATEST(25.0, 100.0 * POWER(0.95, n.total_votes)) / 100.0) * 0.5 +
                    GREATEST(0, 1.0 - (n.total_votes::DECIMAL / 50.0)) * 0.3 +
                    (1.0 - ABS((COALESCE(n.wins, 0)::DECIMAL / GREATEST(1, n.total_votes)) - 0.5) * 2.0) * 0.2
                )
            END as information_potential
            
        FROM public.nfts n
        JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND n.image NOT ILIKE '%.avi%'
        AND n.image NOT ILIKE '%.webm%'
        AND n.image NOT ILIKE '%.mkv%'
        AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
    ),
    global_stats AS (
        SELECT AVG(total_votes) as global_avg_votes
        FROM eligible_nfts
    ),
    nfts_with_metrics AS (
        SELECT 
            en.*,
            GREATEST(0, (gs.global_avg_votes - en.total_votes) / GREATEST(1, gs.global_avg_votes)) as vote_deficit
        FROM eligible_nfts en, global_stats gs
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
            
            -- Enhanced information score for cross-collection
            (
                -- Uncertainty component
                ((n1.uncertainty + n2.uncertainty) / 200.0) * uncertainty_weight +
                
                -- Elo proximity component
                GREATEST(0, 1.0 - ABS(n1.current_elo - n2.current_elo)::DECIMAL / 400.0) * proximity_weight +
                
                -- Vote deficit component
                ((n1.vote_deficit + n2.vote_deficit) / 2.0) * vote_deficit_weight +
                
                -- Collection diversity bonus (always positive for cross-collection)
                (((n1.collection_priority + n2.collection_priority) / 2.0) * 1.2) * diversity_weight
            ) as info_score,
            
            -- Selection reason for cross-collection
            CASE 
                WHEN (n1.uncertainty > 75 OR n2.uncertainty > 75) AND ABS(n1.current_elo - n2.current_elo) < 150 THEN
                    'Cross-collection high uncertainty matchup - discovering relative aesthetics'
                WHEN n1.uncertainty > 75 OR n2.uncertainty > 75 THEN
                    'Cross-collection with high uncertainty - learning collection dynamics'
                WHEN ABS(n1.current_elo - n2.current_elo) < 100 THEN
                    'Cross-collection competitive matchup - comparing aesthetic standards'
                WHEN (n1.vote_deficit + n2.vote_deficit) / 2.0 > 0.3 THEN
                    'Cross-collection underrepresented NFTs - expanding knowledge base'
                ELSE
                    'Cross-collection optimal information score'
            END as reason
            
        FROM nfts_with_metrics n1
        JOIN nfts_with_metrics n2 ON n1.collection_name != n2.collection_name
        WHERE n1.id != n2.id
        ORDER BY info_score DESC
        LIMIT max_candidates
    )
    SELECT 
        mc.nft_a_id,
        mc.nft_b_id,
        ROUND(mc.info_score, 4) as information_score,
        mc.elo_diff,
        ROUND(mc.uncertainty_a, 2) as uncertainty_a,
        ROUND(mc.uncertainty_b, 2) as uncertainty_b,
        mc.collection_a,
        mc.collection_b,
        mc.reason as selection_reason
    FROM matchup_candidates mc
    ORDER BY mc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced slider selection function
CREATE OR REPLACE FUNCTION public.find_optimal_slider_nft(
    target_collection TEXT DEFAULT NULL,
    max_candidates INTEGER DEFAULT 20
)
RETURNS TABLE (
    nft_id UUID,
    nft_name TEXT,
    collection_name TEXT,
    information_score DECIMAL(6,4),
    uncertainty DECIMAL(5,2),
    slider_count INTEGER,
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH active_collections AS (
        SELECT cm.collection_name, cm.priority
        FROM public.collection_management cm
        WHERE cm.active = true
        
        UNION ALL
        
        SELECT DISTINCT n.collection_name, 1.0 as priority
        FROM public.nfts n
        WHERE n.collection_name IS NOT NULL
        AND n.collection_name NOT IN (
            SELECT collection_name FROM public.collection_management
        )
    ),
    eligible_nfts AS (
        SELECT 
            n.id,
            n.name,
            n.collection_name,
            n.current_elo,
            n.total_votes,
            n.slider_count,
            n.wins,
            n.losses,
            ac.priority as collection_priority,
            
            -- Calculate uncertainty
            CASE 
                WHEN n.total_votes = 0 THEN 100.0
                ELSE GREATEST(25.0, 100.0 * POWER(0.95, n.total_votes))
            END as uncertainty
            
        FROM public.nfts n
        JOIN active_collections ac ON n.collection_name = ac.collection_name
        WHERE n.image NOT ILIKE '%.mp4%'
        AND n.image NOT ILIKE '%.mov%'
        AND n.image NOT ILIKE '%.avi%'
        AND n.image NOT ILIKE '%.webm%'
        AND n.image NOT ILIKE '%.mkv%'
        AND NOT (n.traits @> '[{"trait_type": "Reveal", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Unrevealed"}]')
        AND NOT (n.traits @> '[{"trait_type": "Status", "value": "Hidden"}]')
        AND NOT (n.traits @> '[{"trait_type": "Stage", "value": "Pre-reveal"}]')
        AND (target_collection IS NULL OR n.collection_name = target_collection)
        AND COALESCE(n.slider_count, 0) < 10  -- Focus on NFTs needing slider votes
    ),
    slider_candidates AS (
        SELECT 
            en.id,
            en.name,
            en.collection_name,
            en.uncertainty,
            COALESCE(en.slider_count, 0) as slider_count,
            
            -- Calculate slider information score
            (
                -- High uncertainty component
                (en.uncertainty / 100.0) * 0.4 +
                
                -- Slider need component (fewer slider votes = higher priority)
                (1.0 - (COALESCE(en.slider_count, 0)::DECIMAL / 10.0)) * 0.5 +
                
                -- Collection priority component
                (en.collection_priority / 3.0) * 0.1
            ) as info_score,
            
            -- Selection reason
            CASE 
                WHEN COALESCE(en.slider_count, 0) = 0 THEN
                    'New NFT - needs initial slider rating'
                WHEN en.uncertainty > 75 AND COALESCE(en.slider_count, 0) < 3 THEN
                    'High uncertainty + few slider votes - calibrating aesthetic score'
                WHEN COALESCE(en.slider_count, 0) < 3 THEN
                    'Cold start - establishing baseline aesthetic rating'
                WHEN en.uncertainty > 60 THEN
                    'Moderate uncertainty - refining aesthetic understanding'
                ELSE
                    'Optimal slider information score'
            END as reason
            
        FROM eligible_nfts en
        ORDER BY info_score DESC, uncertainty DESC
        LIMIT max_candidates
    )
    SELECT 
        sc.id as nft_id,
        sc.name as nft_name,
        sc.collection_name,
        ROUND(sc.info_score, 4) as information_score,
        ROUND(sc.uncertainty, 2) as uncertainty,
        sc.slider_count,
        sc.reason as selection_reason
    FROM slider_candidates sc
    ORDER BY sc.info_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Collection management utilities
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
    )
    SELECT 
        cs.collection_name,
        COALESCE(cm.active, true) as active,
        COALESCE(cm.priority, 1.0) as priority,
        cs.nft_count,
        ROUND(cs.avg_votes, 2) as avg_votes_per_nft,
        ROUND(cs.avg_elo, 2) as avg_elo,
        cs.total_votes,
        cm.last_selected,
        CASE 
            WHEN cm.last_selected IS NOT NULL THEN
                ROUND(EXTRACT(EPOCH FROM (NOW() - cm.last_selected)) / 3600.0, 2)
            ELSE NULL
        END as hours_since_selected
    FROM collection_stats cs
    LEFT JOIN public.collection_management cm ON cs.collection_name = cm.collection_name
    ORDER BY cs.nft_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Test the enhanced system
CREATE OR REPLACE FUNCTION public.test_enhanced_matchup_system()
RETURNS TABLE (
    test_name TEXT,
    result TEXT,
    details TEXT
) AS $$
BEGIN
    -- Test 1: Same collection optimal matchup
    RETURN QUERY
    SELECT 
        'Enhanced Same Collection Matchup'::TEXT as test_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END as result,
        FORMAT('Found %s matchup candidates with information scores', COUNT(*)) as details
    FROM public.find_optimal_same_collection_matchup() LIMIT 1;
    
    -- Test 2: Cross collection optimal matchup
    RETURN QUERY
    SELECT 
        'Enhanced Cross Collection Matchup'::TEXT as test_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END as result,
        FORMAT('Found %s cross-collection candidates with information scores', COUNT(*)) as details
    FROM public.find_optimal_cross_collection_matchup() LIMIT 1;
    
    -- Test 3: Optimal slider selection
    RETURN QUERY
    SELECT 
        'Enhanced Slider Selection'::TEXT as test_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END as result,
        FORMAT('Found %s slider candidates with information scores', COUNT(*)) as details
    FROM public.find_optimal_slider_nft() LIMIT 1;
    
    -- Test 4: Collection management
    RETURN QUERY
    SELECT 
        'Collection Statistics'::TEXT as test_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END as result,
        FORMAT('Loaded statistics for %s collections', COUNT(*)) as details
    FROM public.get_collection_statistics();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_collection_management_table() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_optimal_same_collection_matchup(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_optimal_cross_collection_matchup(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_optimal_slider_nft(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_collection_statistics() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_enhanced_matchup_system() TO anon, authenticated;

-- Grant table permissions
GRANT SELECT ON public.collection_management TO anon, authenticated;
GRANT INSERT, UPDATE ON public.collection_management TO authenticated;

-- Create RLS policies for collection management
ALTER TABLE public.collection_management ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collection management is publicly readable" ON public.collection_management
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage collections" ON public.collection_management
    FOR ALL USING (true) WITH CHECK (true);

-- Run tests
SELECT * FROM public.test_enhanced_matchup_system();
