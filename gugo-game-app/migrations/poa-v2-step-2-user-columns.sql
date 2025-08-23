-- 🚀 POA v2 Migration - Step 2: Add User Columns
-- Run this second to add user statistics columns to the users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS slider_mean NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS slider_std NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS slider_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slider_m2 NUMERIC DEFAULT 0,
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

