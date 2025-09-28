-- 🚀 POA v2 Migration - Step 4: Add Data Quality Constraints
-- Run this fourth to add constraints that ensure data integrity

-- NFT table constraints (using DO block to handle "IF NOT EXISTS" logic)
DO $$
BEGIN
  -- Add elo_mean range constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_elo_mean_range') THEN
    ALTER TABLE nfts ADD CONSTRAINT chk_elo_mean_range 
      CHECK (elo_mean >= 0 AND elo_mean <= 3000);
  END IF;
  
  -- Add elo_sigma range constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_elo_sigma_range') THEN
    ALTER TABLE nfts ADD CONSTRAINT chk_elo_sigma_range 
      CHECK (elo_sigma >= 10 AND elo_sigma <= 1000);
  END IF;
  
  -- Add poa_v2 range constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_poa_v2_range') THEN
    ALTER TABLE nfts ADD CONSTRAINT chk_poa_v2_range 
      CHECK (poa_v2 >= 0 AND poa_v2 <= 100);
  END IF;
  
  -- Add poa_v2_confidence range constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_poa_v2_confidence_range') THEN
    ALTER TABLE nfts ADD CONSTRAINT chk_poa_v2_confidence_range 
      CHECK (poa_v2_confidence >= 0 AND poa_v2_confidence <= 100);
  END IF;
END $$;

-- User table constraints (using DO block to handle "IF NOT EXISTS" logic)
DO $$
BEGIN
  -- Add slider_mean range constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_slider_mean_range') THEN
    ALTER TABLE users ADD CONSTRAINT chk_slider_mean_range 
      CHECK (slider_mean >= 0 AND slider_mean <= 100);
  END IF;
  
  -- Add slider_std range constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_slider_std_range') THEN
    ALTER TABLE users ADD CONSTRAINT chk_slider_std_range 
      CHECK (slider_std >= 1 AND slider_std <= 50);
  END IF;
  
  -- Add reliability range constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reliability_range') THEN
    ALTER TABLE users ADD CONSTRAINT chk_reliability_range 
      CHECK (reliability_score >= 0.1 AND reliability_score <= 2.0);
  END IF;
  
  -- Add slider_count positive constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_slider_count_positive') THEN
    ALTER TABLE users ADD CONSTRAINT chk_slider_count_positive 
      CHECK (slider_count >= 0);
  END IF;
  
  -- Add reliability_count positive constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reliability_count_positive') THEN
    ALTER TABLE users ADD CONSTRAINT chk_reliability_count_positive 
      CHECK (reliability_count >= 0);
  END IF;
END $$;
