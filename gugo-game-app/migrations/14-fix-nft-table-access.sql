-- 🔧 SPECIFIC FIX FOR NFT TABLE ACCESS ISSUES
-- Some tables may have retained RLS or permission issues after migration 13

-- Double-check RLS is disabled on all tables
ALTER TABLE public.nfts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchup_queue DISABLE ROW LEVEL SECURITY;

-- Grant explicit permissions on NFTs table specifically
GRANT ALL PRIVILEGES ON TABLE public.nfts TO anon;
GRANT ALL PRIVILEGES ON TABLE public.nfts TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.nfts TO postgres;

-- Grant permissions on the NFTs sequence if it exists
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert a test NFT to verify write access works
INSERT INTO public.nfts (
    token_id, 
    name, 
    description, 
    image, 
    collection_name, 
    contract_address
) VALUES (
    'test-1',
    'Test Bear #1',
    'A test NFT to verify database access',
    'https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR-M9He2PjILP0oOvxE89AyiPPGtrR3gysu1Zu5BqVYdgx7jvj8f7h6P5kEqL_2zVhKQ3Q?auto=format&w=384',
    'Bearish',
    '0xa6c46c07f7f1966d772e29049175ebba26262513'
) ON CONFLICT (token_id, contract_address) DO NOTHING;

-- Insert additional test NFTs for voting
INSERT INTO public.nfts (
    token_id, 
    name, 
    description, 
    image, 
    collection_name, 
    contract_address
) VALUES 
(
    'test-2',
    'Test Bear #2',
    'Another test NFT for voting',
    'https://i.seadn.io/gae/P8zlH4jKjvLK51cYn7k1uMCyEfKhB8KTgk9bqZI5Uv6uLhU5Zo6Aq1OOVbQf-J8zDnuKhNfF7I3DfhZ8FqE9zDxDQ?auto=format&w=384',
    'Bearish',
    '0xa6c46c07f7f1966d772e29049175ebba26262513'
),
(
    'test-3',
    'Test Bear #3',
    'Third test NFT for voting',
    'https://i.seadn.io/gae/H4jKB7hLJVhN9mA8mhQ9H1ZL2FNCE2XdF6bQ5DxQFxdm5WzjgWxW8aP5Q2tLkU1F1dE8VhZQ6nK1rW5pHfQ7?auto=format&w=384',
    'Bearish',
    '0xa6c46c07f7f1966d772e29049175ebba26262513'
),
(
    'test-4',
    'Test Bear #4',
    'Fourth test NFT for voting',
    'https://i.seadn.io/gae/Y7kM2cX8QX5rHfY1vW2zKgU6tM9H8J4bP8uLx3NmJ6K8zKrR1mLpWx6Q1tN5hFvV8KhQ2yZ7mU2lP9kHbFjE?auto=format&w=384',
    'Bearish',
    '0xa6c46c07f7f1966d772e29049175ebba26262513'
),
(
    'test-5',
    'Test Bear #5',
    'Fifth test NFT for voting',
    'https://i.seadn.io/gae/R9oM1bU7VU4eFdR2uP1zJgQ5rL8G7H3aN7qKw2MhI5I7wIdN0mKpTt5P1qL4eErT7GfK1xW6lR2nK8dIaNfC?auto=format&w=384',
    'Bearish',
    '0xa6c46c07f7f1966d772e29049175ebba26262513'
),
(
    'test-6',
    'Test Bear #6',
    'Sixth test NFT for voting',
    'https://i.seadn.io/gae/S0pN2cY8RY6sIgY2wX3zLhV7uN0I9K5cQ9vMy4OnL7L9yLsO1nMqUv7R2uO5jGwW9LiR3zY8nV3mQ0lIcOkG?auto=format&w=384',
    'Bearish',
    '0xa6c46c07f7f1966d772e29049175ebba26262513'
)
ON CONFLICT (token_id, contract_address) DO NOTHING;

-- Verify the insert worked
DO $$
DECLARE
    nft_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO nft_count FROM public.nfts;
    RAISE NOTICE 'NFT table now contains % records', nft_count;
END $$;