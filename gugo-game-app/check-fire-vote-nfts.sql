-- Check which NFTs have received FIRE votes
SELECT 
  'FIRE_VOTE_DETAILS' as query_type,
  n.name,
  n.collection_name,
  f.nft_id,
  f.vote_type,
  f.wallet_address,
  f.created_at
FROM public.favorites f
JOIN public.nfts n ON n.id::text = f.nft_id
WHERE f.vote_type = 'fire'
ORDER BY f.created_at DESC;
