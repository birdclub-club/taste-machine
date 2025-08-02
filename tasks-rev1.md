
# ✅ MVP Build Plan — Gugo Game (Mobile-Optimized)

---

## 🔧 SETUP

### 1. **Initialize Next.js project**
- **Start**: Run `npx create-next-app@latest gugo-game-app`
- **End**: App runs on `localhost:3000`

### 2. **Install required dependencies**
- **Start**: Open terminal in root directory
- **End**: Installed:
  - `ethers`
  - `@supabase/supabase-js`
  - `tailwindcss` + setup
  - `@abstract-wallet/sdk-react`
- **Test**: Run `npm run dev` and see default page

### 3. **Set up Tailwind CSS styling** 🔶 *Mobile UX critical*
- **Start**: Follow official Tailwind CSS Next.js guide
- **End**: Tailwind working on homepage
- **Test**: Add `text-red-500` to any element and see it apply
- **Note**: Use responsive classes like `flex-col md:flex-row` from the start

### 3.1. **Add mobile viewport meta tag** 🔶 *Mobile UX critical*
- **Start**: Edit `_document.tsx` in `pages`
- **End**: Add:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ```
- **Test**: Page scales correctly on small screen sizes

### 4. **Connect to Supabase**
- **Start**: Create project at supabase.io
- **End**: `.env.local` contains Supabase keys and `lib/supabase.ts` exports the client
- **Test**: Call `supabase.from('users').select('*')` in a test file and log result

---

## 👤 AUTH + USER

### 5. **Set up Supabase auth**
- **Start**: Use Supabase email + wallet address login
- **End**: Auth state accessible in frontend
- **Test**: Log in, log out, check session in console

### 6. **Create `users` table in Supabase**
- **Start**: Open Supabase SQL editor
- **End**: Table with necessary columns created
- **Test**: Add a row via Supabase dashboard

### 7. **Auto-create user on login**
- **Start**: Check if user exists in Supabase after auth
- **End**: If not, insert with default values
- **Test**: Log in with new wallet and see row in `users`

---

## 🔗 WALLET CONNECTION

### 8. **Connect Metamask**
- **Start**: Build `useWallet.ts` using `ethers.js`
- **End**: User can connect Metamask and see address
- **Test**: Display address in UI

### 9. **Connect Abstract Global Wallet**
- **Start**: Use AGW SDK
- **End**: Support toggle between Metamask and AGW
- **Test**: Detect and connect both wallet types

### 10. **Detect GUGO token balance**
- **Start**: Add `getGugoBalance()` to `lib/contract.ts`
- **End**: Show FGUGO balance from Abstract Chain TestNet
- **Test**: Fetch balance on load

---

## 🧩 GAME CORE: MATCHUPS

### 11. **Create `nfts` and `matchups` tables**
- **Start**: Supabase SQL
- **End**: Tables created with correct schema
- **Test**: Insert a matchup row via Supabase UI

### 12. **Seed sample NFTs and matchups**
- **Start**: Manual inserts for MVP testing
- **End**: 4 NFTs, 2 matchups exist
- **Test**: Query matchups on frontend and display NFT images

### 13. **Create `MatchupDisplay` component** 🔶 *Mobile UX critical*
- **Start**: Use `/components/MatchupDisplay.tsx`
- **End**: Side-by-side or stacked display depending on screen size
- **Test**: Clicking NFT logs selected vote

### 13.1. **Add responsive layout for `MatchupDisplay`** 🔶 *Mobile UX critical*
- **Start**: Use Tailwind classes like `flex-col md:flex-row`
- **End**: NFT images stack vertically on mobile
- **Test**: View component in Chrome DevTools emulator

### 14. **Create `votes` table**
- **Start**: Supabase SQL
- **End**: Table with appropriate fields created
- **Test**: Add dummy vote from frontend

### 15. **Create vote submission logic**
- **Start**: `handleVote(nftId: string)` function
- **End**: Sends vote to Supabase, burns 1 GUGO
- **Test**: Vote submits and shows “Thank you” state

---

## 💥 GAME FEEDBACK: XP + PRIZE BREAK

### 16. **Implement XP calculation logic**
- **Start**: In `lib/aestheticScore.ts`
- **End**: +1 XP per vote, +10 per super vote
- **Test**: Check XP increment in Supabase

### 17. **Trigger Prize Break every 10 votes**
- **Start**: Backend endpoint `/api/prizebreak.ts`
- **End**: Checks vote count, randomizes reward
- **Test**: Hitting 10th vote triggers prize logic

### 18. **Create `PrizeBreakModal`** 🔶 *Mobile UX critical*
- **Start**: Build spinning reward animation
- **End**: Modal is full-screen on mobile, centered box on desktop
- **Test**: Appears and animates correctly on both device sizes

---

## 📊 SCORES + UI

### 19. **Calculate Looks Score**
- **Start**: Run Elo + Aesthetic Score logic in `lib/aestheticScore.ts`
- **End**: Returns score from Supabase matchups
- **Test**: Score updates in DB after each vote

### 20. **Display NFT Looks Score**
- **Start**: Add `LooksScoreBadge` to each NFT display
- **End**: Shows number (e.g., 8.7/10)
- **Test**: Confirm accurate score renders

### 21. **Daily Free Vote Claim UI**
- **Start**: Add button to claim free votes
- **End**: Adds 10 votes to user state
- **Test**: Only works once per day

---

## 🎮 POLISH

### 22. **Add route protection**
- **Start**: Only logged-in users can access `/play`
- **End**: Unauthenticated users are redirected to login
- **Test**: Visit `/play` without login shows redirect

### 22.1. **Test all flows on mobile** 🔶 *Mobile UX critical*
- **Start**: Use DevTools and physical device
- **End**: Ensure wallet connect, voting, prize modals, and navigation are usable on mobile

### 23. **Add loading + error states**
- **Start**: Show spinners / toasts
- **End**: Every async action has feedback
- **Test**: Vote with slow connection shows “Voting…”

---

🔶 = **Mobile UX critical**
