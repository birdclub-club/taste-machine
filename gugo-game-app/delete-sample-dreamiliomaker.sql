-- Delete sample DreamilioMaker data before importing real collection
DELETE FROM nfts 
WHERE collection_name = 'DreamilioMaker' 
  AND contract_address = '0x30072084ff8724098cbb65e07f7639ed31af5f66';
