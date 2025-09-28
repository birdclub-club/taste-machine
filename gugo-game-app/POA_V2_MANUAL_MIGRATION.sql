-- 🚀 POA v2 Manual Migration - Phase A1
-- Run these SQL statements in your Supabase SQL editor
-- Copy and paste each section one at a time

-- ================================
-- 📊 STEP 1: ADD NFT COLUMNS
-- ================================

ALTER TABLE nfts
  ADD COLUMN IF NOT EXISTS elo_mean NUMERIC DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS elo_sigma NUMERIC DEFAULT 350,
  ADD COLUMN IF NOT EXISTS poa_v2 NUMERIC,
  ADD COLUMN IF NOT EXISTS poa_v2_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poa_v2_components JSONB,
  ADD COLUMN IF NOT EXISTS poa_v2_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS poa_v2_explanation TEXT;

-- ================================
-- 👤 STEP 2: ADD USER COLUMNS
-- ================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS slider_mean NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS slider_std NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS slider_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slider_m2 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_score NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS reliability_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_updated_at TIMESTAMPTZ DEFAULT NOW();

-- ================================
-- 🔍 STEP 3: CREATE INDEXES
-- ================================

CREATE INDEX IF NOT EXISTS idx_nfts_poa_v2 ON nfts(poa_v2 DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_nfts_poa_v2_confidence ON nfts(poa_v2 DESC, poa_v2_confidence DESC) 
WHERE poa_v2 IS NOT NULL AND poa_v2_confidence > 0.6;

CREATE INDEX IF NOT EXISTS idx_nfts_elo_bayesian ON nfts(elo_mean DESC, elo_sigma ASC);

CREATE INDEX IF NOT EXISTS idx_users_reliability ON users(reliability_score DESC, reliability_count DESC)
WHERE reliability_count >= 3;

CREATE INDEX IF NOT EXISTS idx_users_slider_stats ON users(slider_count DESC, slider_std ASC)
WHERE slider_count >= 2;

-- ================================
-- 🛡️ STEP 4: ADD CONSTRAINTS
-- ================================

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
-- 🔄 STEP 5: INITIALIZE DATA
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
-- 🔧 STEP 6: CREATE HELPER FUNCTIONS
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
-- 🧪 STEP 7: TEST THE MIGRATION
-- ================================

-- Test 1: Check system status
SELECT * FROM get_poa_v2_system_status();

-- Test 2: Validate data integrity
SELECT * FROM validate_poa_v2_data();

-- Test 3: Sample NFT data
SELECT 
  id, 
  name, 
  collection_name,
  current_elo,
  elo_mean,
  elo_sigma,
  total_votes,
  poa_v2
FROM nfts 
WHERE elo_mean IS NOT NULL 
ORDER BY elo_mean DESC 
LIMIT 10;

-- Test 4: Sample user data
SELECT 
  id,
  wallet_address,
  slider_mean,
  slider_std,
  slider_count,
  reliability_score,
  reliability_count
FROM users 
WHERE slider_mean IS NOT NULL
LIMIT 10;

-- ================================
-- 📊 EXPECTED RESULTS
-- ================================

/*
After running all steps, you should see:

1. System Status:
   - total_nfts: Your total NFT count
   - nfts_with_poa_v2: 0 (will be populated in Phase A2)
   - avg_poa_v2: NULL (will be computed in Phase A2)
   - users_with_stats: Your user count
   - avg_reliability: 1.0 (default value)

2. Data Validation:
   - All checks should show 'PASS' status
   - count_affected should be 0 for all checks

3. Sample NFT Data:
   - elo_mean should be initialized from current_elo
   - elo_sigma should vary based on total_votes (150-400)
   - poa_v2 should be NULL (computed in Phase A2)

4. Sample User Data:
   - slider_mean: 50 (default)
   - slider_std: 15 (default)
   - slider_count: 0 (default)
   - reliability_score: 1.0 (default)
   - reliability_count: 0 (default)
*/

