-- User Statistics Functions for Admin Dashboard
-- Run this in your Supabase SQL Editor

-- Function to get unique users who voted on a specific date
CREATE OR REPLACE FUNCTION public.get_unique_daily_users(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(unique_users BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(DISTINCT v.user_id) as unique_users
  FROM public.votes v
  WHERE v.created_at >= start_date 
    AND v.created_at < end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive user statistics
CREATE OR REPLACE FUNCTION public.get_user_statistics()
RETURNS TABLE(
  total_users BIGINT,
  users_today BIGINT,
  users_this_week BIGINT,
  users_this_month BIGINT,
  active_users_today BIGINT,
  active_users_this_week BIGINT,
  new_users_today BIGINT,
  new_users_this_week BIGINT
) AS $$
DECLARE
  today_start TIMESTAMP WITH TIME ZONE;
  week_start TIMESTAMP WITH TIME ZONE;
  month_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate date boundaries
  today_start := DATE_TRUNC('day', NOW());
  week_start := DATE_TRUNC('week', NOW());
  month_start := DATE_TRUNC('month', NOW());
  
  RETURN QUERY
  SELECT 
    -- Total users (lifetime)
    (SELECT COUNT(*) FROM public.users) as total_users,
    
    -- Users today (new + active)
    (SELECT COUNT(DISTINCT COALESCE(u.id, v.user_id))
     FROM public.users u
     FULL OUTER JOIN public.votes v ON u.id = v.user_id
     WHERE u.created_at >= today_start 
        OR v.created_at >= today_start) as users_today,
    
    -- Users this week (new + active)
    (SELECT COUNT(DISTINCT COALESCE(u.id, v.user_id))
     FROM public.users u
     FULL OUTER JOIN public.votes v ON u.id = v.user_id
     WHERE u.created_at >= week_start 
        OR v.created_at >= week_start) as users_this_week,
    
    -- Users this month (new + active)
    (SELECT COUNT(DISTINCT COALESCE(u.id, v.user_id))
     FROM public.users u
     FULL OUTER JOIN public.votes v ON u.id = v.user_id
     WHERE u.created_at >= month_start 
        OR v.created_at >= month_start) as users_this_month,
    
    -- Active users today (voted today)
    (SELECT COUNT(DISTINCT user_id) 
     FROM public.votes 
     WHERE created_at >= today_start) as active_users_today,
    
    -- Active users this week (voted this week)
    (SELECT COUNT(DISTINCT user_id) 
     FROM public.votes 
     WHERE created_at >= week_start) as active_users_this_week,
    
    -- New users today (registered today)
    (SELECT COUNT(*) 
     FROM public.users 
     WHERE created_at >= today_start) as new_users_today,
    
    -- New users this week (registered this week)
    (SELECT COUNT(*) 
     FROM public.users 
     WHERE created_at >= week_start) as new_users_this_week;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_unique_daily_users(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_statistics() TO anon, authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON public.votes(created_at);
CREATE INDEX IF NOT EXISTS idx_votes_user_id_created_at ON public.votes(user_id, created_at);

