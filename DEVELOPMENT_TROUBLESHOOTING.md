# Development Server Troubleshooting Guide

## ✅ LATEST: Build System Fixes (August 6, 2025)

**All TypeScript compilation errors have been resolved!**

### **Production Build Verification**
```bash
# Test the build locally (recommended before deploying)
npm run build

# Expected output:
✓ Compiled successfully in 24.0s
✓ Checking validity of types    
✓ Generating static pages (13/13)
```

### **Recently Fixed Build Errors**
The following syntax errors were identified and resolved:

1. **Missing Closing Braces** - Fixed in 6 files:
   - `src/components/WelcomePopup.tsx`
   - `src/hooks/useCollectionPreference.ts`  
   - `src/hooks/useSessionVotePurchase.ts`
   - `src/hooks/useSmartContractPrizeBreak.ts`
   - `src/hooks/useVote.ts`
   - `src/app/api/rewards/store/route.ts`

2. **Export Issues** - Fixed:
   - Added `export default StatusBar` to `StatusBar.tsx`
   - Added `export const votingPreloader` to `preloader.ts`

3. **Confetti Component** - Custom implementation:
   - Replaced library dependency with canvas-based solution
   - Zero external dependencies for confetti animation

### **Build Testing Strategy**
```bash
# Always test locally before pushing to Vercel
npm run build

# If build fails, check specific error files
# Fix syntax errors (usually missing braces/exports)
# Re-test until build passes
```

---

## Quick Start (The Right Way)

### Starting the Development Server
```bash
# Always ensure you're in the correct directory first
cd gugo-game-app

# Start the server (simple command)
npm run dev
```

## Common Issues and Solutions

### Issue 1: "Site Can't Be Reached" / Server Not Starting

**Symptoms:**
- Browser shows "site can't be reached"
- Terminal shows no dev server running

**Solution:**
```bash
# 1. Check if you're in the right directory
pwd
# Should show: /path/to/09 GUGO Hackathon/gugo-game-app

# 2. If not, navigate to the app directory
cd gugo-game-app

# 3. Kill any stuck processes
pkill -f "next.*dev"

# 4. Start fresh
npm run dev
```

### Issue 2: Server Keeps Getting Interrupted

**Symptoms:**
- Server starts but gets stopped with ^C
- Process keeps terminating unexpectally

**Solution:**
- **DO NOT** use complex command chaining with `&&` and `sleep`
- **DO NOT** run server in background unless absolutely necessary
- **USE** simple commands: `npm run dev`
- **WAIT** for compilation to complete (can take 20-30 seconds)

### Issue 3: Wrong Directory Errors

**Symptoms:**
```
npm error code ENOENT
npm error path .../09 GUGO Hackathon/package.json
```

**Solution:**
```bash
# Always check your current directory
pwd

# If you're in the wrong place, navigate correctly
cd gugo-game-app
```

### Issue 4: Shell Command State Issues

**Symptoms:**
- Terminal shows `cmdand dquote>` or incomplete prompts
- Commands appear stuck

**Solution:**
```bash
# Exit the current shell state
exit

# Or press Ctrl+C to cancel stuck commands
# Then restart normally
```

### Issue 5: Database Connection Errors (MAJOR FIX - August 2025)

**Symptoms:**
- "Invalid API key" errors in console
- All API endpoints returning 401/403 errors
- NFT count shows 0 or fails to load
- "Auth session missing!" errors

**Root Cause:** Expired Supabase API keys

**Solution:**
```bash
# 1. Get fresh API keys from Supabase dashboard
# Go to: Settings → API → Copy 'anon public' key

# 2. Update .env.local (replace old key):
sed -i '' 's/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIs[^"]*/your_fresh_api_key_here/' .env.local

# 3. Restart the server:
pkill -f "next.*dev"
npm run dev

# 4. Test connection:
curl -s "http://localhost:3000/api/check-nft-count"
# Should return: {"success":true,"nftCount":46615}
```

**Verification Commands:**
```bash
# Test specific endpoints:
curl -s "http://localhost:3000/api/simple-nft-test"
curl -s "http://localhost:3000/api/debug-rls"

# All should return success:true with data
```

## Best Practices

### ✅ DO:
- Use simple, direct commands
- Check your directory with `pwd` before running commands
- Let the server compile completely (20-30 seconds)
- Use `npm run dev` directly without complex chaining

### ❌ DON'T:
- Use overly complex command chains with `&&`, `sleep`, `curl` testing
- Run background processes unless necessary
- Interrupt the server during compilation
- Try to test server readiness with curl immediately

## Development Server Startup Process

1. **Navigation**: `cd gugo-game-app`
2. **Clean Start**: `pkill -f "next.*dev"` (if needed)
3. **Start Server**: `npm run dev`
4. **Wait for Ready**: Look for "✓ Ready in X.Xs"
5. **Wait for Compilation**: Look for "✓ Compiled / in X.Xs"
6. **Test in Browser**: Go to http://localhost:3000

## Expected Startup Logs

```
> gugo-game-app@0.1.0 dev
> next dev --turbopack

   ▲ Next.js 15.4.5 (Turbopack)
   - Local:        http://localhost:3000
   - Network:      http://192.168.4.26:3000
   - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 2.6s
 ○ Compiling / ...
 ✓ Compiled / in 24.3s
 GET / 200 in 26353ms
```

## When Server Is Running Successfully

You'll see:
- ✅ Successful compilation messages
- ✅ HTTP 200 responses
- ✅ API endpoints working (`/api/rewards/unclaimed`)
- ✅ Database queries returning data (46,615 NFTs)
- ✅ IPFS gateway health checks
- ✅ No "Invalid API key" errors
- ✅ No error messages in terminal

## Emergency Recovery

If everything is stuck:
```bash
# Kill all Node processes
pkill -f node

# Navigate to correct directory
cd /path/to/09\ GUGO\ Hackathon/gugo-game-app

# Fresh start
npm run dev
```

---

**Last Updated**: August 2025 (Major database connectivity fixes added)
**Key Lessons**: 
- Simple commands work better than complex automation
- Expired API keys are a common cause of database connection failures
- Always test API endpoints after key updates