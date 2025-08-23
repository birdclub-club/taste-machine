# 🤖 AI Agent Onboarding Guide - Taste Machine Project

**Last Updated**: August 2025  
**Purpose**: Complete context and guidelines for AI agents working on the Taste Machine NFT voting platform

## 🚨 CRITICAL: How to Access ALL NFTs in the Database

### ⚠️ **NEVER use direct table queries to find collections or NFTs!**

**❌ WRONG APPROACH (will miss most NFTs):**
```sql
-- These queries will return incomplete results!
SELECT DISTINCT collection_name FROM nfts LIMIT 10;
SELECT * FROM nfts WHERE collection_name = 'BEARISH' LIMIT 100;
```

**✅ CORRECT APPROACH - Use RPC Functions:**
```typescript
// Call the get_collection_statistics RPC function
const { data } = await supabase.rpc('get_collection_statistics');
```

### 📊 **Complete NFT Dataset (54,312 Total NFTs):**

**Your Priority Collections:**
- **BEARISH**: 4,690 NFTs (1,742 votes, 37% vote rate)
- **BEEISH**: 4,444 NFTs (2,436 votes, 55% vote rate) - MOST ACTIVE
- **Pengztracted**: 7,777 NFTs (1,975 votes, 25% vote rate)
- **Kabu**: 4,444 NFTs (1,500 votes, 34% vote rate)
- **DreamilioMaker**: 5,505 NFTs (28 votes, 1% vote rate)

**Other Collections:**
- **Final Bosu**: 8,888 NFTs (1,439 votes)
- **RUYUI**: 7,000 NFTs (1,263 votes)
- **Canna Sapiens**: 6,000 NFTs (1,769 votes)
- **Fugz**: 5,555 NFTs (711 votes)

### 🔍 **Why Direct Queries Fail:**
1. **Query Limits**: Supabase has default row limits that truncate results
2. **Pagination**: Large datasets require pagination that direct queries don't handle
3. **Collection Filtering**: Some queries have WHERE clauses that filter out collections
4. **RPC Functions**: The database uses optimized RPC functions for collection statistics

### 🎯 **How to Access NFT Data:**
```typescript
// Get all collection statistics
GET /api/rpc-collection-stats

// Or call RPC directly in code:
const { data: collections } = await supabase.rpc('get_collection_statistics');
```

**Total NFTs with votes: 12,863 across 9 active collections**

## 🔄 **Event-Driven Vote Processing System (NEW)**

### **✅ Migration Complete (January 2025)**
All historical voting data has been successfully migrated to the new efficient event-driven system:

- **6,977 NFTs migrated** (all NFTs with voting history)
- **22,902 vote events migrated** from 9 collections
- **Zero data loss** - Complete historical preservation
- **100% migration success rate**

### **📊 How the New System Works:**

#### **1. Vote Ingestion Pipeline**
```typescript
// New votes automatically flow through event tables:
votes_events    // Head-to-head voting events (22,902 migrated)
sliders_events  // Aesthetic rating events (included in migration)
fires_events    // Fire/boost events (included in migration)
```

#### **2. Real-Time Processing**
- **New votes** → Automatically inserted into event tables via vote ingestion service
- **Historical votes** → Already migrated to event tables (complete)
- **POA computation** → Processes events from unified pipeline
- **Performance** → Dramatically improved (no more table timeouts)

#### **3. Efficient Architecture**
- **Before**: Direct queries to massive `votes` table (slow, timeouts)
- **After**: Event-driven pipeline with proper indexing (fast, scalable)

### **🔍 How to Verify System Health:**

#### **Check Migration Status:**
```typescript
// Verify event counts match expectations
GET /api/admin/migration-status

// Expected results:
// - votes_events: ~22,902 records
// - All 9 collections represented
// - No missing NFTs with voting history
```

#### **Test Vote Processing:**
```typescript
// Submit a test vote and verify it appears in events
POST /api/vote-submission
// Then check: SELECT * FROM votes_events ORDER BY created_at DESC LIMIT 1;
```

