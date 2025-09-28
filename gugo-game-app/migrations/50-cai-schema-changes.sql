-- Collection Aesthetic Index (CAI) Schema Migration
-- This adds CAI tracking to collections and creates supporting tables

-- Step 1: Add CAI columns to existing collections table (if it exists)
-- Note: We'll use collection_management table as the primary collections table

ALTER TABLE collection_management ADD COLUMN IF NOT EXISTS cai_score DECIMAL(5,2);
ALTER TABLE collection_management ADD COLUMN IF NOT EXISTS cai_confidence DECIMAL(5,2);
ALTER TABLE collection_management ADD COLUMN IF NOT EXISTS cai_cohesion DECIMAL(5,2);
ALTER TABLE collection_management ADD COLUMN IF NOT EXISTS cai_coverage DECIMAL(5,2);
ALTER TABLE collection_management ADD COLUMN IF NOT EXISTS cai_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE collection_management ADD COLUMN IF NOT EXISTS cai_components JSONB;
ALTER TABLE collection_management ADD COLUMN IF NOT EXISTS cai_explanation TEXT;

-- Step 2: Create CAI history table for temporal tracking
CREATE TABLE IF NOT EXISTS cai_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_name VARCHAR(255) NOT NULL,
    cai_score DECIMAL(5,2) NOT NULL,
    cai_confidence DECIMAL(5,2) NOT NULL,
    cai_cohesion DECIMAL(5,2) NOT NULL,
    cai_coverage DECIMAL(5,2) NOT NULL,
    cai_components JSONB NOT NULL,
    cai_explanation TEXT,
    nft_count INTEGER NOT NULL,
    total_votes INTEGER NOT NULL,
    avg_poa_v2 DECIMAL(5,2),
    computation_trigger VARCHAR(50), -- 'manual', 'scheduled', 'threshold', 'new_nft'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create CAI computation queue for batch processing
