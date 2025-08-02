-- NFT Collection Tables for "Taste Machine" Game
-- Run this in your Supabase SQL Editor

-- Create NFTs table
CREATE TABLE IF NOT EXISTS public.nfts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT NOT NULL,
  collection_name TEXT DEFAULT 'Bearish',
  contract_address TEXT,
  traits JSONB,
  looks_score INTEGER DEFAULT 1000, -- Elo-style rating starting at 1000
  total_votes INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(token_id, contract_address)
);

-- Create matchups table
CREATE TABLE IF NOT EXISTS public.matchups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nft1_id UUID REFERENCES public.nfts(id) ON DELETE CASCADE,
  nft2_id UUID REFERENCES public.nfts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  winner_id UUID REFERENCES public.nfts(id),
  total_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CHECK (nft1_id != nft2_id)
);

-- Create votes table
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  matchup_id UUID REFERENCES public.matchups(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES public.nfts(id) ON DELETE CASCADE,
  vote_type TEXT DEFAULT 'regular' CHECK (vote_type IN ('regular', 'super')),
  xp_earned INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, matchup_id) -- One vote per user per matchup
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_nfts_looks_score ON public.nfts(looks_score DESC);
CREATE INDEX IF NOT EXISTS idx_nfts_collection ON public.nfts(collection_name);
CREATE INDEX IF NOT EXISTS idx_matchups_status ON public.matchups(status);
CREATE INDEX IF NOT EXISTS idx_matchups_created ON public.matchups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_matchup ON public.votes(matchup_id);

-- Create updated_at trigger for nfts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_nfts_updated_at 
    BEFORE UPDATE ON public.nfts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- NFTs are public (everyone can read)
CREATE POLICY "NFTs are publicly readable" ON public.nfts
    FOR SELECT USING (true);

-- Matchups are public (everyone can read)
CREATE POLICY "Matchups are publicly readable" ON public.matchups
    FOR SELECT USING (true);

-- Users can only read their own votes
CREATE POLICY "Users can read their own votes" ON public.votes
    FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

-- Users can insert their own votes
CREATE POLICY "Users can insert their own votes" ON public.votes
    FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.nfts TO anon, authenticated;
GRANT SELECT ON public.matchups TO anon, authenticated;
GRANT ALL ON public.votes TO authenticated;
GRANT ALL ON public.nfts TO authenticated; -- For admin operations
GRANT ALL ON public.matchups TO authenticated; -- For admin operations