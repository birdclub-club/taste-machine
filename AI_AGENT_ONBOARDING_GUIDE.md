# 🤖 AI Agent Onboarding Guide - Taste Machine

**Project**: Taste Machine - Swiss Minimalist NFT Aesthetic Voting Game  
**Last Updated**: January 2025  
**Target**: AI Agents beginning work on this codebase

## 📋 Project Overview

### What is Taste Machine?
Taste Machine is a sophisticated blockchain-powered NFT aesthetic voting game built on Abstract Chain. Users vote on NFT aesthetics through an elegant, Swiss-inspired minimalist interface. The platform features dynamic color palettes, real-time price integration, and a comprehensive reward system.

### Core Philosophy
- **Swiss Minimalism**: Clean, professional design inspired by 1960s-70s Swiss graphic design
- **Dynamic Theming**: 15 randomized color palettes that propagate throughout the entire application
- **Mobile-First**: Responsive design optimized for all screen sizes
- **User Experience**: Smooth animations, intuitive interactions, and seamless wallet integration

## 🎯 Latest Major Updates (January 2025)

### 🎨 Complete UI/UX Restoration & Enhancement
- **Slider Module Restoration**: Full-screen mouse tracking with dynamic color meter, matchup-style NFT cards, smooth easing animations
- **Prize Break Modal Overhaul**: Card flip animation, "Reward incoming..." loading state, dynamic duck image selection, linear marquee scrolling
- **Purchase Alert Redesign**: Dynamic color palette styling, shine animation effects, integrated with Licks purchasing modal
- **Image Loading Optimization**: IPFS gateway management, robust error handling, preloader performance tuning

### 🏆 Fire List & Leaderboard Enhancements  
- **Magic Eden Integration**: "Make Offer" links with hover effects, live price fetching with fallback contract addresses
- **Dynamic Text Colors**: All modal text now uses `var(--dynamic-text-color)` for consistent theming
- **Improved Contrast**: Close button styling with proper background/foreground contrast
- **Data Consistency**: Unified field mapping between Fire List and Leaderboard for reliable price fetching

### 🎯 Modal System & Animation Fixes
- **React Portals**: All modals use `createPortal(content, document.body)` for proper z-index layering
- **Framer Motion Stability**: Fixed "controls.start() before mount" errors with proper initialization guards
- **Page Refresh Flash Fix**: Eliminated default color flash on refresh with proper SSR/CSR handling
- **Session Flow Optimization**: Removed redundant session prompts, dynamic button text based on session state

### 🔄 Matchup Variety & Performance Optimization
- **Duplicate Prevention**: 5x improved tracking (500 pairs vs 100, 200 NFTs vs 50) for significantly better variety
- **Preloader Enhancement**: 2.5x larger session stack (20 vs 8) with earlier refill triggers (6 vs 3 remaining)
- **Memory Management**: 3x increased recent pair tracking (1500 vs 500) in Enhanced Matchup Engine
- **Performance**: Optimized parallel loading (4 vs 3) and faster background refill during prize breaks
- **Debug Monitoring**: Added duplicate detection logging and manual reset capabilities

### 👥 User Leaderboard System
- **Dual Interface**: Tabbed leaderboard with "NFTs" and "Users" sections for comprehensive rankings
- **Taste Level System**: 11-tier progression (Novice Taster → Aesthetic Deity) based on XP with color coding
- **Voting Streaks**: Consecutive day tracking with fire emoji indicators and dynamic color coding
- **Comprehensive Stats**: XP, total votes, daily averages, account age, all displayed inline
- **API Integration**: New `/api/user-leaderboard` endpoint with streak calculation and taste level logic
- **Magic Eden Links**: "Make Offer" functionality for both NFT and User leaderboards with hover effects

