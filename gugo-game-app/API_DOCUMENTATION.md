# 🔌 API Documentation

## Overview

The GUGO API provides comprehensive endpoints for user management, voting mechanics, treasury analytics, and administrative functions. All endpoints are built with Next.js API routes and integrate with Supabase for data persistence.

## 🔐 Authentication

### Wallet-Based Authentication
Most endpoints use wallet address authentication:
```typescript
// Header-based authentication
headers: {
  'x-wallet-address': '0x...'
}

// Query parameter authentication
/api/endpoint?wallet=0x...
```

### Admin Endpoints
Admin-only endpoints require authorized wallet addresses:
```typescript
// Authorized admin wallets
const ADMIN_WALLETS = [
  '0xd593c708833d606f28E81a147FD33edFeAdE0Aa9'
];
```

## 🎬 Prize Break Animation System

### Frontend Animation Integration
The prize break system integrates with frontend animations through structured reward objects:

**Reward Object Structure:**
```typescript
interface PrizeBreakReward {
  gugoAmount: number;    // GUGO tokens awarded
  xpAmount: number;      // XP points awarded  
  licksAmount: number;   // Licks/votes awarded
  votesAmount: number;   // Alternative votes field
}
```

**Animation Trigger Logic:**
```typescript
// Multi-reward animation handling
if (reward.gugoAmount > 0) {
  // Trigger confetti + wallet glow
  statusBarRef.current?.triggerWalletGlow(reward.gugoAmount);
}

if (reward.xpAmount > 0 || reward.licksAmount > 0 || reward.votesAmount > 0) {
  // Trigger floating animations
  if (reward.xpAmount > 0) {
    statusBarRef.current?.triggerXpAnimation(reward.xpAmount);
  }
  if (reward.licksAmount > 0) {
    statusBarRef.current?.triggerLicksAnimation(reward.licksAmount);
  }
}
```

**StatusBar Animation Methods:**
- `triggerXpAnimation(amount: number)` - Orange floating XP animation
- `triggerLicksAnimation(amount: number)` - White floating Licks animation  
- `triggerWalletGlow(amount: number)` - Green GUGO wallet glow + confetti

## 🏥 System Health Monitoring

### GET /api/system-health-check
Returns comprehensive system status and health metrics.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX",
  "systems": {
    "database": { 
      "status": "operational", 
      "response_time": "45ms",
      "connection_pool": "healthy"
    },
    "cache": { 
      "status": "operational", 
      "hit_rate": "94%",
      "version_manager": "active"
    },
    "enhanced_engine": { 
      "status": "operational", 
      "success_rate": "98%",
      "duplicate_prevention": "active"
    },
    "ipfs_gateways": { 
      "status": "operational", 
      "active_gateways": 8,
      "fastest_gateway": "ipfs.io"
    }
  },
  "performance_metrics": {
    "avg_matchup_generation": "450ms",
    "avg_database_query": "85ms",
    "cache_hit_rate": "94%",
    "system_uptime": "99.9%"
  }
}
```

#### Features
- **Real-time Monitoring**: Live system health checks
- **Performance Metrics**: Response times and success rates
- **Component Status**: Individual system health tracking
- **Automatic Alerts**: Detects degraded performance

## 📊 User Statistics

### GET /api/user-stats
Returns comprehensive user engagement metrics.

#### Response
```json
{
  "totalUsers": 23,
  "dailyUsers": 1,
  "activeUsersToday": 1,
  "newUsersToday": 0,
  "timestamp": "2025-08-14T10:24:44.000Z"
}
```

#### Features
- **Real-time Data**: Live counts from database
- **UTC Date Handling**: Consistent timezone calculations
- **Data Validation**: Daily/active users capped at total users
- **Auto-refresh**: Updates every 5 minutes in admin dashboard

#### Implementation Details
```sql
-- Total users query
SELECT COUNT(*) as total_users FROM users;

-- Daily active users (with proper joins)
SELECT COUNT(DISTINCT users.wallet_address) 
FROM votes 
JOIN users ON votes.user_id = users.id 
WHERE votes.created_at >= current_date;
```

## 💰 Treasury Analytics

### GET /api/admin/gugo-treasury
**Admin Only** - Returns comprehensive treasury and revenue data.

#### Authentication
```typescript
// Required: Admin wallet address
headers: {
  'x-wallet-address': 'ADMIN_WALLET_ADDRESS'
}
```

#### Response
```json
{
  "prizeBreakTreasury": 100000,
  "weeklyRaffleTreasury": 0,
  "legacyTreasury": 0,
  "operationsWalletBalance": 0,
  "burnWalletBalance": 0,
  "totalSupply": 1000000000,
  "contractBalance": 100000,
  "totalRewarded": 0,
  "totalBurned": 0,
  "revenueToday": 47.55,
  "revenueAllTime": 2936.35,
  "timestamp": "2025-08-14T10:24:44.000Z",
  "status": "live"
}
```

#### Features
- **Live Blockchain Data**: Real-time contract queries
- **Fallback System**: Simulated data when contracts unavailable
- **Revenue Calculation**: Based on user activity and vote counts
- **Treasury Health**: Percentage calculations for monitoring

#### Error Handling
```json
// Unauthorized access
{
  "error": "Unauthorized - Admin access required"
}

