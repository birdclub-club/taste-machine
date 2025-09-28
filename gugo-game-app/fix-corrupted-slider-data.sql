-- Fix corrupted slider data for 46 NFTs
-- This resets slider_average to NULL and slider_count to 0 for NFTs that had all their slider votes deleted
-- After running this, recalculate POA v2 scores for these NFTs

UPDATE nfts 
SET slider_average = NULL, slider_count = 0 
WHERE id IN (
  'faa3da8d-32f8-4966-bf1c-795a2b1ab2e4', -- BEARISH #2660
  '15663c28-c1c5-4d9c-9437-583b96dbe475', -- BEARISH #2839
  'f9b56ba4-f5cc-4c77-95d3-08f501e2a705', -- BEARISH #2629
  'ffb707d7-6865-4bf1-86cc-c383f8c91fc8', -- BEARISH #3722
  'fecfe651-da9c-48d7-9a66-ad281708953e', -- BEARISH #4062
  'ffabe143-a378-42d3-bf6a-27d6fa2b0195', -- Purple Haze #924
  'ffe4ea0c-a2ce-47ac-b668-c57e9cc8606c', -- Kabu #4376
  'ff76843d-4558-4e3f-a311-7ece5e94dd13', -- Purple Haze #2036
  'ffb0ca5f-d841-49d9-bc1c-73ee12986738', -- Weed Green #2908
  'ffd79553-0240-4da1-852c-b35216ff00d4', -- Pengztracted #7323
  'ffc47f44-1bf8-42cb-b012-debba41ccaf3', -- Pengztracted #4250
  'ffea7641-af25-47c6-9b29-5f617c6135ed', -- Purple Haze #5144
  'fe6eed18-49b0-4edc-8023-fc0deab4d512', -- Purple Haze #5602
  'ffe39fed-9047-4abc-8c7e-e82a27a74942', -- Acapulco Gold #2028
  'fd21f2b8-76d7-4b27-bf13-e1abe42a2162', -- Kabu #322
  'ffbcc7be-5c36-44a5-8b0b-1217859a13c1', -- Pengztracted #3747
  'ff94eb4b-ba8b-44aa-ae96-5c1719c67748', -- Kabu #867
  'feda87e5-6bed-4119-9512-392202a82489', -- BEARISH #1367
  'ffbee5b4-90b7-4db6-88bc-a88fd00239ee', -- BEEISH # 3442
  'fe83100b-a52e-4427-bca5-ba535b500cd2', -- Kabu #3888
  'ff1e54b8-d597-43fc-81b8-079bf9148c0e', -- Acapulco Gold #1815
  'fedf8ab2-4084-43c1-962b-d4a331056a7e', -- Purple Haze #4457
  'fe495653-19e9-40e7-b1ea-59fc7b62f69f', -- BOSU #1989
  'fd40dcca-fe30-49fb-a055-fab63fa152ef', -- Weed Green #4259
  'fe5e8203-b0f4-4441-aeae-360331843071', -- Kabu #2458
  'ffa27f6a-c1d0-4f52-96a3-a59afe257657', -- BEEISH #1722
  'ffe34d21-7490-4e51-9ce4-6dd6f7f4874a', -- Weed Green #5990
  'ffbf6a8b-cbbe-404f-930e-19864d691c47', -- Weed Green #4409
  'fe89ea69-69c4-4909-93a4-78127bb5a275', -- BEEISH # 2020
  'ffacfc6e-8250-4c89-97f9-a15e7240ae03', -- Weed Green #2917
  'ffe37df2-d638-4d24-b408-0c342ea940c7', -- Pengztracted #5275
  'ffb48d3d-6250-4d61-94a5-7546f4296d5a', -- Weed Green #2211
  'fdc6d7a5-4d06-4c51-90ae-c88a0195be0b', -- BEEISH # 3656
  'ff1676e1-7a07-40cb-b829-40234a975c60', -- Kabu #1353
  'ffd65254-6ae1-4ad6-a76f-aa537a3d325b', -- Kabu #653
  'ff52c29d-85ef-4fcc-aac9-68a90b8c70e4', -- BOSU #1410
  'ffed8ef5-7a20-4e6c-bf88-ed3780c4a74c', -- BOSU #3533
  'ff679438-937c-4c64-9d7a-52be2d59d7b8', -- Weed Green #1173
  'ff376ad7-86bf-476d-ad50-f1f496b8be13', -- Kabu #3065
  'ff9d1fd4-d7fb-42b2-84e3-674ce3dc2551', -- Pengztracted #6982
  'ff99f50b-9bc5-46cd-80cf-3b4a148eead7', -- Kabu #718
  'ffba0bfe-cf63-48a6-986d-1c3f03c5404f', -- Kabu #4381
  'ff954b01-8030-456f-8dd4-16df33225c4d', -- BEEISH # 4115
  'ffc0f657-be79-483a-97b3-e91c7d80f450', -- BEARISH #1972
  'fffdf61d-5517-438c-84ec-0151f61f55f1', -- Weed Green #971
  'ff584d01-d4a9-4fb6-bbf6-35d21f72630a'  -- BEEISH # 1666
);

