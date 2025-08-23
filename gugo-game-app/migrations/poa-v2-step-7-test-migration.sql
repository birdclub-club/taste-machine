-- 🚀 POA v2 Migration - Step 7: Test and Validate Migration
-- Run this last to verify everything worked correctly

-- Test 1: Check system status
SELECT 'System Status Check' as test_name;
SELECT * FROM get_poa_v2_system_status();

-- Test 2: Validate data integrity
SELECT 'Data Validation Check' as test_name;
SELECT * FROM validate_poa_v2_data();

-- Test 3: Sample NFT data with new columns
SELECT 'Sample NFT Data' as test_name;
SELECT 
  id, 
  name, 
  collection_name,
  current_elo,
  elo_mean,
  elo_sigma,
  total_votes,
  poa_v2,
  poa_v2_confidence
FROM nfts 
WHERE elo_mean IS NOT NULL 
ORDER BY elo_mean DESC 
LIMIT 10;

-- Test 4: Sample user data with new columns
SELECT 'Sample User Data' as test_name;
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

-- Test 5: Check indexes were created
SELECT 'Index Check' as test_name;
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_%poa%' OR indexname LIKE 'idx_%elo%' OR indexname LIKE 'idx_%reliability%' OR indexname LIKE 'idx_%slider%'
ORDER BY tablename, indexname;

-- Test 6: Check constraints were added
SELECT 'Constraint Check' as test_name;
SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname LIKE 'chk_%'
ORDER BY conrelid::regclass, conname;

-- Expected Results Summary:
/*
✅ System Status should show:
   - total_nfts: Your NFT count
   - nfts_with_poa_v2: 0 (will be populated in Phase A2)
   - avg_poa_v2: NULL
   - users_with_stats: Your user count
   - avg_reliability: 1.0

✅ Data Validation should show:
   - All checks with 'PASS' status
   - count_affected: 0 for all

✅ Sample NFT Data should show:
   - elo_mean initialized from current_elo
   - elo_sigma varying by vote count (150-400)
   - poa_v2: NULL (computed in Phase A2)

✅ Sample User Data should show:
   - All users with default values initialized

✅ Indexes should show 5 new indexes created

✅ Constraints should show 9 new check constraints
*/

