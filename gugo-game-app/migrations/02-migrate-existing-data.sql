-- 🔄 STAGE 2: Safe Migration - Migrate Existing Data
-- This migration populates new columns with data from existing columns
-- Run this AFTER Stage 1 migration is successful

-- ================================
-- 📋 PRE-MIGRATION VALIDATION
-- ================================

-- Check that Stage 1 was completed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.migration_status 
        WHERE stage = 1 AND description = 'Added new voting system columns'
    ) THEN
        RAISE EXCEPTION 'Stage 1 migration must be completed first. Run 01-add-new-voting-columns.sql';
    END IF;
END $$;

-- ================================
-- 🎯 MIGRATE NFT DATA: looks_score → current_elo
-- ================================

-- Migrate existing looks_score to current_elo for all NFTs
UPDATE public.nfts 
SET 
    current_elo = CASE 
        WHEN looks_score IS NOT NULL THEN looks_score::FLOAT
        ELSE 1500.0  -- Default Elo for NFTs without scores
    END,
    elo_last_updated = updated_at,
    slider_count = 0,  -- Start fresh for slider counts
    slider_average = NULL  -- Will be populated as users vote
WHERE current_elo IS NULL OR current_elo = 1500.0;

-- ================================
-- 🗳️ MIGRATE VOTE DATA: vote_type → vote_type_v2
-- ================================

-- Create a temporary function to migrate vote types
CREATE OR REPLACE FUNCTION migrate_vote_types() RETURNS VOID AS $$
DECLARE
    vote_record RECORD;
    matchup_record RECORD;
BEGIN
    -- Loop through all votes and migrate them
    FOR vote_record IN 
        SELECT v.id, v.matchup_id, v.vote_type, v.user_id, v.winner_id
        FROM public.votes v
        WHERE v.vote_type_v2 IS NULL
    LOOP
        -- Get the matchup details for this vote
        SELECT m.nft1_id, m.nft2_id INTO matchup_record
        FROM public.matchups m 
        WHERE m.id = vote_record.matchup_id;
        
        IF FOUND THEN
            -- Update the vote with new schema data
            UPDATE public.votes 
            SET 
                vote_type_v2 = CASE 
                    WHEN vote_record.vote_type = 'super' THEN 'same_coll'  -- Map super votes to same collection
                    ELSE 'same_coll'  -- Default regular votes to same collection for now
                END,
                nft_a_id = matchup_record.nft1_id,
                nft_b_id = matchup_record.nft2_id,
                slider_value = NULL,  -- Old votes didn't have slider values
                engagement_data = jsonb_build_object(
                    'migrated_from_v1', true,
                    'original_vote_type', vote_record.vote_type,
                    'migration_date', NOW()
                )
            WHERE id = vote_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migrated % votes to new schema', (SELECT COUNT(*) FROM public.votes WHERE vote_type_v2 IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_vote_types();

-- Clean up the temporary function
DROP FUNCTION migrate_vote_types();

-- ================================
-- 👤 MIGRATE USER DATA
-- ================================

-- Update user voting statistics
UPDATE public.users 
SET 
    last_vote_at = (
        SELECT MAX(v.created_at) 
        FROM public.votes v 
        WHERE v.user_id = users.id
    ),
    vote_streak = 0,  -- Reset streaks - will be calculated going forward
    custom_taste_vector = jsonb_build_object(
        'total_votes', total_votes,
        'xp', xp,
        'migrated_at', NOW()
    )
WHERE last_vote_at IS NULL;

-- ================================
-- 🔧 CREATE SMART MATCHUP FUNCTIONS
-- ================================