### 🚨 Critical Image Loading Crisis Resolution
- **Catastrophic Failure Fix**: Resolved infinite refresh loops caused by aggressive 500ms timeouts
- **Gateway Upgrade**: Migrated from 4 HTTP to 8 HTTPS gateways for universal network compatibility
- **Timeout Optimization**: Increased from 500ms to 3000ms for reliable IPFS loading
- **Retry Logic Enhancement**: Expanded from 2 to 4 gateway attempts with proper fallback chains
- **Infinite Loop Prevention**: Added retry counters (max 3) to prevent recursive session generation
- **CDN Integration**: Added Cloudflare, Web3.Storage, and NFT.Storage gateways for global performance

### 🔧 Technical Infrastructure Improvements
- **TypeScript Error Resolution**: Fixed error handling, type definitions, and missing property issues
- **Build System Optimization**: Resolved missing file dependencies, proper git tracking of utility functions
- **Component Architecture**: Enhanced error boundaries, proper cleanup, and mount/unmount handling
- **Gateway Health Management**: More forgiving 30% success threshold, better debugging and monitoring

## 🏗️ Architecture & Key Systems

### Dynamic Color System
- **Landing Page**: Randomly selects from 15 predefined color palettes on each load (expanded from 10)
- **CSS Variables**: `--dynamic-bg-color`, `--dynamic-text-color`, `--dynamic-accent-color`
- **Propagation**: Colors set on landing page propagate to main app via CSS variables
- **Components**: All components use dynamic variables instead of hardcoded colors
- **New Palettes**: Added 5 additional color combinations for greater variety

### Animation Flow (CRITICAL)
1. **Landing Page**: User must visit `/landing` first to set color palette
2. **Exit Animation**: Landing page elements slide out to the right
3. **Transition**: 300ms delay before navigating to main page
4. **Main Page Entry**: Elements slide in from right (PROOF OF, AESTHETIC, Powered by GUGO)
5. **Status Bar**: Slides down from top after 2-second delay with easing

### Enhanced Voting System
- **Smart Logic**: AI-powered NFT selection for optimal learning
- **Session Types**: same_coll, cross_coll, slider with enhanced vs legacy modes
- **Preloader**: Stack-based system with 15+ sessions ready for instant access
- **Performance**: 70% legacy ratio for speed, 30% enhanced for quality

## 📚 Essential Documentation (READ FIRST)

### Primary Documents
1. **`README.md`** - Project overview and feature summary
2. **`RECENT_UI_UPDATES_DOCUMENTATION.md`** - Comprehensive UI changes and styling
3. **`LEADERBOARD_TECHNICAL_DOCUMENTATION.md`** - Detailed leaderboard implementation
4. **`API_DOCUMENTATION.md`** - API endpoints and data structures
5. **`UI_DESIGN_SYSTEM.md`** - Design principles and component guidelines

### Technical References
6. **`VOTING_SYSTEM_TROUBLESHOOTING.md`** - Voting mechanics and debugging
7. **`MUSIC_SYSTEM_DOCUMENTATION.md`** - Audio controls and implementation
8. **`ADMIN_DOCUMENTATION.md`** - Admin features and management
9. **`PROJECT_OVERVIEW.md`** - High-level architecture and goals
10. **`DEVELOPMENT_TROUBLESHOOTING.md`** - Common issues and solutions

### Migration & Setup
11. **`migrations/README.md`** - Database schema and migration history
12. **`DEVELOPER_SETUP_GUIDE.md`** - Local development setup
13. **`contracts/WALLET_SETUP_GUIDE.md`** - Blockchain integration setup

## ⚠️ Critical Rules & Guidelines

### 🎨 Design System Rules
- **NEVER** use hardcoded colors - always use CSS variables (`--dynamic-bg-color`, `--dynamic-text-color`, `--dynamic-accent-color`)
- **ALWAYS** test with multiple color palettes by refreshing landing page
- **Swiss Typography**: Use Neue Haas Unica (primary) and King's Caslon Regular (secondary)
- **No Emojis in Prices**: Keep pricing displays clean and professional
- **1:1 Aspect Ratio**: Display all NFT images at consistent aspect ratios

