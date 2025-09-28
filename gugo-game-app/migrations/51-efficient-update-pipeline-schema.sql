-- =====================================================
-- EFFICIENT UPDATE PIPELINE SCHEMA
-- Event-driven, incremental, debounced POA updates
-- =====================================================

-- EVENTS (append-only) ----------------------------------
CREATE TABLE IF NOT EXISTS votes_events (
  id BIGSERIAL PRIMARY KEY,
  voter_id UUID NOT NULL,
  nft_a_id BIGINT NOT NULL,
  nft_b_id BIGINT NOT NULL,
  winner_id BIGINT NOT NULL,
  -- Elo snapshots (captured at matchup creation)
  elo_pre_a NUMERIC NOT NULL,
  elo_pre_b NUMERIC NOT NULL,
  -- Vote type for weighting (normal=32, super=64)
  vote_type VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_events_nft_a ON votes_events (nft_a_id, id);
CREATE INDEX IF NOT EXISTS idx_votes_events_nft_b ON votes_events (nft_b_id, id);
CREATE INDEX IF NOT EXISTS idx_votes_events_created_at ON votes_events (created_at);
CREATE INDEX IF NOT EXISTS idx_votes_events_voter ON votes_events (voter_id, created_at);

CREATE TABLE IF NOT EXISTS sliders_events (
  id BIGSERIAL PRIMARY KEY,
  voter_id UUID NOT NULL,
  nft_id BIGINT NOT NULL,
  raw_score NUMERIC NOT NULL, -- 0..100 from UI
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sliders_events_nft ON sliders_events (nft_id, id);
CREATE INDEX IF NOT EXISTS idx_sliders_events_voter ON sliders_events (voter_id, created_at);

CREATE TABLE IF NOT EXISTS fires_events (
  id BIGSERIAL PRIMARY KEY,
  voter_id UUID NOT NULL,
  nft_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fires_events_nft ON fires_events (nft_id, id);
CREATE INDEX IF NOT EXISTS idx_fires_events_voter ON fires_events (voter_id, created_at);

-- USERS (rater calibration) -----------------------------
-- Add columns for user calibration and reliability
DO $$
BEGIN
  -- Slider calibration (Welford online algorithm)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'slider_mean') THEN
    ALTER TABLE users ADD COLUMN slider_mean NUMERIC DEFAULT 50;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'slider_std') THEN
    ALTER TABLE users ADD COLUMN slider_std NUMERIC DEFAULT 15;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'slider_m2') THEN
    ALTER TABLE users ADD COLUMN slider_m2 NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'slider_count') THEN
    ALTER TABLE users ADD COLUMN slider_count INTEGER DEFAULT 0;
  END IF;
  
  -- Reliability scoring
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reliability_score') THEN
    ALTER TABLE users ADD COLUMN reliability_score NUMERIC DEFAULT 1.0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reliability_count') THEN
    ALTER TABLE users ADD COLUMN reliability_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reliability_updated_at') THEN
    ALTER TABLE users ADD COLUMN reliability_updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- DIRTY SET (work queue) ---------------------------------
CREATE TABLE IF NOT EXISTS dirty_nfts (
  nft_id BIGINT PRIMARY KEY,
  first_dirty_at TIMESTAMPTZ DEFAULT NOW(),
  last_event_at TIMESTAMPTZ DEFAULT NOW(),
  priority INTEGER DEFAULT 0 -- Higher priority = process first
);

CREATE INDEX IF NOT EXISTS idx_dirty_nfts_priority ON dirty_nfts (priority DESC, first_dirty_at);
CREATE INDEX IF NOT EXISTS idx_dirty_nfts_first_dirty ON dirty_nfts (first_dirty_at);

