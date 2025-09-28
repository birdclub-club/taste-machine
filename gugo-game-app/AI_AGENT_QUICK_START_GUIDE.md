# 🚀 AI Agent Quick Start Guide - Taste Machine Project

**Date**: August 21, 2025  
**Purpose**: Essential onboarding context for AI agents working on the Taste Machine NFT voting platform

---

## 📋 **Project Overview**

**Taste Machine** is a sophisticated NFT voting platform where users vote on aesthetic preferences between NFT pairs. The system features:

- **54,312 NFTs** across 9 collections (6 active, 3 disabled)
- **Advanced matchup engine** with progressive discovery and duplicate prevention
- **Prize system** with treasury-scaled GUGO token rewards
- **Real-time voting** with XP, vote multipliers, and prize breaks
- **Swiss design aesthetic** with dynamic theming and responsive UI

---

## 🚨 **CRITICAL RULES - READ FIRST**

### 1. **Database Access Rules**
```typescript
// ❌ NEVER use direct table queries - they miss most NFTs!
SELECT * FROM nfts WHERE collection_name = 'BEARISH' LIMIT 100;

// ✅ ALWAYS use RPC functions for complete data
const { data } = await supabase.rpc('get_collection_statistics');
```

### 2. **Collection Management Rules**
- **6 Active Collections**: BEEISH, Kabu, Pengztracted, Final Bosu, BEARISH, Canna Sapiens
- **3 Disabled Collections**: RUYUI, Fugz, DreamilioMaker
- **Cache Issue**: Disabled collections can appear due to stale preloader cache
- **Solution**: Emergency cache clear + hard refresh when needed

### 3. **Code Quality Rules**
- **Keep dev server running** - don't stop it during changes
- **No commits by default** - only commit critical fixes
- **Use Cursor's GitHub integration** - no manual git commands
- **Preserve existing patterns** - the system is highly optimized

---

## 🔧 **Latest Critical Fixes (August 2025)**

### ✅ **Resolved Issues:**
1. **Preloader Crash**: Fixed `this.refillStack is not a function` error during prize breaks
2. **Fugz Bug**: Resolved disabled Fugz collection appearing in matchups (cache issue)
3. **Framer Motion Errors**: Fixed animation controls mounting issues
4. **Duplicate Prevention**: Enhanced system working correctly
5. **Progressive Discovery**: 75% boost for zero-vote NFTs operational

### ⚠️ **Ongoing Issues:**
- Database 500 errors on `get_collection_statistics` (intermittent)
- IPFS gateway timeouts (affects some image loading)
- Need cache versioning system (high priority TODO)

---

## 🛠️ **System Health Checks**

### **1. Database NFT Count Verification**
```bash
# Check total NFT count (should be 54,312)
curl -s "http://localhost:3000/api/rpc-collection-stats" | jq '.[] | select(.collection_name) | .nft_count' | paste -sd+ - | bc

# Verify collection status
curl -s "http://localhost:3000/api/debug-collection-status"
```

### **2. Preloader Health Check**
```bash
# Test preloader functionality
curl -s "http://localhost:3000/api/debug-preloader-collection-filtering"

# Check for cache issues (disabled collections appearing)
# Look for Fugz, RUYUI, or DreamilioMaker in results
```

### **3. Enhanced Matchup Engine Check**
```javascript
// In browser console - check for progressive discovery
console.log('Checking matchup weights...');
// Look for zero-vote NFTs getting 75% boost in matchup selection
```

### **4. Cache System Check**
```javascript
// Browser console - verify cache is working
if (window.votingPreloader) {
  console.log('Preloader sessions:', window.votingPreloader.sessions?.size || 0);
  console.log('Cache healthy:', window.votingPreloader.sessions?.size > 0);
}
```

---

## 📚 **Required Reading List (In Order)**

### **Phase 1: Core Understanding**
1. **`AI_AGENT_ONBOARDING_GUIDE.md`** - Complete system overview and critical warnings
2. **`NFT_DATABASE_ACCESS_GUIDE.md`** - Database access patterns and RPC functions
3. **`RECENT_FIXES_DOCUMENTATION.md`** - Latest fixes and current system status

