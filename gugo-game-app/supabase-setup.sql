-- Supabase Database Setup for "Taste Machine" Game
-- Run this SQL in your Supabase SQL Editor

-- Enable Row Level Security
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Game stats
    xp INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    last_free_vote_claim TIMESTAMP WITH TIME ZONE,
    
    -- User preferences
    username TEXT,
    avatar_url TEXT,
    
    -- Wallet info
    wallet_type TEXT DEFAULT 'agw', -- 'agw' or 'metamask'
    
    CONSTRAINT valid_wallet_address CHECK (length(wallet_address) = 42 AND wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create set_config function for RLS
CREATE OR REPLACE FUNCTION set_config(setting_name TEXT, setting_value TEXT, is_local BOOLEAN DEFAULT FALSE)
RETURNS TEXT AS $$
BEGIN
    PERFORM set_config(setting_name, setting_value, is_local);
    RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (wallet_address = current_setting('app.current_wallet_address', TRUE));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (wallet_address = current_setting('app.current_wallet_address', TRUE));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (wallet_address = current_setting('app.current_wallet_address', TRUE));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON public.users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- Grant permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon; 