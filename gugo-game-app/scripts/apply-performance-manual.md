# 🚀 Manual Performance Optimization Guide

Since the automated script has issues with `CREATE INDEX CONCURRENTLY`, here's how to apply the optimizations manually through Supabase:

## Step 1: Apply Database Migration

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your Taste Machine project
   - Navigate to **SQL Editor**

2. **Copy and Paste Migration**
   - Open `migrations/45-performance-boost-enhanced-system.sql`
   - Copy the entire contents
   - Paste into Supabase SQL Editor
   - Click **Run** to execute

3. **Verify Success**
   - Look for "Success. No rows returned" message
   - Check that no errors appear in the results

## Step 2: Test Performance

Run this in your terminal (with dev server running):

```bash
curl -s "http://localhost:3000/api/test-enhanced-performance" | jq .
```

Expected results:
- Average execution time: <400ms
- Success rate: >90%
- Performance grade: GOOD or EXCELLENT

## Step 3: Monitor Enhanced System

After restarting your dev server (`npm run dev`), watch for these console messages:

```bash
# Good performance indicators:
⚡ Enhanced same_coll (Score: 0.95) - 65% success
💾 Cache hit for slider_{"maxCandidates":5}
🧠 Smart enhanced generation for mixed...

# Target: 50-70% enhanced usage (up from 30%)
```

## Troubleshooting

If you see errors in Supabase SQL Editor:

1. **"relation already exists"** - This is normal, the migration is idempotent
2. **"function does not exist"** - Make sure you copied the entire migration file
3. **"permission denied"** - Check that you're using the correct Supabase project

## Alternative: Step-by-Step Application

If the full migration fails, you can apply it in smaller chunks:

### Chunk 1: Indexes Only
```sql
-- Copy just the CREATE INDEX statements (lines 10-27)
CREATE INDEX IF NOT EXISTS idx_nfts_enhanced_selection 
ON nfts(collection_name, current_elo, total_votes) 
WHERE image NOT ILIKE '%.mp4%' AND image NOT ILIKE '%.mov%';

-- ... (other indexes)
```

### Chunk 2: Functions Only
```sql
-- Copy just the CREATE OR REPLACE FUNCTION statements
-- (lines 33-200 approximately)
```

### Chunk 3: Analytics Tables
```sql
-- Copy the analytics table and functions
-- (lines 320-397)
```

## Success Indicators

After successful application:
- Enhanced system usage should increase from 30% to 50-70%
- Database queries should be 2-3x faster
- Fewer timeout messages in console logs
- More sophisticated NFT matchups in the UI

## Next Steps

Once optimizations are applied:
1. Restart development server
2. Test voting experience in UI
3. Monitor console logs for performance improvements
4. Adjust enhanced ratio if needed (currently set to 50%)