### **Phase 2: Technical Deep Dive**
4. **`src/lib/enhanced-matchup-engine.ts`** - Core voting logic and progressive discovery
5. **`src/lib/preloader.ts`** - Session management and caching system
6. **`src/components/VotingInterface.tsx`** - Main UI component structure

### **Phase 3: Architecture Understanding**
7. **`src/app/api/`** directory - API endpoints and database interactions
8. **`src/lib/supabase.ts`** - Database configuration and RPC setup
9. **`src/styles/`** directory - Swiss design system and theming

---

## 🎯 **Key System Components**

### **Enhanced Matchup Engine**
- **Progressive Discovery**: 75% boost for zero-vote NFTs
- **Duplicate Prevention**: System-wide tracking prevents repeat pairs
- **Cold Start Rotation**: 25% of sessions dedicated to unseen NFTs
- **Dynamic Weights**: Adjusts based on NFT vote history

### **Preloader System**
- **Session Management**: Pre-generates voting sessions for smooth UX
- **Image Preloading**: Ensures next matchups load instantly
- **Cache Persistence**: Sessions cached in localStorage (can cause stale data)
- **Collection Filtering**: Excludes disabled collections (when cache is fresh)

### **Prize System**
- **Treasury-Scaled Odds**: GUGO prize chances increase with treasury size
- **Prize Breaks**: Every 10 votes triggers reward calculation
- **XP System**: Base +10 XP, bonus +20 XP, vote multipliers
- **GUGO Rewards**: 600-25,000 GUGO based on treasury tier

---

## 🚨 **Emergency Procedures**

### **If Disabled Collections Appear:**
```javascript
// Emergency cache clear (browser console)
localStorage.clear();
sessionStorage.clear();
if (window.votingPreloader) window.votingPreloader.clearAllSessions();
// Then hard refresh (Cmd+Shift+R)
```

### **If Database Errors Occur:**
```bash
# Check RPC function health
curl -s "http://localhost:3000/api/rpc-collection-stats"

# If 500 errors persist, check Supabase dashboard
# May need to restart database connection pool
```

### **If Preloader Crashes:**
```bash
# Check for TypeError in console
# Usually indicates method name mismatch
# Refer to RECENT_FIXES_DOCUMENTATION.md for patterns
```

---

## 🎨 **Design System Rules**

- **Swiss Minimalism**: Black, white, grey, cream + accent green
- **No Emojis in Prices**: Keep financial displays clean
- **1:1 Aspect Ratio**: All NFT images displayed square
- **Halftone Elements**: Use for visual texture and depth
- **Status Bar**: Always show wallet connection and balances
- **Hero Text**: "Proof of aesthetic. Cast votes. Move markets. Earn from your eye."

---

## 🔍 **Before Making Any Changes**

1. **Read the required documents** (especially the onboarding guide)
2. **Run health checks** to understand current system state
3. **Test in browser** to see actual user experience
4. **Check for existing patterns** in the codebase
5. **Understand the enhanced system** before modifying core logic

---

## ⚡ **Quick Commands Reference**

```bash
# Start development server
npm run dev

# Check system health
curl -s "http://localhost:3000/api/debug-collection-status"
curl -s "http://localhost:3000/api/rpc-collection-stats"

# Emergency cache clear API
curl -s -X POST "http://localhost:3000/api/force-preloader-cache-invalidation"

# Check collection filtering
curl -s "http://localhost:3000/api/debug-preloader-collection-filtering"
```

---

## 🎯 **Success Metrics**

**System is healthy when:**
- ✅ 54,312 NFTs accessible via RPC functions
- ✅ Only 6 active collections appear in matchups
- ✅ Preloader generates sessions without crashes
- ✅ Prize breaks execute without errors
- ✅ No Framer Motion console errors
- ✅ Database queries return within reasonable time

**Red flags:**
- ❌ Fugz, RUYUI, or DreamilioMaker appear in voting
- ❌ TypeError crashes in preloader
- ❌ Database 500 errors persist
- ❌ Animation mounting errors in console

---

**Remember**: This is a sophisticated, highly-optimized system. Take time to understand before changing. When in doubt, refer to the documentation and existing patterns! 🚀

