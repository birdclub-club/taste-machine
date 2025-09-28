-- 🚀 POA v2 Migration - Step 5: Initialize Existing Data
-- Run this fifth to populate the new columns with sensible default values

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