// Contract unavailable
{
  "status": "simulated",
  "message": "Using fallback data"
}
```

## 📈 Analytics History

### GET /api/analytics-history
Returns historical data for dashboard charts.

#### Query Parameters
```
?days=7          # Number of days (default: 7)
?dataPoints=30   # Number of data points (default: 30)
```

#### Response
```json
{
  "data": [
    {
      "date": "2025-08-07",
      "displayDate": "8/7/2025",
      "total_users": 23,
      "daily_users": 8,
      "new_users": 1,
      "total_votes": 451,
      "active_collections": 7,
      "growth_rate": 32.0
    }
  ],
  "summary": {
    "totalUsers": 23,
    "totalVotes": 451,
    "activeCollections": 7,
    "avgGrowthRate": 32.0
  }
}
```

#### Features
- **Time Series Data**: Historical trends over specified period
- **Multiple Metrics**: Users, votes, collections, growth rates
- **Chart Ready**: Formatted for Recharts visualization
- **Performance Optimized**: Efficient database queries

## 🎯 Collection Management

### GET /api/collection-management
Returns collection statistics and management data.

#### Response
```json
{
  "success": true,
  "collections": [
    {
      "collection_name": "BOSU",
      "nft_count": 10000,
      "total_votes": 1234,
      "avg_elo": 1500,
      "active": true,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total_collections": 7,
  "active_collections": 7,
  "analytics": {
    "total_nfts": 54768,
    "total_votes": 451,
    "average_elo": 1500,
    "most_active_collection": "BOSU",
    "newest_collection": "Canna Sapiens"
  }
}
```

#### Features
- **Collection Stats**: NFT counts, votes, Elo ratings
- **Activity Tracking**: Active vs inactive collections
- **Performance Metrics**: Most active and newest collections
- **Management Tools**: Data for admin collection management

## ⭐ Favorites System

### GET /api/favorites
Returns user's favorited NFTs with metadata.

#### Query Parameters
```
?wallet=0x...    # User wallet address (required)
```

#### Response
```json
{
  "favorites": [
    {
      "id": 123,
      "collection_name": "BOSU",
      "token_id": "5094",
      "vote_type": "fire",
      "collection_address": "0x...",
      "created_at": "2025-08-14T10:00:00.000Z"
    }
  ]
}
```

### POST /api/favorites
Adds NFT to user's favorites.

#### Request Body
```json
{
  "wallet": "0x...",
  "collection_name": "BOSU",
  "token_id": "5094",
  "vote_type": "fire",
  "collection_address": "0x..."
}
```

### DELETE /api/favorites
Removes NFT from user's favorites.

#### Request Body
```json
{
  "wallet": "0x...",
  "collection_name": "BOSU",
  "token_id": "5094"
}
```

## 💎 NFT Pricing

### GET /api/nft-price
Returns current market price for specific NFT.

#### Query Parameters
```
?collection=0x...    # Collection contract address
&tokenId=5094        # Token ID
```

#### Response
```json
{
  "price": 0.5,
  "currency": "ETH",
  "marketplace": "Magic Eden",
  "lastUpdated": "2025-08-14T10:00:00.000Z"
}
```

#### Features
- **Magic Eden Integration**: Live pricing data
- **Error Handling**: Graceful fallback for unavailable prices
- **Caching**: Efficient price data management

## 📊 Daily Activity

### GET /api/daily-vote-count
Returns current daily vote activity.

#### Response
```json
{
  "count": 451,
  "date": "2025-08-14",
  "multiplier": 5
}
```

#### Features
- **Real-time Counts**: Live vote activity
- **Boost Multiplier**: Enhanced engagement metrics
- **Growth Simulation**: Believable real-time increases

## 🔧 Utility Endpoints

### POST /api/clear-preloader-cache
Clears preloader cache for fresh NFT data.

#### Response
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

## 🚨 Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-08-14T10:00:00.000Z"
}
```

### Common HTTP Status Codes
- **200**: Success
- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (invalid wallet)
- **403**: Forbidden (admin access required)
- **404**: Not Found (resource doesn't exist)
- **500**: Internal Server Error

### Error Types
```typescript
// Authentication errors
{
  "error": "Unauthorized - Admin access required",
  "code": "ADMIN_REQUIRED"
}

// Validation errors
{
  "error": "Invalid wallet address",
  "code": "INVALID_WALLET"
}

// Database errors
{
  "error": "Database connection failed",
  "code": "DB_ERROR"
}
```

## 🔒 Security

### Rate Limiting
- **User Endpoints**: 100 requests per minute per IP
- **Admin Endpoints**: 50 requests per minute per wallet
- **Public Endpoints**: 200 requests per minute per IP

### Input Validation
```typescript
// Wallet address validation
const isValidWallet = (address: string) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Sanitization
const sanitizeInput = (input: string) => {
  return input.trim().toLowerCase();
};
```

### CORS Configuration
```typescript
// Allowed origins
const allowedOrigins = [
  'https://yourdomain.com',
  'http://localhost:3000'
];
```

## 📊 Performance

### Caching Strategy
- **User Stats**: 5-minute cache
- **Treasury Data**: 1-hour cache
- **NFT Prices**: 15-minute cache
- **Analytics**: 10-minute cache

### Database Optimization
```sql
-- Indexed queries for performance
CREATE INDEX idx_votes_created_at ON votes(created_at);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_favorites_wallet ON favorites(user_wallet_address);
```

### Response Compression
- **Gzip**: Enabled for all text responses
- **JSON Minification**: Automatic whitespace removal
- **Image Optimization**: WebP format where supported

## 🔧 Development

### Local Testing
```bash
# Start development server
npm run dev

# Test endpoints
curl http://localhost:3000/api/user-stats
curl http://localhost:3000/api/daily-vote-count
```

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### API Testing Tools
- **Postman Collection**: Available for comprehensive testing
- **Thunder Client**: VS Code extension for API testing
- **curl Commands**: Command-line testing examples

---

**Built for scalability and reliability in the GUGO ecosystem** 🚀
