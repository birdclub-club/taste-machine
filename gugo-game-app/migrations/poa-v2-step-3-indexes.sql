-- 🚀 POA v2 Migration - Step 3: Create Performance Indexes
-- Run this third to create indexes for optimal POA v2 query performance

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

