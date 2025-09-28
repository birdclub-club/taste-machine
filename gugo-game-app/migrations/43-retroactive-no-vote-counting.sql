-- 📉 Retroactive NO Vote Counting Migration
-- Counts existing NO votes for both NFTs (valuable negative aesthetic data)

-- First, let's analyze existing NO votes
DO $$
DECLARE
    total_no_votes INTEGER;
    total_super_no_votes INTEGER;
    affected_nfts INTEGER;
BEGIN
    -- Count total NO votes
    SELECT COUNT(*) INTO total_no_votes
    FROM public.votes 
    WHERE winner_id IS NULL 
      AND nft_a_id IS NOT NULL 
      AND nft_b_id IS NOT NULL
      AND vote_type_v2 IN ('same_coll', 'cross_coll')
      AND (engagement_data->>'no_vote')::boolean = true;
    
    -- Count super NO votes
    SELECT COUNT(*) INTO total_super_no_votes
    FROM public.votes 
    WHERE winner_id IS NULL 
      AND nft_a_id IS NOT NULL 
      AND nft_b_id IS NOT NULL
      AND vote_type_v2 IN ('same_coll', 'cross_coll')
      AND (engagement_data->>'no_vote')::boolean = true
      AND (engagement_data->>'super_vote')::boolean = true;
    
    -- Count unique NFTs that will be affected
    SELECT COUNT(DISTINCT nft_id) INTO affected_nfts
    FROM (
        SELECT nft_a_id::uuid as nft_id FROM public.votes 
        WHERE winner_id IS NULL 
          AND nft_a_id IS NOT NULL 
          AND nft_b_id IS NOT NULL
          AND vote_type_v2 IN ('same_coll', 'cross_coll')
          AND (engagement_data->>'no_vote')::boolean = true
        UNION
        SELECT nft_b_id::uuid as nft_id FROM public.votes 
        WHERE winner_id IS NULL 
          AND nft_a_id IS NOT NULL 
          AND nft_b_id IS NOT NULL
          AND vote_type_v2 IN ('same_coll', 'cross_coll')
          AND (engagement_data->>'no_vote')::boolean = true
    ) unique_nfts;
    
    RAISE NOTICE '📊 RETROACTIVE NO VOTE ANALYSIS:';
    RAISE NOTICE '   Total NO votes found: %', total_no_votes;
    RAISE NOTICE '   Super NO votes: %', total_super_no_votes;
    RAISE NOTICE '   Regular NO votes: %', total_no_votes - total_super_no_votes;
    RAISE NOTICE '   Unique NFTs affected: %', affected_nfts;
    RAISE NOTICE '   Vote count increases will be applied to both NFTs in each matchup';
END $$;

-- Create a temporary table to track NO vote impacts per NFT
CREATE TEMP TABLE no_vote_impacts AS
WITH no_votes_expanded AS (
    -- Get all NO votes and expand to show impact on each NFT
    SELECT 
        v.id as vote_id,
        v.nft_a_id::uuid as nft_id,
        CASE 
            WHEN (v.engagement_data->>'super_vote')::boolean = true THEN 5
            ELSE 1 
        END as vote_weight,
        v.created_at,
        'NFT_A' as position
    FROM public.votes v
    WHERE v.winner_id IS NULL 
      AND v.nft_a_id IS NOT NULL 
      AND v.nft_b_id IS NOT NULL
      AND v.vote_type_v2 IN ('same_coll', 'cross_coll')
      AND (v.engagement_data->>'no_vote')::boolean = true
    
    UNION ALL
    
    SELECT 
        v.id as vote_id,
        v.nft_b_id::uuid as nft_id,
        CASE 
            WHEN (v.engagement_data->>'super_vote')::boolean = true THEN 5
            ELSE 1 
        END as vote_weight,
        v.created_at,
        'NFT_B' as position
    FROM public.votes v
    WHERE v.winner_id IS NULL 
      AND v.nft_a_id IS NOT NULL 
      AND v.nft_b_id IS NOT NULL
      AND v.vote_type_v2 IN ('same_coll', 'cross_coll')
      AND (v.engagement_data->>'no_vote')::boolean = true
)
SELECT 
    nft_id,
    SUM(vote_weight) as total_vote_increase,
    COUNT(*) as no_vote_count,
    MIN(created_at) as first_no_vote,
    MAX(created_at) as last_no_vote
FROM no_votes_expanded
GROUP BY nft_id;

-- Show impact summary before applying changes
DO $$
DECLARE
    total_nfts INTEGER;
    total_vote_increases INTEGER;
    max_increase INTEGER;
    avg_increase NUMERIC;
