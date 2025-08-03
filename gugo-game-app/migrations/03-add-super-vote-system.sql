-- Migration: Add Super Vote System
-- Adds vote balance tracking for super vote functionality
-- Super votes cost 5 regular votes and apply 2x Elo effect

-- Add available_votes column to users table for vote balance tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS available_votes INTEGER DEFAULT 100; -- Start users with 100 votes for testing

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_available_votes ON users(available_votes);

-- Update existing users to have starting vote balance
UPDATE users 
SET available_votes = 100 
WHERE available_votes IS NULL;

-- Add constraint to prevent negative vote balances
ALTER TABLE users 
ADD CONSTRAINT check_available_votes_non_negative 
CHECK (available_votes >= 0);

-- Create function to add votes to user balance (for future vote purchasing)
CREATE OR REPLACE FUNCTION add_user_votes(
  user_wallet_address TEXT,
  votes_to_add INTEGER
) RETURNS VOID AS $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Find user ID by wallet address
  SELECT id INTO user_uuid 
  FROM users 
  WHERE wallet_address = user_wallet_address;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not found with wallet address: %', user_wallet_address;
  END IF;
  
  -- Add votes to user balance
  UPDATE users 
  SET available_votes = COALESCE(available_votes, 0) + votes_to_add,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RAISE LOG 'Added % votes to user % (wallet: %)', votes_to_add, user_uuid, user_wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Create function to check user vote balance
CREATE OR REPLACE FUNCTION get_user_vote_balance(
  user_wallet_address TEXT
) RETURNS INTEGER AS $$
DECLARE
  vote_balance INTEGER;
BEGIN
  SELECT COALESCE(available_votes, 0) INTO vote_balance
  FROM users 
  WHERE wallet_address = user_wallet_address;
  
  RETURN COALESCE(vote_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Add some sample votes for testing (optional - remove in production)
-- This gives the first few users some votes to test super vote functionality
UPDATE users 
SET available_votes = 50 
WHERE id IN (
  SELECT id 
  FROM users 
  WHERE created_at < NOW() 
  ORDER BY created_at 
  LIMIT 10
);

COMMIT;

-- Instructions:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Users will start with 100 available votes
-- 3. Super votes cost 5 votes each and apply 2x Elo effect
-- 4. Use add_user_votes() function to add votes when users purchase them
-- 5. Use get_user_vote_balance() to check user vote balance