-- Verify the update
SELECT COUNT(*) as updated_count 
FROM nfts 
WHERE id IN (
  'faa3da8d-32f8-4966-bf1c-795a2b1ab2e4', '15663c28-c1c5-4d9c-9437-583b96dbe475', 'f9b56ba4-f5cc-4c77-95d3-08f501e2a705',
  'ffb707d7-6865-4bf1-86cc-c383f8c91fc8', 'fecfe651-da9c-48d7-9a66-ad281708953e', 'ffabe143-a378-42d3-bf6a-27d6fa2b0195',
  'ffe4ea0c-a2ce-47ac-b668-c57e9cc8606c', 'ff76843d-4558-4e3f-a311-7ece5e94dd13', 'ffb0ca5f-d841-49d9-bc1c-73ee12986738',
  'ffd79553-0240-4da1-852c-b35216ff00d4', 'ffc47f44-1bf8-42cb-b012-debba41ccaf3', 'ffea7641-af25-47c6-9b29-5f617c6135ed',
  'fe6eed18-49b0-4edc-8023-fc0deab4d512', 'ffe39fed-9047-4abc-8c7e-e82a27a74942', 'fd21f2b8-76d7-4b27-bf13-e1abe42a2162',
  'ffbcc7be-5c36-44a5-8b0b-1217859a13c1', 'ff94eb4b-ba8b-44aa-ae96-5c1719c67748', 'feda87e5-6bed-4119-9512-392202a82489',
  'ffbee5b4-90b7-4db6-88bc-a88fd00239ee', 'fe83100b-a52e-4427-bca5-ba535b500cd2', 'ff1e54b8-d597-43fc-81b8-079bf9148c0e',
  'fedf8ab2-4084-43c1-962b-d4a331056a7e', 'fe495653-19e9-40e7-b1ea-59fc7b62f69f', 'fd40dcca-fe30-49fb-a055-fab63fa152ef',
  'fe5e8203-b0f4-4441-aeae-360331843071', 'ffa27f6a-c1d0-4f52-96a3-a59afe257657', 'ffe34d21-7490-4e51-9ce4-6dd6f7f4874a',
  'ffbf6a8b-cbbe-404f-930e-19864d691c47', 'fe89ea69-69c4-4909-93a4-78127bb5a275', 'ffacfc6e-8250-4c89-97f9-a15e7240ae03',
  'ffe37df2-d638-4d24-b408-0c342ea940c7', 'ffb48d3d-6250-4d61-94a5-7546f4296d5a', 'fdc6d7a5-4d06-4c51-90ae-c88a0195be0b',
  'ff1676e1-7a07-40cb-b829-40234a975c60', 'ffd65254-6ae1-4ad6-a76f-aa537a3d325b', 'ff52c29d-85ef-4fcc-aac9-68a90b8c70e4',
  'ffed8ef5-7a20-4e6c-bf88-ed3780c4a74c', 'ff679438-937c-4c64-9d7a-52be2d59d7b8', 'ff376ad7-86bf-476d-ad50-f1f496b8be13',
  'ff9d1fd4-d7fb-42b2-84e3-674ce3dc2551', 'ff99f50b-9bc5-46cd-80cf-3b4a148eead7', 'ffba0bfe-cf63-48a6-986d-1c3f03c5404f',
  'ff954b01-8030-456f-8dd4-16df33225c4d', 'ffc0f657-be79-483a-97b3-e91c7d80f450', 'fffdf61d-5517-438c-84ec-0151f61f55f1',
  'ff584d01-d4a9-4fb6-bbf6-35d21f72630a'
) 
AND slider_average IS NULL 
AND slider_count = 0;

