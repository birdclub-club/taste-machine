-- 🚀 POA v2 Schema Changes - Phase A1
-- Adds Bayesian Elo, user statistics, and POA v2 columns
-- Migration: 49-poa-v2-schema-changes.sql

-- ================================
-- 📊 NFT TABLE ENHANCEMENTS
-- ================================

-- Add POA v2 columns to NFTs table
ALTER TABLE nfts
  ADD COLUMN IF NOT EXISTS elo_mean NUMERIC DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS elo_sigma NUMERIC DEFAULT 350,
  ADD COLUMN IF NOT EXISTS poa_v2 NUMERIC,
  ADD COLUMN IF NOT EXISTS poa_v2_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poa_v2_components JSONB,
  ADD COLUMN IF NOT EXISTS poa_v2_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS poa_v2_explanation TEXT;

-- Add comments for documentation
COMMENT ON COLUMN nfts.elo_mean IS 'Bayesian Elo rating mean (Glicko-lite system)';
COMMENT ON COLUMN nfts.elo_sigma IS 'Bayesian Elo rating uncertainty (lower = more confident)';
COMMENT ON COLUMN nfts.poa_v2 IS 'POA v2 score (0-100) using Bayesian approach';
COMMENT ON COLUMN nfts.poa_v2_updated_at IS 'Last time POA v2 was computed';
COMMENT ON COLUMN nfts.poa_v2_components IS 'JSON breakdown of POA v2 components {elo, slider, fire, confidence}';
COMMENT ON COLUMN nfts.poa_v2_confidence IS 'Confidence level in POA v2 score (0-100)';
COMMENT ON COLUMN nfts.poa_v2_explanation IS 'Human-readable explanation of POA v2 score';

-- ================================
-- 👤 USER TABLE ENHANCEMENTS
-- ================================

-- Add user statistics columns for slider normalization and reliability
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS slider_mean NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS slider_std NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS slider_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slider_m2 NUMERIC DEFAULT 0, -- For Welford's algorithm
  ADD COLUMN IF NOT EXISTS reliability_score NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS reliability_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comments for user statistics
COMMENT ON COLUMN users.slider_mean IS 'User personal slider rating average (for normalization)';
COMMENT ON COLUMN users.slider_std IS 'User personal slider rating standard deviation';
COMMENT ON COLUMN users.slider_count IS 'Total number of slider ratings by this user';
COMMENT ON COLUMN users.slider_m2 IS 'Welford algorithm M2 value for online variance calculation';
COMMENT ON COLUMN users.reliability_score IS 'User reliability score (0.5-1.5) based on consensus alignment';
COMMENT ON COLUMN users.reliability_count IS 'Number of head-to-head votes used for reliability calculation';
COMMENT ON COLUMN users.reliability_updated_at IS 'Last time reliability score was updated';

-- ================================
-- 🔍 PERFORMANCE INDEXES
-- ================================

-- Index for POA v2 leaderboard queries
CREATE INDEX IF NOT EXISTS idx_nfts_poa_v2 ON nfts(poa_v2 DESC NULLS LAST);

-- Index for POA v2 with confidence filtering
CREATE INDEX IF NOT EXISTS idx_nfts_poa_v2_confidence ON nfts(poa_v2 DESC, poa_v2_confidence DESC) 
WHERE poa_v2 IS NOT NULL AND poa_v2_confidence > 0.6;

-- Index for Bayesian Elo queries
CREATE INDEX IF NOT EXISTS idx_nfts_elo_bayesian ON nfts(elo_mean DESC, elo_sigma ASC);

-- Index for user reliability queries
CREATE INDEX IF NOT EXISTS idx_users_reliability ON users(reliability_score DESC, reliability_count DESC)
WHERE reliability_count >= 3;

-- Index for user slider statistics
CREATE INDEX IF NOT EXISTS idx_users_slider_stats ON users(slider_count DESC, slider_std ASC)
WHERE slider_count >= 2;

-- ================================
-- 🛡️ DATA CONSTRAINTS
-- ================================

