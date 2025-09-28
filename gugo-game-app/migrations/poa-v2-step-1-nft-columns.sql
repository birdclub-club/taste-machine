-- 🚀 POA v2 Migration - Step 1: Add NFT Columns
-- Run this first to add POA v2 columns to the nfts table

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

