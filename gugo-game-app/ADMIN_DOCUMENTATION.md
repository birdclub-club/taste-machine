# 🔐 Admin Dashboard Documentation

## Overview

The GUGO Admin Dashboard provides comprehensive analytics and management tools for platform administrators. Access is restricted to authorized wallet addresses and provides real-time insights into treasury health, user engagement, and system performance.

## 🚀 Access & Authentication

### Admin Wallet Configuration
Admin access is controlled through wallet address authentication:

```typescript
// src/lib/admin-config.ts
export const ADMIN_WALLETS = [
  '0xd593c708833d606f28E81a147FD33edFeAdE0Aa9', // Primary admin wallet
  // Add additional admin wallets here
];
```

### Accessing the Dashboard
1. Navigate to `/admin` on your domain
2. Connect your wallet using the Connect Wallet button
3. If your wallet is authorized, you'll see "Admin Access Granted"
4. If unauthorized, you'll see "Access Denied - Admin privileges required"

## 📊 Dashboard Features

### 1. User Statistics
Real-time user engagement metrics with automatic refresh every 5 minutes:

- **Total Users**: Lifetime registered users
- **Daily Users**: Unique users who voted today  
- **Active Users**: Same as daily users (users who voted today)
- **New Users**: Users who joined today

**Data Validation**: Daily/Active users are automatically capped at Total Users to prevent logical inconsistencies.

### 2. GUGO Treasury Analytics
Comprehensive treasury monitoring with live blockchain data:

#### Treasury Wallets
- **Prize Break Treasury**: GUGO allocated for daily prizes
- **Weekly Raffle Treasury**: GUGO for weekly raffle rewards
- **Operations Wallet**: GUGO for operational expenses
- **Burned GUGO**: Permanently removed from circulation

#### Token Metrics
- **Total Supply**: Current GUGO token supply
- **Contract Balance**: GUGO held in smart contracts
- **Total Rewarded**: Cumulative GUGO distributed to users
- **Treasury Health**: Prize treasury as percentage of total supply

#### Revenue Tracking
- **Revenue Today**: Estimated daily revenue from user activity
- **Revenue All Time**: Cumulative platform revenue
- **Calculation**: Based on vote counts and user engagement metrics

### 3. Analytics Over Time
Historical data visualization with interactive charts:

- **Users Tab**: Total users, daily active, and new user trends
- **Votes Tab**: Daily voting activity and engagement
- **Collections Tab**: Active collection counts over time
- **Growth Tab**: Platform growth rate calculations

**Data Range**: Last 7 days with 30 data points, auto-refreshes every 10 minutes

## 🔧 Technical Implementation

### API Endpoints

#### User Statistics
```
GET /api/user-stats
```
Returns current user metrics with proper UTC date handling.

#### Treasury Data
```
GET /api/admin/gugo-treasury
```
Fetches live treasury data from blockchain contracts with fallback to simulated data.

#### Analytics History
```
GET /api/analytics-history
```
Provides historical data for chart visualization.

### Database Integration
The dashboard integrates with Supabase for real-time data:

```sql
-- User statistics query example
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(DISTINCT users.wallet_address) 
FROM votes 
JOIN users ON votes.user_id = users.id 
WHERE votes.created_at >= current_date;
```

### Error Handling
- **Graceful Degradation**: Falls back to simulated data if live data unavailable
- **Retry Logic**: Automatic retry for failed API calls
- **User Feedback**: Clear error messages and loading states

## 🎨 UI Components

### Charts & Visualizations
Built with Recharts library:
- **Area Charts**: User growth trends
- **Line Charts**: Vote activity over time
- **Bar Charts**: Collection engagement metrics

### Responsive Design
- **Desktop**: Full dashboard layout with side-by-side metrics
- **Mobile**: Stacked layout with touch-friendly controls
- **Dark Theme**: Consistent with main app design

### Real-time Updates
- **Auto-refresh**: User stats every 5 minutes
- **Manual Refresh**: Treasury data with dedicated button
- **Live Indicators**: Green dot shows live data status

## 🔒 Security Considerations

### Access Control
- **Wallet-based Authentication**: Only authorized addresses can access
- **No Session Storage**: Authentication checked on every page load
- **Admin-only Endpoints**: API routes protected with wallet verification

### Data Protection
- **Read-only Access**: Dashboard provides view-only access to sensitive data
- **No User PII**: Only aggregated statistics, no personal information
- **Audit Trail**: All admin access logged for security monitoring

## 🚀 Deployment & Maintenance

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### Database Migrations
Admin dashboard requires specific database functions:
```bash
# Apply user statistics functions
psql -f migrations/04-add-user-stats-functions.sql

# Apply analytics snapshots
psql -f migrations/05-add-analytics-snapshots.sql
```

### Monitoring & Alerts
- **Health Checks**: Monitor API endpoint availability
- **Data Validation**: Alert on inconsistent metrics
- **Performance**: Track dashboard load times and query performance

## 📈 Usage Analytics

### Key Metrics to Monitor
1. **User Growth Rate**: Track daily new user signups
2. **Engagement**: Daily active users vs total users ratio
3. **Treasury Health**: Ensure adequate GUGO reserves
4. **Revenue Trends**: Monitor platform monetization

### Decision Making
Use dashboard data for:
- **Prize Adjustments**: Modify reward amounts based on treasury health
- **Marketing Campaigns**: Time campaigns based on user activity patterns
- **Feature Development**: Prioritize features based on engagement metrics
- **Economic Balancing**: Adjust token economics based on usage patterns

## 🔧 Troubleshooting

### Common Issues

#### "Access Denied" Error
- Verify wallet address is in `ADMIN_WALLETS` array
- Ensure wallet is properly connected
- Check for typos in wallet address

#### Data Not Loading
- Check Supabase connection status
- Verify API endpoints are responding
- Review browser console for error messages

#### Charts Not Displaying
- Ensure Recharts library is properly installed
- Check for JavaScript errors in browser console
- Verify data format matches chart requirements

### Debug Tools
```javascript
// Browser console commands
console.log('Admin wallets:', ADMIN_WALLETS);
console.log('Current wallet:', address);
console.log('Is admin:', isAdmin);
```

## 🔄 Future Enhancements

### Planned Features
- **Real-time Notifications**: Alert system for critical events
- **Advanced Analytics**: Machine learning insights and predictions
- **User Management**: Tools for managing user accounts and permissions
- **Automated Reports**: Scheduled email reports for key metrics
- **A/B Testing**: Dashboard for managing feature experiments

### Integration Opportunities
- **Discord Bot**: Automated reporting to Discord channels
- **Slack Integration**: Real-time alerts and daily summaries
- **Email Alerts**: Automated notifications for critical events
- **Mobile App**: Native mobile admin dashboard

---

**Built with security and usability in mind for the GUGO ecosystem** 🚀