-- INCREMENTAL RUNTIME STATS -----------------------------
CREATE TABLE IF NOT EXISTS nft_stats (
  nft_id BIGINT PRIMARY KEY,
  
  -- Elo state
  elo_mean NUMERIC DEFAULT 1200,
  elo_sigma NUMERIC DEFAULT 350,
  
  -- Processing checkpoints
  last_processed_vote_id BIGINT DEFAULT 0,
  last_processed_slider_id BIGINT DEFAULT 0,
  last_processed_fire_id BIGINT DEFAULT 0,
  
  -- Aggregated slider state
  slider_sum_w NUMERIC DEFAULT 0,    -- sum of normalized slider * voter weight
  slider_weight NUMERIC DEFAULT 0,   -- sum of voter weights used in sliders
  
  -- FIRE state  
  fire_sum_w NUMERIC DEFAULT 0,      -- sum of voter weights for FIRE
  
  -- Reliability tracking
  avg_rater_rel NUMERIC DEFAULT 1.0, -- smoothed avg of voter weights
  
  -- Metadata
  total_votes INTEGER DEFAULT 0,
  total_sliders INTEGER DEFAULT 0,
  total_fires INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_stats_vote_checkpoint ON nft_stats (last_processed_vote_id);
CREATE INDEX IF NOT EXISTS idx_nft_stats_slider_checkpoint ON nft_stats (last_processed_slider_id);
CREATE INDEX IF NOT EXISTS idx_nft_stats_fire_checkpoint ON nft_stats (last_processed_fire_id);
CREATE INDEX IF NOT EXISTS idx_nft_stats_updated ON nft_stats (updated_at);

-- PUBLISHED SCORES (UI reads) ---------------------------
CREATE TABLE IF NOT EXISTS nft_scores (
  nft_id BIGINT PRIMARY KEY,
  poa_v2 NUMERIC,
  elo_mean NUMERIC,
  elo_sigma NUMERIC,
  confidence NUMERIC,
  provisional BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Components for transparency
  elo_component NUMERIC,
  slider_component NUMERIC,
  fire_component NUMERIC,
  reliability_factor NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_nft_scores_poa_v2 ON nft_scores (poa_v2 DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nft_scores_elo ON nft_scores (elo_mean DESC);
CREATE INDEX IF NOT EXISTS idx_nft_scores_updated ON nft_scores (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nft_scores_provisional ON nft_scores (provisional, poa_v2 DESC NULLS LAST);

-- HELPER FUNCTIONS ---------------------------------------

-- Mark NFT as dirty (cheap upsert)
CREATE OR REPLACE FUNCTION mark_dirty_nft(_nft_id BIGINT, _priority INTEGER DEFAULT 0) 
RETURNS VOID 
LANGUAGE SQL AS $$
  INSERT INTO dirty_nfts (nft_id, priority, last_event_at) 
  VALUES (_nft_id, _priority, NOW())
  ON CONFLICT (nft_id) DO UPDATE SET
    last_event_at = NOW(),
    priority = GREATEST(dirty_nfts.priority, EXCLUDED.priority);
$$;

-- TRIGGERS FOR AUTOMATIC DIRTY MARKING ------------------

-- VOTES: mark both contestants
CREATE OR REPLACE FUNCTION trg_votes_events_dirty() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL AS $$
BEGIN
  -- Higher priority for super votes
  PERFORM mark_dirty_nft(NEW.nft_a_id, CASE WHEN NEW.vote_type = 'super' THEN 10 ELSE 0 END);
  PERFORM mark_dirty_nft(NEW.nft_b_id, CASE WHEN NEW.vote_type = 'super' THEN 10 ELSE 0 END);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS votes_events_dirty ON votes_events;
CREATE TRIGGER votes_events_dirty 
  AFTER INSERT ON votes_events
  FOR EACH ROW EXECUTE FUNCTION trg_votes_events_dirty();

-- SLIDERS: mark subject NFT
CREATE OR REPLACE FUNCTION trg_sliders_events_dirty() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL AS $$
BEGIN
  PERFORM mark_dirty_nft(NEW.nft_id, 5); -- Medium priority
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sliders_events_dirty ON sliders_events;
CREATE TRIGGER sliders_events_dirty 
  AFTER INSERT ON sliders_events
  FOR EACH ROW EXECUTE FUNCTION trg_sliders_events_dirty();

-- FIRES: mark subject NFT  
CREATE OR REPLACE FUNCTION trg_fires_events_dirty() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL AS $$
BEGIN
  PERFORM mark_dirty_nft(NEW.nft_id, 15); -- High priority for FIRE votes
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fires_events_dirty ON fires_events;
CREATE TRIGGER fires_events_dirty 
  AFTER INSERT ON fires_events
  FOR EACH ROW EXECUTE FUNCTION trg_fires_events_dirty();

-- BATCH PROCESSING FUNCTIONS ----------------------------

-- Claim a batch of dirty NFTs for processing
CREATE OR REPLACE FUNCTION claim_dirty_nfts(limit_n INTEGER DEFAULT 500)
RETURNS TABLE(nft_id BIGINT) 
LANGUAGE PLPGSQL AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT d.nft_id
    FROM dirty_nfts d
    ORDER BY d.priority DESC, d.first_dirty_at ASC
    LIMIT limit_n
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM dirty_nfts d 
  USING claimed c
  WHERE d.nft_id = c.nft_id
  RETURNING c.nft_id;
END $$;

-- Get or create NFT stats record
CREATE OR REPLACE FUNCTION get_or_create_nft_stats(_nft_id BIGINT)
RETURNS nft_stats
LANGUAGE PLPGSQL AS $$
DECLARE
  result nft_stats;
BEGIN
  SELECT * INTO result FROM nft_stats WHERE nft_id = _nft_id;
  
  IF NOT FOUND THEN
    INSERT INTO nft_stats (nft_id) VALUES (_nft_id) RETURNING * INTO result;
  END IF;
  
  RETURN result;
END $$;

-- MONITORING AND MAINTENANCE ----------------------------

-- Get pipeline status
CREATE OR REPLACE FUNCTION get_pipeline_status()
RETURNS TABLE(
  dirty_nfts_count BIGINT,
  high_priority_count BIGINT,
  avg_age_minutes NUMERIC,
  oldest_dirty_minutes NUMERIC,
  total_nft_stats BIGINT,
  total_published_scores BIGINT
)
LANGUAGE SQL AS $$
  SELECT 
    COUNT(*) as dirty_nfts_count,
    COUNT(*) FILTER (WHERE priority > 0) as high_priority_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - first_dirty_at)) / 60), 2) as avg_age_minutes,
    ROUND(MAX(EXTRACT(EPOCH FROM (NOW() - first_dirty_at)) / 60), 2) as oldest_dirty_minutes,
    (SELECT COUNT(*) FROM nft_stats) as total_nft_stats,
    (SELECT COUNT(*) FROM nft_scores WHERE poa_v2 IS NOT NULL) as total_published_scores
  FROM dirty_nfts;