-- Add constraints for data quality
ALTER TABLE nfts
  ADD CONSTRAINT IF NOT EXISTS chk_elo_mean_range 
    CHECK (elo_mean >= 0 AND elo_mean <= 3000),
  ADD CONSTRAINT IF NOT EXISTS chk_elo_sigma_range 
    CHECK (elo_sigma >= 10 AND elo_sigma <= 1000),
  ADD CONSTRAINT IF NOT EXISTS chk_poa_v2_range 
    CHECK (poa_v2 >= 0 AND poa_v2 <= 100),
  ADD CONSTRAINT IF NOT EXISTS chk_poa_v2_confidence_range 
    CHECK (poa_v2_confidence >= 0 AND poa_v2_confidence <= 100);

ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS chk_slider_mean_range 
    CHECK (slider_mean >= 0 AND slider_mean <= 100),
  ADD CONSTRAINT IF NOT EXISTS chk_slider_std_range 
    CHECK (slider_std >= 1 AND slider_std <= 50),
  ADD CONSTRAINT IF NOT EXISTS chk_reliability_range 
    CHECK (reliability_score >= 0.1 AND reliability_score <= 2.0),
  ADD CONSTRAINT IF NOT EXISTS chk_slider_count_positive 
    CHECK (slider_count >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_reliability_count_positive 
    CHECK (reliability_count >= 0);

-- ================================
-- 📈 MIGRATION DATA INITIALIZATION
-- ================================

-- Initialize elo_mean from current_elo where available
UPDATE nfts 
SET elo_mean = COALESCE(current_elo, 1200)
WHERE elo_mean IS NULL OR elo_mean = 1200;

-- Initialize elo_sigma based on vote count (more votes = lower uncertainty)
UPDATE nfts 
SET elo_sigma = CASE 
  WHEN total_votes >= 20 THEN 150  -- High confidence
  WHEN total_votes >= 10 THEN 250  -- Medium confidence  
  WHEN total_votes >= 5 THEN 300   -- Low confidence
  WHEN total_votes >= 1 THEN 350   -- Very low confidence
  ELSE 400                         -- No votes (maximum uncertainty)
END
WHERE elo_sigma = 350; -- Only update default values

-- Initialize user slider statistics with reasonable defaults
UPDATE users 
SET 
  slider_mean = 50,
  slider_std = 15,
  slider_count = 0,
  slider_m2 = 0,
  reliability_score = 1.0,
  reliability_count = 0,
  reliability_updated_at = NOW()
WHERE slider_mean IS NULL;

-- ================================
-- 🔧 HELPER FUNCTIONS
-- ================================

-- Function to get POA v2 system status
CREATE OR REPLACE FUNCTION get_poa_v2_system_status()
RETURNS TABLE (
  total_nfts BIGINT,
  nfts_with_poa_v2 BIGINT,
  avg_poa_v2 NUMERIC,
  avg_confidence NUMERIC,
  users_with_stats BIGINT,
  avg_reliability NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_nfts,
    COUNT(n.poa_v2) as nfts_with_poa_v2,
    ROUND(AVG(n.poa_v2), 2) as avg_poa_v2,
    ROUND(AVG(n.poa_v2_confidence), 2) as avg_confidence,
    (SELECT COUNT(*) FROM users WHERE slider_count > 0) as users_with_stats,
    (SELECT ROUND(AVG(reliability_score), 3) FROM users WHERE reliability_count >= 3) as avg_reliability
  FROM nfts n;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to validate POA v2 data integrity
CREATE OR REPLACE FUNCTION validate_poa_v2_data()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  count_affected BIGINT,
  details TEXT
) AS $$
BEGIN
  -- Check 1: NFTs with invalid Elo ranges
  RETURN QUERY
  SELECT 
    'Invalid Elo Mean Range'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    COUNT(*),
    'NFTs with elo_mean outside 0-3000 range'::TEXT
  FROM nfts 
  WHERE elo_mean < 0 OR elo_mean > 3000;
  
  -- Check 2: NFTs with invalid sigma ranges  
  RETURN QUERY
  SELECT 
    'Invalid Elo Sigma Range'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    COUNT(*),
    'NFTs with elo_sigma outside 10-1000 range'::TEXT
  FROM nfts 
  WHERE elo_sigma < 10 OR elo_sigma > 1000;
  
  -- Check 3: Users with invalid reliability scores
  RETURN QUERY
  SELECT 
    'Invalid Reliability Range'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    COUNT(*),
    'Users with reliability_score outside 0.1-2.0 range'::TEXT
  FROM users 
  WHERE reliability_score < 0.1 OR reliability_score > 2.0;
  
  -- Check 4: POA v2 scores outside valid range
  RETURN QUERY
  SELECT 
    'Invalid POA v2 Range'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    COUNT(*),
    'NFTs with poa_v2 outside 0-100 range'::TEXT
  FROM nfts 
  WHERE poa_v2 IS NOT NULL AND (poa_v2 < 0 OR poa_v2 > 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================
-- 📊 MIGRATION SUMMARY
-- ================================

DO $$
DECLARE
  nft_count BIGINT;
  user_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO nft_count FROM nfts;
  SELECT COUNT(*) INTO user_count FROM users;
  
  RAISE NOTICE '🚀 POA v2 Schema Migration Complete!';
  RAISE NOTICE '📊 Updated % NFTs with Bayesian Elo columns', nft_count;
  RAISE NOTICE '👤 Updated % users with statistics columns', user_count;
  RAISE NOTICE '🔍 Created performance indexes for POA v2 queries';
  RAISE NOTICE '🛡️ Added data quality constraints';
  RAISE NOTICE '🔧 Created helper functions for monitoring';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ready for Phase A2: Vote Ingestion Pipeline';
  RAISE NOTICE '   Next: Implement Bayesian Elo updates and user statistics';
END $$;