#### **Monitor Performance:**
```typescript
// These should be fast (< 1 second):
GET /api/nft-scores          // POA score retrieval
GET /api/collection-stats    // Collection statistics
POST /api/compute-poa-batch  // Batch POA computation
```

### **🚨 Migration Troubleshooting:**

#### **If Vote Events Are Missing:**
1. Check if collection was included in migration
2. Verify NFT has `total_votes > 0` in `nfts` table
3. Run collection-specific migration endpoint:
   ```typescript
   POST /api/migrate-[collection-name]-collection
   ```

#### **If New Votes Aren't Processing:**
1. Check vote ingestion service is enabled
2. Verify event tables have proper permissions
3. Test with: `POST /api/test-vote-ingestion`

## 🎯 Project Overview

**Taste Machine** is a sophisticated NFT aesthetic voting platform where users vote on NFT matchups to earn rewards. The platform features dynamic theming, responsive design, and a complex reward system with prize breaks every 10 votes.

### Core Concept
- Users vote between two NFTs in head-to-head matchups
- Votes are called "Licks" - users can purchase more or get free daily votes
- Every 10 votes triggers a "Prize Break" with XP, GUGO tokens, or other rewards
- Platform uses dynamic color palettes that change on each landing page visit
- Swiss-inspired minimalist design with "PROOF OF AESTHETIC™" branding

## 🏗️ Architecture & Design System

### Container Architecture (CRITICAL)
The layout uses a **unified container system**:

```
Status Bar (compact, 45px height)
↓
Colossal Text Container (full viewport below status bar)
├── "PROOF OF" (top-left corner)
├── "AES THETIC™" (bottom-right corner)
├── Matchup Interface (centered)
└── Bottom Info Text (centered at bottom)
```

### Responsive Design Rules
- **NFT Cards**: Scale with viewport using `clamp(300px, 25vw, 500px)`
- **Spacing**: Dynamic using `clamp(var(--space-4), 4vw, var(--space-8))`
- **Mobile Breakpoint**: 900px (not 768px)
- **Desktop-first approach** for matchup interface, mobile gets slider

### Color System (ESSENTIAL)
- **Dynamic CSS Variables**: `--dynamic-bg-color`, `--dynamic-text-color`, `--dynamic-accent-color`
- **15 Color Palettes**: Randomly selected on landing page, propagated globally
- **NO hardcoded colors** - everything must use CSS variables
- **Theme consistency** across all components

## 🎨 Typography & Branding

### Font Hierarchy
- **Primary**: Neue Haas Unica (Adobe Typekit) - titles, landing page
- **Secondary**: King's Caslon Regular - body text
- **Colossal Text**: "PROOF OF" (top-left), "AES THETIC™" (bottom-right)
- **Status Bar**: "TASTE MACHINE" branding

### Swiss Design Principles
- Minimalist aesthetic inspired by 60s-70s Swiss graphic design
- Clean typography with precise positioning
- Functional, uncluttered layouts
- Emphasis on negative space and proportion

## 🔧 Technical Implementation Rules

### Performance Optimization (CRITICAL)
The platform uses an **Enhanced System** for optimal performance:

1. **Preloading Strategy**
   - Always preload next 3-5 matchups in background
   - Use IPFS gateway rotation for failed images
   - Implement retry logic with exponential backoff

2. **Database Optimization**
   - Enhanced system reduces database calls by 80%
   - Batch operations where possible
   - Use connection pooling and query optimization

3. **Image Loading**
   - Multiple IPFS gateways with health checking
   - Fallback mechanisms for failed loads
   - Lazy loading for non-critical images

### State Management
- **Voting Sessions**: Managed via `useSessionKey` hook
- **Prize Breaks**: Triggered every 10 votes, managed by `usePrizeBreak`
- **User State**: Centralized in StatusBar with refresh capabilities
- **Matchup State**: Preloaded and cached for smooth transitions

## 🎮 User Experience Flow

### Voting Interface
1. **Desktop**: Click-to-vote (no slider)
2. **Mobile**: Retains slider functionality for better touch experience
3. **Super Votes**: Fire button (🔥) for exceptional NFTs
4. **NO Button**: Appears after 3 seconds if user doesn't vote

