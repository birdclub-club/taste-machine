-- Add Favorites System for Wallets
-- Tracks NFTs that users give FIRE votes or max slider votes to

-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    nft_id TEXT NOT NULL,
    token_id TEXT,
    collection_name TEXT,
    image_url TEXT,
    collection_address TEXT,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('fire', 'slider_max')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique favorites per wallet/nft combination
    UNIQUE(wallet_address, nft_id),
    
    -- Foreign key to users table
    CONSTRAINT fk_favorites_wallet 
        FOREIGN KEY (wallet_address) 
        REFERENCES public.users(wallet_address) 
        ON DELETE CASCADE,
        
    -- Validate wallet address format
    CONSTRAINT valid_wallet_address 
        CHECK (length(wallet_address) = 42 AND wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Enable RLS on favorites table
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for favorites
-- Users can only see their own favorites
CREATE POLICY "Users can view own favorites" ON public.favorites
    FOR SELECT USING (wallet_address = current_setting('request.jwt.claim.wallet_address', true));

-- Users can insert their own favorites
CREATE POLICY "Users can insert own favorites" ON public.favorites
    FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claim.wallet_address', true));

-- Users can delete their own favorites
CREATE POLICY "Users can delete own favorites" ON public.favorites
    FOR DELETE USING (wallet_address = current_setting('request.jwt.claim.wallet_address', true));

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_favorites_wallet_address ON public.favorites(wallet_address);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON public.favorites(created_at DESC);

-- Create function to add favorite (upsert)
CREATE OR REPLACE FUNCTION add_to_favorites(
    p_wallet_address TEXT,
    p_nft_id TEXT,
    p_token_id TEXT DEFAULT NULL,
    p_collection_name TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_collection_address TEXT DEFAULT NULL,
    p_vote_type TEXT DEFAULT 'fire'
)
RETURNS UUID AS $$
DECLARE
    favorite_id UUID;
BEGIN
    INSERT INTO public.favorites (
        wallet_address,
        nft_id,
        token_id,
        collection_name,
        image_url,
        collection_address,
        vote_type
    ) VALUES (
        p_wallet_address,
        p_nft_id,
        p_token_id,
        p_collection_name,
        p_image_url,
        p_collection_address,
        p_vote_type
    )
    ON CONFLICT (wallet_address, nft_id) 
    DO UPDATE SET
        vote_type = EXCLUDED.vote_type,
        created_at = NOW()
    RETURNING id INTO favorite_id;
    
    RETURN favorite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user favorites
CREATE OR REPLACE FUNCTION get_user_favorites(p_wallet_address TEXT)
RETURNS TABLE (
    id UUID,
    nft_id TEXT,
    token_id TEXT,
    collection_name TEXT,
    image_url TEXT,
    collection_address TEXT,
    vote_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.nft_id,
        f.token_id,
        f.collection_name,
        f.image_url,
        f.collection_address,
        f.vote_type,
        f.created_at
    FROM public.favorites f
    WHERE f.wallet_address = p_wallet_address
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove favorite
CREATE OR REPLACE FUNCTION remove_from_favorites(
    p_wallet_address TEXT,
    p_nft_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.favorites 
    WHERE wallet_address = p_wallet_address 
    AND nft_id = p_nft_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;