### 🔧 Technical Requirements
- **Landing Page First**: Users MUST visit landing page on refresh to set color palette
- **React Portals**: All modals MUST use `createPortal(content, document.body)`
- **Z-Index**: Use `999999` with `isolation: 'isolate'` for modals
- **Animation Timing**: Maintain precise timing for landing→main page transition
- **Mobile Responsive**: Test all changes on mobile breakpoints

### 🎯 User Experience Rules
- **Wallet Required**: No anonymous voting - users must connect wallet
- **Smooth Animations**: All transitions should use `cubic-bezier` easing
- **Error Handling**: Graceful fallbacks for all API failures
- **Loading States**: Show loading indicators for all async operations
- **Accessibility**: Maintain proper contrast ratios and touch targets

## 🧠 Key Technical Concepts

### Enhanced System Optimization
- **Performance Balance**: 70% legacy (fast) vs 30% enhanced (quality) ratio
- **Session Preloading**: Maintain 15+ sessions in stack for instant access
- **Smart Selection**: Enhanced mode uses AI logic for optimal NFT pairing
- **Fallback Strategy**: Always have legacy fallback for enhanced timeouts

### Dynamic Theming Implementation
```css
/* Correct approach */
background: 'var(--dynamic-text-color)'
color: 'var(--dynamic-bg-color)'

/* WRONG - never hardcode */
background: '#2a2a2a'
color: '#ffffff'
```

### CSS Mask for Icons
```css
/* Dynamic icon coloring */
backgroundColor: 'var(--dynamic-text-color)',
WebkitMask: 'url(/icon.png) center/contain no-repeat',
mask: 'url(/icon.png) center/contain no-repeat'
```

### Modal Portal Pattern
```typescript
return createPortal(
  <div style={{ 
    zIndex: 999999, 
    isolation: 'isolate',
    paddingTop: '80px' 
  }}>
    {/* Modal content */}
  </div>,
  document.body
);
```

## 🎮 Core Features & Mechanics

### Voting System
- **Three Types**: VS/NO buttons, Slider voting, Fire votes (favorites)
- **Rewards**: XP, GUGO tokens, NFTs based on engagement
- **Daily Licks**: 10 free votes daily with guaranteed rewards every 10-20 votes
- **Prize Breaks**: Treasury-scaled rewards with increasing odds

### Leaderboard & Rankings
- **Fire-First Algorithm**: NFTs with fire votes prioritized in rankings
- **POA Score**: Proof of Aesthetic scoring based on multiple factors
- **Magic Eden Integration**: Live price fetching and marketplace links
- **Dynamic Display**: Adapts to current color palette

### Wallet Integration
- **RainbowKit**: Wallet connection with custom theming
- **Abstract Chain**: Primary blockchain with testnet support
- **Session Management**: Secure session handling with renewal prompts
- **Balance Display**: Real-time ETH and GUGO token balances

## 🚨 Common Pitfalls to Avoid

### Animation Issues
- **Never** skip landing page - breaks color palette system
- **Always** maintain precise timing for smooth transitions
- **Don't** modify animation keyframes without testing full flow
- **Framer Motion**: Always check component mount state before calling `controls.start()`

### Styling Problems
- **Never** use fixed colors that don't adapt to themes
- **Always** test with different color palettes
- **Don't** assume white/black - use dynamic variables
- **Purchase Alerts**: Use dynamic CSS variables and React Portals for consistency

### Modal Z-Index Issues
- **Never** rely on CSS z-index alone - use React Portals
- **Always** render modals to document.body
- **Don't** nest modals within transformed elements
- **Prize Break**: Ensure proper z-index layering for trailing images