### Prize Break System
- **Frequency**: Every 10 votes
- **Types**: XP, GUGO tokens, votes, visual effects
- **Modal**: Card flip animation with dynamic content
- **Treasury-scaled odds**: Higher treasury = better rewards

### Matchup Selection Logic
- **Cross-collection** and **same-collection** voting
- **User preferences** for collection filtering
- **Balanced rotation** to ensure variety
- **Preloading** for seamless experience

## 📋 Essential Documents to Read

### Primary Documentation (READ FIRST)
1. **`RECENT_UI_UPDATES_DOCUMENTATION.md`** - Complete UI/UX changes and implementation
2. **`Areas for Improvement.md`** - Known issues, technical debt, and optimization opportunities
3. **`migrations/45-performance-boost-enhanced-system.sql`** - Database schema and enhanced system

### Component Documentation
4. **`src/components/MatchupCard.tsx`** - Core voting interface (1000+ lines)
5. **`src/components/StatusBar.tsx`** - Main navigation and user state (2000+ lines)
6. **`src/hooks/usePrizeBreak.ts`** - Prize break logic and state management
7. **`src/hooks/useSessionKey.ts`** - Session management and authentication

### Configuration Files
8. **`src/app/globals.css`** - Global styles, responsive design, CSS variables
9. **`lib/matchup.ts`** - Matchup fetching and selection logic
10. **`lib/preloader.ts`** - Image preloading and IPFS gateway management

## ⚠️ Critical Rules & Guidelines

### DO NOT Break These Rules

1. **Container Structure**: Never modify the colossal text container architecture without understanding the full layout system

2. **CSS Variables**: Always use `--dynamic-*` variables, never hardcode colors

3. **Mobile Responsiveness**: Test all changes at 900px breakpoint and below

4. **Performance**: Maintain the enhanced system - any changes must not increase database load

5. **Typography**: Preserve Swiss design principles and font hierarchy

6. **Image Loading**: Always implement proper error handling and fallbacks

### Memory Preferences (IMPORTANT)
- **User prefers Cursor's GitHub integration** over manual git commands
- **Don't commit after every change** - only for critical fixes
- **Keep development server running** - don't stop it when making changes
- **NO votes count as aesthetic feedback** - they're valuable data
- **Debug borders are temporary** - remove before production

## 🚀 Development Workflow

### Before Making Changes
1. **Read relevant documentation** from the list above
2. **Understand the container architecture** and how your changes fit
3. **Check responsive behavior** at different screen sizes
4. **Consider performance impact** on the enhanced system

### Testing Checklist
- [ ] Desktop voting interface works correctly
- [ ] Mobile slider functionality preserved
- [ ] All color palettes display properly
- [ ] Prize breaks trigger at correct intervals
- [ ] Image loading handles failures gracefully
- [ ] Status bar remains compact and functional
- [ ] Colossal text positioning is preserved

### Code Quality Standards
- **TypeScript**: Proper typing for all components and hooks
- **Error Handling**: Comprehensive error boundaries and fallbacks
- **Performance**: Minimize re-renders and database calls
- **Accessibility**: Maintain WCAG compliance across color palettes
- **Mobile-First**: Ensure touch-friendly interactions

## 🔍 Key Systems to Understand

### Enhanced Database System
- **Purpose**: Reduces database load by 80% through intelligent caching
- **Implementation**: See `migrations/45-performance-boost-enhanced-system.sql`
- **Impact**: Critical for platform scalability and performance

### Dynamic Color System
- **15 Palettes**: Randomly selected on landing page load
- **Global Propagation**: CSS variables set at root level
- **Component Integration**: All components must use dynamic variables

### Prize Break Mechanics
- **Treasury-Scaled Odds**: Rewards improve with larger treasury
- **Types**: XP (base), GUGO tokens (rare), votes, visual effects
- **User Experience**: Card flip animation with celebration effects