BEGIN
    SELECT 
        COUNT(*),
        SUM(total_vote_increase),
        MAX(total_vote_increase),
        AVG(total_vote_increase)
    INTO total_nfts, total_vote_increases, max_increase, avg_increase
    FROM no_vote_impacts;
    
    RAISE NOTICE '📈 IMPACT SUMMARY:';
    RAISE NOTICE '   NFTs to be updated: %', total_nfts;
    RAISE NOTICE '   Total vote count increases: %', total_vote_increases;
    RAISE NOTICE '   Max increase for single NFT: %', max_increase;
    RAISE NOTICE '   Average increase per NFT: %', ROUND(avg_increase, 2);
END $$;

-- Apply the retroactive vote count updates
DO $$
DECLARE
    update_count INTEGER := 0;
    nft_record RECORD;
BEGIN
    RAISE NOTICE '🔄 Starting retroactive NO vote counting...';
    
    -- Update each NFT's total_votes based on NO vote impacts
    FOR nft_record IN 
        SELECT 
            nvi.nft_id,
            nvi.total_vote_increase,
            nvi.no_vote_count,
            n.collection_name,
            n.name,
            n.total_votes as current_votes
        FROM no_vote_impacts nvi
        JOIN public.nfts n ON n.id = nvi.nft_id
        ORDER BY nvi.total_vote_increase DESC
    LOOP
        -- Update the NFT's total_votes
        UPDATE public.nfts 
        SET 
            total_votes = COALESCE(total_votes, 0) + nft_record.total_vote_increase,
            updated_at = NOW()
        WHERE id = nft_record.nft_id;
        
        update_count := update_count + 1;
        
        -- Log progress for significant updates
        IF nft_record.total_vote_increase >= 5 OR update_count % 100 = 0 THEN
            RAISE NOTICE '   Updated % (%) from % to % votes (+% from % NO votes)', 
                nft_record.name,
                nft_record.collection_name,
                nft_record.current_votes,
                nft_record.current_votes + nft_record.total_vote_increase,
                nft_record.total_vote_increase,
                nft_record.no_vote_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ RETROACTIVE UPDATE COMPLETE:';
    RAISE NOTICE '   Updated % NFTs with NO vote counts', update_count;
    RAISE NOTICE '   Negative aesthetic data now properly counted in total_votes';
END $$;

-- Verify the changes
DO $$
DECLARE
    sample_record RECORD;
    verification_count INTEGER;
BEGIN
    RAISE NOTICE '🔍 VERIFICATION - Sample updated NFTs:';
    
    -- Show a few examples of updated NFTs
    verification_count := 0;
    FOR sample_record IN 
        SELECT 
            n.name,
            n.collection_name,
            n.total_votes,
            nvi.total_vote_increase,
            nvi.no_vote_count
        FROM public.nfts n
        JOIN no_vote_impacts nvi ON n.id = nvi.nft_id
        WHERE nvi.total_vote_increase >= 3
        ORDER BY nvi.total_vote_increase DESC
        LIMIT 5
    LOOP
        verification_count := verification_count + 1;
        RAISE NOTICE '   % (%) - % total votes (includes +% from % NO votes)',
            sample_record.name,
            sample_record.collection_name,
            sample_record.total_votes,
            sample_record.total_vote_increase,
            sample_record.no_vote_count;
    END LOOP;
    
    IF verification_count = 0 THEN
        RAISE NOTICE '   No NFTs with significant NO vote impacts found (all increases < 3)';
    END IF;
END $$;

-- Clean up temporary table
DROP TABLE no_vote_impacts;

-- Final summary
DO $$
DECLARE
    updated_collections RECORD;
BEGIN
    RAISE NOTICE '📊 COLLECTION IMPACT SUMMARY:';
    
    -- Show impact by collection
    FOR updated_collections IN 
        WITH collection_impacts AS (
            SELECT 
                n.collection_name,
                COUNT(*) as nfts_updated,
                SUM(CASE 
                    WHEN (v.engagement_data->>'super_vote')::boolean = true THEN 5
                    ELSE 1 
                END) as total_vote_additions
            FROM public.votes v
            JOIN public.nfts n ON (n.id = v.nft_a_id::uuid OR n.id = v.nft_b_id::uuid)
            WHERE v.winner_id IS NULL 
              AND v.nft_a_id IS NOT NULL 
              AND v.nft_b_id IS NOT NULL
              AND v.vote_type_v2 IN ('same_coll', 'cross_coll')
              AND (v.engagement_data->>'no_vote')::boolean = true
            GROUP BY n.collection_name
        )
        SELECT * FROM collection_impacts 
        ORDER BY total_vote_additions DESC
        LIMIT 10
    LOOP
        RAISE NOTICE '   % collection: +% votes across % NFTs',
            updated_collections.collection_name,
            updated_collections.total_vote_additions,
            updated_collections.nfts_updated;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Retroactive NO vote counting complete!';
    RAISE NOTICE '   All historical negative aesthetic data now properly counted';
    RAISE NOTICE '   Admin panel vote totals now include NO vote engagement';
    RAISE NOTICE '   POA scoring will have richer dataset for future calculations';
END $$;