### Data Field Confusion
- **Use** `contract_address` not `collection_address` for leaderboard
- **Verify** field names match Supabase function returns
- **Test** API integrations with actual data
- **Fallback Contracts**: Implement hardcoded contract mappings for known collections

### Image Loading Issues
- **IPFS Gateways**: Use HTTPS for compatibility, 8 gateways including Cloudflare CDN
- **Error Handling**: Implement retry logic with 4 gateway attempts and 3-second timeouts
- **Preloader Settings**: Balance performance vs quality (30% enhanced, 70% legacy)
- **Infinite Loops**: Prevent recursive session generation with retry limits (max 3 attempts)

### Matchup Variety Issues
- **Repeat NFTs**: Increase `TARGET_STACK_SIZE` (20), `MAX_SEEN_NFTS` (200), `MAX_SEEN_PAIRS` (500)
- **Memory Management**: Boost `MAX_RECENT_PAIRS` (1500) in Enhanced Matchup Engine
- **Debug Monitoring**: Watch for `🔄 Duplicate pair detected` logs
- **Manual Reset**: Use `clearDuplicateTracking()` if experiencing excessive repeats

### User Leaderboard Issues
- **Missing Data**: Use optional chaining (`user.taste_level?.name || 'Unknown'`)
- **Layout Problems**: Apply `flexShrink: 0` and proper `minWidth` values
- **Color Contrast**: Use `var(--dynamic-bg-color, var(--color-white))` for visibility
- **Streak Display**: Show dash (`—`) with reduced opacity when no streak exists

## 🔍 Debugging & Development

### Essential Console Logs
- Look for `🔍`, `💰`, `🎯`, `✅`, `❌` prefixed logs
- Enhanced system logs show success rates and performance
- Price fetching logs show API response times and status

### Testing Checklist
1. **Color Palette**: Refresh landing page, test multiple palettes
2. **Animations**: Landing→Main transition timing and smoothness
3. **Modals**: All popups appear above other elements
4. **Mobile**: Test responsive design on various screen sizes
5. **Wallet**: Connect/disconnect flows work properly
6. **Prices**: Leaderboard price fetching functions correctly

### Performance Monitoring
- **Session Stack**: Should maintain 15+ preloaded sessions
- **Enhanced Ratio**: Monitor 70/30 legacy/enhanced split
- **API Response Times**: Price fetching should complete within 15s
- **Animation Frame Rate**: Smooth 60fps animations

## 🎯 Success Metrics

### User Experience
- **Smooth Animations**: No janky transitions or abrupt cuts
- **Consistent Theming**: All elements adapt to color palette
- **Responsive Design**: Works perfectly on all device sizes
- **Fast Loading**: Instant session access, quick price fetching

### Technical Performance
- **Enhanced Success Rate**: >70% enhanced session generation
- **Modal Functionality**: All popups render correctly
- **API Reliability**: Graceful handling of failures
- **Color Consistency**: Dynamic theming works across all components
- **Matchup Variety**: Minimal duplicate NFTs/pairs, diverse collection mixing
- **Stack Management**: 20+ sessions preloaded, 8+ minimum maintained
- **User Leaderboard**: All data displays correctly, proper alignment and contrast
- **Image Loading**: No placeholder images, no infinite refresh loops, <3s load times
- **Gateway Health**: 8/8 HTTPS gateways operational, automatic failover working

## 🚀 Getting Started Checklist

Before writing any code:
- [ ] Read all essential documentation listed above
- [ ] Understand the dynamic color system and CSS variables
- [ ] Test the landing→main page animation flow
- [ ] Examine the leaderboard implementation as a reference
- [ ] Review the modal portal pattern in existing components
- [ ] Understand the enhanced vs legacy voting system balance
- [ ] Test with multiple color palettes to ensure compatibility
- [ ] Verify wallet connection and blockchain integration works

Remember: **Always start on the landing page** - this is crucial for the entire user experience and color system to function properly!

