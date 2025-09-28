-- Fix the status function to properly detect FIRE votes

DROP FUNCTION IF EXISTS public.dynamic_poa_system_status_lightweight() CASCADE;

CREATE OR REPLACE FUNCTION public.dynamic_poa_system_status_lightweight()
RETURNS TABLE(
  current_mode TEXT,
  status TEXT,
  ecosystem_stats JSON
) AS $$
DECLARE
  meaningful_nfts_count INTEGER;
  total_fire_votes INTEGER;
  high_confidence_nfts INTEGER;
  current_system_mode TEXT;
  status_message TEXT;
BEGIN
  -- Count meaningful NFTs (those with any voting activity)
  SELECT COUNT(*)
  INTO meaningful_nfts_count
  FROM public.nfts n
  WHERE n.current_elo IS NOT NULL 
    AND (n.total_votes >= 1 OR n.slider_count >= 1);

  -- Count total FIRE votes
  SELECT COUNT(*)
  INTO total_fire_votes
  FROM public.favorites
  WHERE vote_type = 'fire';

  -- Count high confidence NFTs (10+ votes OR 5+ slider ratings)
  SELECT COUNT(*)
  INTO high_confidence_nfts
  FROM public.nfts n
  WHERE n.current_elo IS NOT NULL 
    AND (n.total_votes >= 10 OR n.slider_count >= 5);

  -- Always use BOOTSTRAP mode (for now)
  current_system_mode := 'BOOTSTRAP';
  status_message := 'Lightweight system active - no materialized view';

  RETURN QUERY
  SELECT 
    current_system_mode,
    status_message,
    json_build_object(
      'meaningful_nfts', meaningful_nfts_count,
      'total_fire_votes', total_fire_votes,
      'high_confidence_nfts', high_confidence_nfts
    ) as ecosystem_stats;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test the fixed status function
SELECT 
  'Status Function Test' as test_type,
  current_mode,
  status,
  ecosystem_stats
FROM public.dynamic_poa_system_status_lightweight();