### Matchup Intelligence
- **Preloading**: Next 3-5 matchups loaded in background
- **Collection Balance**: Mix of cross-collection and same-collection votes
- **User Preferences**: Respects user's collection filtering choices

## 🎯 Optimization Priorities

### Performance (Highest Priority)
1. Maintain enhanced system efficiency
2. Optimize image loading and caching
3. Minimize database queries
4. Reduce bundle size where possible

### User Experience
1. Smooth voting transitions
2. Responsive design consistency
3. Proper error handling and feedback
4. Accessibility across all color palettes

### Code Quality
1. TypeScript coverage and type safety
2. Component modularity and reusability
3. Comprehensive error boundaries
4. Clean, maintainable architecture

## 🚨 Common Pitfalls to Avoid

1. **Breaking Container Architecture**: The colossal text container is foundational
2. **Hardcoding Colors**: Always use CSS variables for theming
3. **Performance Regression**: Don't add unnecessary database calls
4. **Mobile Breakage**: Always test responsive behavior
5. **Image Loading Issues**: Implement proper fallbacks and error handling
6. **State Management**: Don't bypass existing hooks and state patterns

## 📞 Emergency Debugging

### If Things Break
1. **Check browser console** for TypeScript/React errors
2. **Verify CSS variables** are properly set and propagating
3. **Test image loading** with different IPFS gateways
4. **Check database connections** and query performance
5. **Validate responsive breakpoints** at 900px threshold

### Performance Issues
1. **Monitor database query count** - should be minimal with enhanced system
2. **Check image preloading** - ensure next matchups are ready
3. **Verify CSS efficiency** - avoid expensive selectors and animations
4. **Test memory usage** - prevent memory leaks in long sessions

---

## 🚨 **CRITICAL: Preloader Cache & Collection Management**

### ⚠️ **Known Issue: Stale Cache Problem**

**Problem**: The preloader can serve cached sessions from disabled collections for extended periods (weeks).

**Root Cause**: No cache invalidation when collection status changes in `collection_management` table.

**Example**: Fugz collection was disabled for a week but still appeared in matchups due to cached sessions.

### 🔍 **How to Diagnose Cache Issues:**

1. **Check collection status**:
```bash
curl -s "http://localhost:3000/api/debug-collection-status"
```

2. **Test collection filtering logic**:
```bash
curl -s "http://localhost:3000/api/debug-preloader-collection-filtering"
```

3. **Look for these symptoms**:
   - Disabled collections appearing in matchups
   - Collection filtering working in tests but not in UI
   - Old NFTs appearing despite recent collection changes

### 🔧 **Emergency Cache Clear Solution:**

If disabled collections appear in matchups, run this in browser console:

```javascript
// Emergency cache invalidation
localStorage.clear();
sessionStorage.clear();
if (window.votingPreloader) {
  window.votingPreloader.clearAllSessions();
}
console.log('Cache cleared - hard refresh now');
```

Then **hard refresh** (Cmd+Shift+R).

### 📋 **Collection Management Status:**

**Active Collections** (as of August 2025):
- BEEISH, Kabu, Pengztracted, Final Bosu, BEARISH, Canna Sapiens

**Disabled Collections**:
- RUYUI, Fugz, DreamilioMaker, Bearish, Test Collection

### 🛠️ **Future Fix Needed:**

**TODO**: Implement cache versioning system that:
1. Detects collection status changes
2. Automatically invalidates preloader cache
3. Prevents serving stale sessions from disabled collections

**Priority**: High - prevents user confusion and maintains collection management integrity.

---

## 🎉 Welcome to the Team!

This platform represents months of careful optimization, design iteration, and performance tuning. Every component has been thoughtfully crafted to work together as a cohesive system. 

**Take time to understand the architecture before making changes.** The enhanced system, dynamic theming, and responsive design are all interconnected - changes in one area can have cascading effects.

**When in doubt, refer to the documentation and existing patterns.** The codebase contains many examples of proper implementation that you can follow.

**Good luck, and happy coding!** 🚀

---

*This guide should be updated whenever significant architectural changes are made to the platform.*