CREATE TABLE IF NOT EXISTS cai_computation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_name VARCHAR(255) NOT NULL UNIQUE,
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    trigger_reason VARCHAR(100), -- 'new_votes', 'new_nft', 'manual', 'scheduled'
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    metadata JSONB
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_management_cai_score ON collection_management(cai_score DESC);
CREATE INDEX IF NOT EXISTS idx_collection_management_cai_updated ON collection_management(cai_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cai_history_collection ON cai_history(collection_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cai_history_score ON cai_history(cai_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cai_queue_status ON cai_computation_queue(status, priority DESC, requested_at ASC);
CREATE INDEX IF NOT EXISTS idx_cai_queue_collection ON cai_computation_queue(collection_name);

-- Step 5: Add constraints for data quality
DO $$
BEGIN
  -- CAI score constraints (0-100 scale)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_score_range') THEN
    ALTER TABLE collection_management ADD CONSTRAINT chk_cai_score_range
      CHECK (cai_score >= 0 AND cai_score <= 100);
  END IF;
  
  -- CAI confidence constraints (0-100 scale)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_confidence_range') THEN
    ALTER TABLE collection_management ADD CONSTRAINT chk_cai_confidence_range
      CHECK (cai_confidence >= 0 AND cai_confidence <= 100);
  END IF;
  
  -- CAI cohesion constraints (0-100 scale)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_cohesion_range') THEN
    ALTER TABLE collection_management ADD CONSTRAINT chk_cai_cohesion_range
      CHECK (cai_cohesion >= 0 AND cai_cohesion <= 100);
  END IF;
  
  -- CAI coverage constraints (0-100 scale)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_coverage_range') THEN
    ALTER TABLE collection_management ADD CONSTRAINT chk_cai_coverage_range
      CHECK (cai_coverage >= 0 AND cai_coverage <= 100);
  END IF;
  
  -- History table constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_history_score_range') THEN
    ALTER TABLE cai_history ADD CONSTRAINT chk_cai_history_score_range
      CHECK (cai_score >= 0 AND cai_score <= 100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_history_confidence_range') THEN
    ALTER TABLE cai_history ADD CONSTRAINT chk_cai_history_confidence_range
      CHECK (cai_confidence >= 0 AND cai_confidence <= 100);
  END IF;
  
  -- Queue status constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_queue_status') THEN
    ALTER TABLE cai_computation_queue ADD CONSTRAINT chk_cai_queue_status
      CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
  
  -- Queue priority constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cai_queue_priority') THEN
    ALTER TABLE cai_computation_queue ADD CONSTRAINT chk_cai_queue_priority
      CHECK (priority >= 1 AND priority <= 3);
  END IF;
END $$;

-- Step 6: Create helper functions for CAI system status
CREATE OR REPLACE FUNCTION get_cai_system_status()
RETURNS TABLE (
    total_collections INTEGER,
    collections_with_cai INTEGER,
    pending_computations INTEGER,
    avg_cai_score DECIMAL(5,2),
    last_computation TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM collection_management WHERE active = true) as total_collections,
        (SELECT COUNT(*)::INTEGER FROM collection_management WHERE active = true AND cai_score IS NOT NULL) as collections_with_cai,
        (SELECT COUNT(*)::INTEGER FROM cai_computation_queue WHERE status = 'pending') as pending_computations,
        (SELECT AVG(cai_score) FROM collection_management WHERE active = true AND cai_score IS NOT NULL) as avg_cai_score,
        (SELECT MAX(cai_updated_at) FROM collection_management WHERE active = true) as last_computation;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to validate CAI data integrity
CREATE OR REPLACE FUNCTION validate_cai_data()
RETURNS TABLE (
    collection_name VARCHAR(255),
    issue_type VARCHAR(50),
    issue_description TEXT
) AS $$
BEGIN
    -- Check for collections with CAI scores but no NFTs
    RETURN QUERY
    SELECT 
        cm.collection_name,
        'missing_nfts'::VARCHAR(50),
        'Collection has CAI score but no NFTs found'::TEXT
    FROM collection_management cm
    LEFT JOIN nfts n ON cm.collection_name = n.collection_name
    WHERE cm.cai_score IS NOT NULL 
    AND n.id IS NULL;
    
    -- Check for collections with outdated CAI scores
    RETURN QUERY
    SELECT 
        cm.collection_name,
        'outdated_cai'::VARCHAR(50),
        'CAI score older than 24 hours with recent NFT activity'::TEXT
    FROM collection_management cm
    JOIN nfts n ON cm.collection_name = n.collection_name
    WHERE cm.cai_updated_at < NOW() - INTERVAL '24 hours'
    AND n.poa_v2_updated_at > cm.cai_updated_at
    GROUP BY cm.collection_name, cm.cai_updated_at;
    
    -- Check for invalid CAI component data
    RETURN QUERY
    SELECT 
        cm.collection_name,
        'invalid_components'::VARCHAR(50),
        'CAI components JSON is invalid or missing required fields'::TEXT
    FROM collection_management cm
    WHERE cm.cai_score IS NOT NULL
    AND (cm.cai_components IS NULL 
         OR NOT (cm.cai_components ? 'aesthetic_mean')
         OR NOT (cm.cai_components ? 'aesthetic_std')
         OR NOT (cm.cai_components ? 'vote_depth'));
END;
$$ LANGUAGE plpgsql;

-- Step 8: Initialize default values for existing collections
UPDATE collection_management 
SET 
    cai_score = NULL,
    cai_confidence = NULL,
    cai_cohesion = NULL,
    cai_coverage = NULL,
    cai_updated_at = NULL,
    cai_components = NULL,
    cai_explanation = NULL
WHERE active = true;

-- Step 9: Add comments for documentation
COMMENT ON COLUMN collection_management.cai_score IS 'Collection Aesthetic Index score (0-100)';
COMMENT ON COLUMN collection_management.cai_confidence IS 'Confidence in CAI score based on data quality (0-100)';
COMMENT ON COLUMN collection_management.cai_cohesion IS 'Aesthetic cohesion within collection (0-100, higher = more consistent)';
COMMENT ON COLUMN collection_management.cai_coverage IS 'Evaluation coverage depth (0-100, higher = more thoroughly evaluated)';
COMMENT ON COLUMN collection_management.cai_components IS 'JSON breakdown of CAI calculation components';
COMMENT ON COLUMN collection_management.cai_explanation IS 'Human-readable explanation of CAI score';

COMMENT ON TABLE cai_history IS 'Historical tracking of CAI scores for temporal analysis';
COMMENT ON TABLE cai_computation_queue IS 'Queue for batch CAI computations with priority handling';

