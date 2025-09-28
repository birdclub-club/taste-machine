# 🎯 Favorites System Migration Guide

This guide covers the database migrations required for the Favorites Gallery feature.

## 📋 Migration Overview

The Favorites system requires two database migrations to be run in sequence:

1. **Migration 15**: Initial favorites table and functions
2. **Migration 16**: Add collection_address column for Magic Eden integration

## 🗄️ Database Schema Changes

### Migration 15: Initial Favorites System
```sql
-- Creates the favorites table
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT REFERENCES users(wallet_address),
  nft_id INTEGER REFERENCES nfts(id),
  vote_type TEXT CHECK (vote_type IN ('fire', 'slider_max')),
  token_id TEXT,
  collection_name TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Initial RPC functions
CREATE FUNCTION add_to_favorites(...) RETURNS VOID;
CREATE FUNCTION get_user_favorites(...) RETURNS TABLE(...);
```

### Migration 16: Enhanced Metadata
```sql
-- Safely adds collection_address column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'collection_address'
  ) THEN
    ALTER TABLE favorites ADD COLUMN collection_address TEXT;
  END IF;
END $$;

-- Updates RPC functions to include collection_address
DROP FUNCTION IF EXISTS get_user_favorites(text);
CREATE OR REPLACE FUNCTION get_user_favorites(p_wallet_address text)
RETURNS TABLE(
  id integer,
  nft_id integer,
  vote_type text,
  token_id text,
  collection_name text,
  image_url text,
  collection_address text,
  created_at timestamp
);
```

## 🚀 Running Migrations

### Step 1: Apply Migration 15
```bash
# In Supabase SQL Editor or psql:
# Copy and paste contents of: migrations/15-add-favorites-system.sql
```

### Step 2: Apply Migration 16
```bash
# In Supabase SQL Editor or psql:
# Copy and paste contents of: migrations/16-add-collection-address-to-favorites.sql
```

### Step 3: Verify Migration
```sql
-- Check table structure
\d favorites;

-- Test RPC functions
SELECT add_to_favorites('test_wallet', 1, 'fire', '123', 'Test Collection', 'test.jpg', '0x123');
SELECT * FROM get_user_favorites('test_wallet');
```

## 🔧 API Integration

### New Endpoints Created
- **POST /api/favorites**: Add NFT to favorites
- **GET /api/favorites**: Retrieve user's favorites
- **DELETE /api/favorites**: Remove from favorites

### Frontend Integration
```typescript
// useFavorites.ts hook provides:
const { favorites, addToFavorites, removeFromFavorites, loading } = useFavorites();

// Automatic favorites collection:
// - Fire votes (🔥) → automatically added
// - 100% slider votes → automatically added
```

## 📊 Magic Eden Integration

The `collection_address` field enables direct links to Magic Eden:

```typescript
// Collection page
https://magiceden.us/collections/abstract/{collection_address}

// NFT page  
https://magiceden.us/collections/abstract/{collection_address}/{token_id}
```

## 🎨 UI Components

### FavoritesGallery Component
- **Location**: Accessed via gold shimmer button in StatusBar wallet dropdown
- **Features**: Grid layout, price toggle, Magic Eden links
- **Responsive**: Mobile-optimized with proper aspect ratios

### Gold Shimmer Button
```css
/* 3-second animation cycle with premium styling */
background: linear-gradient(135deg, #d4af37, #ffd700, #ffed4e);
animation: goldShimmer 3s infinite linear;
```

## 🔍 Troubleshooting

### Common Issues

1. **"Table doesn't exist"**
   ```sql
   -- Run migration 15 first
   SELECT * FROM information_schema.tables WHERE table_name = 'favorites';
   ```

2. **"Column doesn't exist"**
   ```sql
   -- Run migration 16
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'favorites';
   ```

3. **"Function doesn't exist"**
   ```sql
   -- Check function exists
   SELECT proname FROM pg_proc WHERE proname LIKE '%favorites%';
   ```

### Rollback (if needed)
```sql
-- Remove favorites system completely
DROP TABLE IF EXISTS favorites CASCADE;
DROP FUNCTION IF EXISTS add_to_favorites(text, integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS get_user_favorites(text);
```

## ✅ Verification Checklist

- [ ] Migration 15 applied successfully
- [ ] Migration 16 applied successfully  
- [ ] `favorites` table exists with all columns
- [ ] RPC functions work correctly
- [ ] API endpoints return valid responses
- [ ] Frontend displays favorites gallery
- [ ] Magic Eden links work properly
- [ ] Price toggle functions correctly

## 📝 Notes

- **Safe Migrations**: Both migrations use `IF NOT EXISTS` logic
- **Backward Compatible**: Existing data remains untouched
- **Row Level Security**: Inherit from parent tables
- **Performance**: Indexes on wallet_address and nft_id
- **External APIs**: Price data cached for performance

---

**Migration Status**: ✅ Complete and Production Ready  
**Last Updated**: August 2025  
**Next Steps**: Monitor usage and optimize performance as needed