-- Function to find NFTs needing slider votes (cold start)
CREATE OR REPLACE FUNCTION find_cold_start_nfts(limit_count INTEGER DEFAULT 1)
RETURNS TABLE(nft_id UUID, collection_name TEXT, slider_count INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.collection_name, n.slider_count
    FROM public.nfts n
    WHERE n.slider_count < 5
    ORDER BY n.slider_count ASC, RANDOM()
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to find same-collection Elo matchups
CREATE OR REPLACE FUNCTION find_same_collection_matchup()
RETURNS TABLE(nft_a_id UUID, nft_b_id UUID, elo_diff FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, b.id, ABS(a.current_elo - b.current_elo) as elo_diff
    FROM public.nfts a
    JOIN public.nfts b ON a.collection_name = b.collection_name AND a.id < b.id
    WHERE ABS(a.current_elo - b.current_elo) < 100  -- Close Elo ratings
    ORDER BY RANDOM()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find cross-collection Elo matchups  
CREATE OR REPLACE FUNCTION find_cross_collection_matchup()
RETURNS TABLE(nft_a_id UUID, nft_b_id UUID, elo_diff FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, b.id, ABS(a.current_elo - b.current_elo) as elo_diff
    FROM public.nfts a
    JOIN public.nfts b ON a.collection_name != b.collection_name
    WHERE ABS(a.current_elo - b.current_elo) BETWEEN 50 AND 200  -- Moderate Elo difference
    ORDER BY RANDOM()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to decide vote type based on user and NFT pool
CREATE OR REPLACE FUNCTION decide_vote_type(user_wallet TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    cold_start_available INTEGER;
    random_value FLOAT;
BEGIN
    -- Check if there are NFTs needing slider votes
    SELECT COUNT(*) INTO cold_start_available
    FROM public.nfts 
    WHERE slider_count < 5;
    
    -- If many NFTs need slider votes, prioritize them
    IF cold_start_available > 100 THEN
        RETURN 'slider';
    END IF;
    
    -- Otherwise use weighted random selection
    SELECT RANDOM() INTO random_value;
    
    IF random_value < 0.3 AND cold_start_available > 0 THEN
        RETURN 'slider';
    ELSIF random_value < 0.65 THEN
        RETURN 'same_coll';
    ELSE
        RETURN 'cross_coll';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 📊 VALIDATION & STATISTICS
-- ================================

-- Create validation function
CREATE OR REPLACE FUNCTION validate_migration_stage_2()
RETURNS TABLE(
    metric TEXT,
    old_count BIGINT,
    new_count BIGINT,
    migration_success BOOLEAN
) AS $$
BEGIN
    -- NFT Elo migration validation
    RETURN QUERY
    SELECT 
        'NFTs with Elo scores'::TEXT,
        COUNT(*) FILTER (WHERE looks_score IS NOT NULL),
        COUNT(*) FILTER (WHERE current_elo IS NOT NULL AND current_elo != 1500.0),
        (COUNT(*) FILTER (WHERE current_elo IS NOT NULL)) = COUNT(*)
    FROM public.nfts;
    
    -- Votes migration validation
    RETURN QUERY
    SELECT 
        'Votes migrated'::TEXT,
        COUNT(*) FILTER (WHERE vote_type IS NOT NULL),
        COUNT(*) FILTER (WHERE vote_type_v2 IS NOT NULL),
        (COUNT(*) FILTER (WHERE vote_type_v2 IS NOT NULL)) = COUNT(*)
    FROM public.votes;
    
    -- Users with voting data
    RETURN QUERY
    SELECT 
        'Users with vote history'::TEXT,
        COUNT(*) FILTER (WHERE total_votes > 0),
        COUNT(*) FILTER (WHERE last_vote_at IS NOT NULL),
        (COUNT(*) FILTER (WHERE last_vote_at IS NOT NULL)) >= (COUNT(*) FILTER (WHERE total_votes > 0))
    FROM public.users;
END;
$$ LANGUAGE plpgsql;

-- Run validation and display results
SELECT * FROM validate_migration_stage_2();

-- Record migration completion
INSERT INTO public.migration_status (stage, description, notes)
VALUES (2, 'Migrated existing data to new schema', 'Preserved all historical data while adding new columns');

-- ================================
-- 🔍 VERIFICATION QUERIES
-- ================================

-- Sample queries to verify migration success:

-- Check NFT Elo distribution:
-- SELECT 
--     collection_name,
--     COUNT(*) as nft_count,
--     AVG(current_elo) as avg_elo,
--     MIN(current_elo) as min_elo,
--     MAX(current_elo) as max_elo
-- FROM public.nfts 
-- GROUP BY collection_name
-- ORDER BY avg_elo DESC;

-- Check vote type distribution:
-- SELECT 
--     vote_type_v2,
--     COUNT(*) as vote_count
-- FROM public.votes 
-- WHERE vote_type_v2 IS NOT NULL
-- GROUP BY vote_type_v2;

-- Check cold start NFTs:
-- SELECT COUNT(*) as cold_start_nfts
-- FROM public.nfts 
-- WHERE slider_count < 5;

COMMIT;