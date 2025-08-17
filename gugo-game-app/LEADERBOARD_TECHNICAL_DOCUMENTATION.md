# 🏆 Leaderboard Technical Documentation

**Last Updated**: January 2025  
**Component**: `src/components/Leaderboard.tsx`  
**Related**: Magic Eden API integration, Dynamic theming system

## 📋 Overview

The Leaderboard component displays the top 20 NFTs by aesthetic score with integrated price fetching, Magic Eden links, and dynamic theming. It features a two-column grid layout with horizontal cards optimized for both desktop and mobile viewing.

## 🔧 Technical Implementation

### Data Structure

```typescript
interface LeaderboardEntry {
  id: string;
  name: string;
  image: string;
  collection_name: string;
  contract_address?: string;  // Note: Uses contract_address, not collection_address
  token_id?: string;
  total_votes: number;
  wins: number;
  current_elo: number;
  fire_votes: number;
  poa_score: number;
  confidence_score: number;
  leaderboard_position: number;
}
```

### API Integration

#### Leaderboard Data
- **Endpoint**: `/api/leaderboard`
- **Supabase Function**: `get_fire_first_leaderboard_v2(limit_count: 20)`
- **Returns**: Array of LeaderboardEntry objects with complete NFT metadata

#### Price Fetching
- **Endpoint**: `/api/nft-price?collection={contract_address}&token={token_id}`
- **Trigger**: "Show Prices" button toggle
- **Timeout**: 15 seconds per request with AbortController
- **Parallel Processing**: All price requests run simultaneously

### Layout Design

#### Container Structure
```css
display: grid
gridTemplateColumns: '1fr 1fr'  /* Two-column layout */
gap: 'var(--space-4)'
minHeight: '200px'              /* Accommodates larger images */
```

#### Card Layout
```css
display: flex
flexDirection: row              /* Horizontal layout */
alignItems: center
padding: 'var(--space-4)'
```

#### Component Positioning
- **Position Badge**: Absolute positioned top-left (32px circle)
- **Info Section**: Left side with collection name, token ID, and price
- **NFT Image**: Right side (160px × 160px)

### Dynamic Theming

#### Color Scheme
```css
background: 'var(--dynamic-text-color)'     /* Inverted: text color as background */
border: '1px solid var(--dynamic-bg-color)' /* Background color as border */
color: 'var(--dynamic-bg-color)'           /* Background color as text */
```

#### Token ID Styling
```css
color: '#ffffff'                            /* Always white for maximum contrast */
fontSize: 'var(--font-size-lg)'
fontFamily: 'monospace'
```

### Interactive Features

#### Magic Eden Integration
```typescript
// Collection URL
const getCollectionMagicEdenUrl = (contractAddress: string) => {
  return `https://magiceden.us/collections/abstract/${contractAddress}`;
};

// Individual NFT URL  
const getTokenMagicEdenUrl = (contractAddress: string, tokenId: string) => {
  return `https://magiceden.us/item-details/abstract/${contractAddress}/${tokenId}`;
};
```

#### Price Display Logic
```typescript
{showPrices && (
  <div>
    {loadingPrices ? (
      'Loading...'
    ) : prices[nft.id] ? (
      prices[nft.id]?.price ? (
        `${prices[nft.id]!.price} ${prices[nft.id]!.currency}`
      ) : (
        'Unlisted'
      )
    ) : nft.contract_address && nft.token_id ? (
      'Price unavailable'
    ) : (
      'No contract data'
    )}
  </div>
)}
```

### Modal System

#### React Portal Implementation
```typescript
return createPortal(
  <div style={{ zIndex: 999999, isolation: 'isolate' }}>
    {/* Modal content */}
  </div>,
  document.body
);
```

#### Z-Index Management
- **Modal Overlay**: `999999`
- **Isolation**: `'isolate'` prevents stacking context issues
- **Padding Top**: `80px` to account for status bar

## 🎨 Styling Details

### Header Layout
```css
display: flex
alignItems: flex-start
justifyContent: space-between
```

**Left Side**: Title and subtitle  
**Right Side**: Show Prices button + Loading indicator + Close button

### Show Prices Button
```css
background: showPrices ? 'var(--color-grey-400)' : 'transparent'
border: '1px solid var(--color-grey-400)'
color: showPrices ? 'black' : 'var(--color-grey-400)'
```

### Hover Effects
- **Collection Names**: Green highlight on hover
- **Token IDs**: Green highlight + scale(1.05) transform
- **Images**: No hover effects (maintains clean aesthetic)

## 🔍 Debugging Features

### Console Logging
```typescript
// Data structure debugging
console.log('🔍 Leaderboard items structure:', leaderboard.slice(0, 2));
console.log('🔍 Available fields:', Object.keys(leaderboard[0] || {}));

// Price fetching debugging  
console.log(`💰 Starting price fetch for ${item.id} (${item.contract_address}:${item.token_id})`);
console.log(`💰 Price API response for ${item.id}: ${response.status} (${elapsed}ms)`);
```

### Error Handling
- **API Failures**: Graceful fallback to "Price unavailable"
- **Missing Data**: Shows "No contract data" for items without contract info
- **Network Timeouts**: 15-second timeout with AbortController
- **Empty Responses**: Handles empty API responses

## 🚀 Performance Optimizations

### Price Fetching
- **Parallel Requests**: All prices fetched simultaneously using Promise.all()
- **Request Filtering**: Only fetches prices for items with contract_address and token_id
- **Timeout Management**: Prevents hanging requests with AbortController
- **Caching**: Prices stored in component state to avoid refetching

### Image Loading
- **Error Handling**: Images with failed loads are hidden gracefully
- **Consistent Sizing**: All images normalized to 160px × 160px
- **Border Radius**: Consistent `var(--border-radius-md)` for visual cohesion

### Modal Rendering
- **Conditional Rendering**: Modal only renders when `isOpen` is true
- **Portal Optimization**: Renders to document.body to avoid parent constraints
- **Event Handling**: Proper event propagation control with stopPropagation()

## 🔧 Common Issues & Solutions

### Issue: "No contract data" showing for all items
**Solution**: Verify Supabase function returns `contract_address` field (not `collection_address`)

### Issue: Prices not loading
**Solution**: Check `/api/nft-price` endpoint and ensure contract_address/token_id are valid

### Issue: Modal appearing behind elements
**Solution**: Ensure React Portal is used with `createPortal(content, document.body)`

### Issue: Images not displaying
**Solution**: Verify image URLs are accessible and add proper error handling

## 📱 Mobile Responsiveness

### Grid Adaptation
- **Desktop**: Two-column grid layout
- **Mobile**: Maintains two-column but with smaller gaps
- **Card Layout**: Horizontal layout works well on mobile with proper spacing

### Touch Interactions
- **Tap Targets**: All clickable elements have adequate touch target size
- **Hover States**: Converted to touch-friendly interactions on mobile
- **Scrolling**: Smooth scrolling within modal container

## 🔮 Future Enhancements

### Potential Improvements
- **Sorting Options**: Allow sorting by different metrics (price, votes, etc.)
- **Filtering**: Filter by collection or price range
- **Pagination**: Load more than 20 items with pagination
- **Price History**: Show price trends over time
- **Favorites Integration**: Mark leaderboard items as favorites
- **Export Functionality**: Export leaderboard data as CSV/JSON

### Technical Debt
- **Price Caching**: Implement Redis or localStorage caching for prices
- **Image Optimization**: Add lazy loading and WebP format support
- **API Rate Limiting**: Implement rate limiting for price API calls
- **Error Boundaries**: Add React Error Boundaries for better error handling

