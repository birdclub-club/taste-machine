-- 🚀 POA v2 Migration - Step 6: Create Helper Functions
-- Run this sixth to create monitoring and validation functions

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