$$;

-- Clean up old events (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_events(days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(
  votes_deleted BIGINT,
  sliders_deleted BIGINT, 
  fires_deleted BIGINT
)
LANGUAGE PLPGSQL AS $$
DECLARE
  cutoff_date TIMESTAMPTZ := NOW() - (days_to_keep || ' days')::INTERVAL;
  v_deleted BIGINT;
  s_deleted BIGINT;
  f_deleted BIGINT;
BEGIN
  DELETE FROM votes_events WHERE created_at < cutoff_date;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  DELETE FROM sliders_events WHERE created_at < cutoff_date;
  GET DIAGNOSTICS s_deleted = ROW_COUNT;
  
  DELETE FROM fires_events WHERE created_at < cutoff_date;
  GET DIAGNOSTICS f_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted, s_deleted, f_deleted;
END $$;

-- COMMENTS AND DOCUMENTATION ----------------------------
COMMENT ON TABLE votes_events IS 'Append-only vote events for efficient incremental processing';
COMMENT ON TABLE sliders_events IS 'Append-only slider events with raw scores from UI';
COMMENT ON TABLE fires_events IS 'Append-only FIRE vote events';
COMMENT ON TABLE dirty_nfts IS 'Work queue of NFTs that need score updates';
COMMENT ON TABLE nft_stats IS 'Incremental runtime state for efficient POA computation';
COMMENT ON TABLE nft_scores IS 'Published scores for UI consumption (updated only on meaningful changes)';

COMMENT ON FUNCTION mark_dirty_nft IS 'Mark an NFT as needing score update with optional priority';
COMMENT ON FUNCTION claim_dirty_nfts IS 'Atomically claim a batch of dirty NFTs for processing';
COMMENT ON FUNCTION get_pipeline_status IS 'Get current status of the update pipeline';

