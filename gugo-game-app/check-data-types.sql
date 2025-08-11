-- Check data types for nft_id columns
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('nfts', 'favorites') 
  AND column_name IN ('id', 'nft_id')
ORDER BY table_name, column_name;

-- Check a sample of data to see what's actually stored
SELECT 'SAMPLE_NFTS' as query_type, id, name, collection_name 
FROM public.nfts 
WHERE collection_name = 'Fugz' 
LIMIT 3;

SELECT 'SAMPLE_FAVORITES' as query_type, nft_id, vote_type, wallet_address 
FROM public.favorites 
WHERE vote_type = 'fire' 
LIMIT 3;
