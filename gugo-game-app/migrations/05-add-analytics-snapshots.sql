-- Analytics Snapshots Table for Historical Data Tracking
-- Run this in your Supabase SQL Editor

-- Create analytics snapshots table for historical tracking
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- User metrics
  total_users INTEGER DEFAULT 0,
  daily_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  
  -- Vote metrics  
  total_votes INTEGER DEFAULT 0,
  daily_votes INTEGER DEFAULT 0,
  
  -- Collection metrics
  total_collections INTEGER DEFAULT 0,
  active_collections INTEGER DEFAULT 0,
  total_nfts INTEGER DEFAULT 0,
  
  -- Growth and engagement metrics
  avg_votes_per_nft DECIMAL(10,2) DEFAULT 0,
  collection_engagement DECIMAL(5,4) DEFAULT 0, -- Percentage as decimal (0.0 to 1.0)
  new_collections INTEGER DEFAULT 0,
  collections_with_votes INTEGER DEFAULT 0,
  
  -- Additional metrics (for future expansion)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON public.analytics_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_created_at ON public.analytics_snapshots(created_at DESC);

-- Function to automatically create daily snapshots
CREATE OR REPLACE FUNCTION public.create_daily_analytics_snapshot()
RETURNS VOID AS $$
DECLARE
  today_date DATE;
  user_stats RECORD;
  vote_stats RECORD;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Check if snapshot already exists for today
  IF EXISTS (SELECT 1 FROM public.analytics_snapshots WHERE date = today_date) THEN
    -- Update existing snapshot
    UPDATE public.analytics_snapshots 
    SET 
      total_users = (SELECT COUNT(*) FROM public.users),
      daily_users = (
        SELECT COUNT(DISTINCT COALESCE(u.id, v.user_id))
        FROM public.users u
        FULL OUTER JOIN public.votes v ON u.id = v.user_id
        WHERE u.created_at >= today_date 
           OR v.created_at >= today_date
      ),
      active_users = (
        SELECT COUNT(DISTINCT user_id) 
        FROM public.votes 
        WHERE created_at >= today_date
      ),
      new_users = (
        SELECT COUNT(*) 
        FROM public.users 
        WHERE created_at >= today_date
      ),
      daily_votes = (
        SELECT COUNT(*) 
        FROM public.votes 
        WHERE created_at >= today_date
      ),
      created_at = NOW()
    WHERE date = today_date;
  ELSE
    -- Insert new snapshot
    INSERT INTO public.analytics_snapshots (
      date,
      total_users,
      daily_users,
      active_users,
      new_users,
      daily_votes,
      total_collections,
      active_collections,
      total_nfts,
      avg_votes_per_nft,
      collection_engagement,
      collections_with_votes
    )
    SELECT 
      today_date,
      (SELECT COUNT(*) FROM public.users),
      (
        SELECT COUNT(DISTINCT COALESCE(u.id, v.user_id))
        FROM public.users u
        FULL OUTER JOIN public.votes v ON u.id = v.user_id
        WHERE u.created_at >= today_date 
           OR v.created_at >= today_date
      ),
      (
        SELECT COUNT(DISTINCT user_id) 
        FROM public.votes 
        WHERE created_at >= today_date
      ),
      (
        SELECT COUNT(*) 
        FROM public.users 
        WHERE created_at >= today_date
      ),
      (
        SELECT COUNT(*) 
        FROM public.votes 
        WHERE created_at >= today_date
      ),
      (SELECT COUNT(DISTINCT collection_name) FROM public.nfts WHERE collection_name IS NOT NULL),
      (SELECT COUNT(*) FROM public.collection_management WHERE active = true),
      (SELECT COUNT(*) FROM public.nfts),
      -- Calculate average votes per NFT (simplified)
      (
        SELECT COALESCE(
          ROUND(CAST(COUNT(v.*) AS DECIMAL) / NULLIF(COUNT(DISTINCT n.id), 0), 2), 0
        )
        FROM public.nfts n
        LEFT JOIN public.votes v ON v.winner_id = n.id
      ),
      -- Calculate collection engagement (simplified)
      0.75, -- Placeholder - would need complex query
      -- Count collections with votes today
      (
        SELECT COUNT(DISTINCT n.collection_name)
        FROM public.nfts n
        INNER JOIN public.votes v ON v.winner_id = n.id
        WHERE v.created_at >= today_date AND n.collection_name IS NOT NULL
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.analytics_snapshots TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_daily_analytics_snapshot() TO anon, authenticated;

-- Optional: Create a trigger to automatically update snapshots
-- (You can also call this manually or via a cron job)
-- CREATE OR REPLACE FUNCTION trigger_daily_snapshot()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   PERFORM public.create_daily_analytics_snapshot();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Uncomment to enable automatic snapshots on new votes:
-- CREATE TRIGGER auto_analytics_snapshot
--   AFTER INSERT ON public.votes
--   FOR EACH STATEMENT
--   EXECUTE FUNCTION trigger_daily_snapshot();
