-- Migration to add collection_address to existing favorites table
-- This is a safe incremental migration that checks for existing objects

-- Add collection_address column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'favorites' 
        AND column_name = 'collection_address'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.favorites ADD COLUMN collection_address TEXT;
        RAISE NOTICE 'Added collection_address column to favorites table';
    ELSE
        RAISE NOTICE 'collection_address column already exists';
    END IF;
END $$;

-- Update the add_to_favorites function to include collection_address
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
        collection_address = EXCLUDED.collection_address,
        created_at = NOW()
    RETURNING id INTO favorite_id;
    
    RETURN favorite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_user_favorites function to return collection_address
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

-- Notification
DO $$ 
BEGIN
    RAISE NOTICE 'Migration completed: collection_address support added to favorites system';
END $$;