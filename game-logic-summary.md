
# 🗳️ Taste Machine — Game Logic Summary

## 🔁 Core Loop
- Users purchase Votes with ETH or GUGO (off-chain pricing)
- Votes are stored off-chain (`available_votes`)
- Casting a vote:
  - Deducts 1 vote (or 10 for super vote)
  - Calls `vote()` or `superVote()` on `GugoVoteManager.sol`
  - **Does NOT award XP** anymore

---

## 🎁 Prize Break System
- Triggered **every 10 votes**
- Backend fetches treasury balance from `GUGO_PRIZE_WALLET`
- Based on balance, it dynamically builds a **reward pool**
- Randomly selects 1 prize using weighted probabilities
- Awards 1 of the following (examples):

| Reward            | Example Value        | Notes                        |
|-------------------|----------------------|------------------------------|
| XP Only           | +10 or +20 XP        | Most common                  |
| XP + Votes        | e.g., +10 XP + 10 Votes | Mid-tier                  |
| Votes Only        | e.g., +30 Votes      | High-volume                  |
| GUGO Prize        | 600–25,000 GUGO      | Tier unlocked based on treasury

- All XP is now awarded through Prize Breaks
- XP is stored in Supabase (`users.xp`)
- Prize Break events are logged in `prize_breaks` table

---

## 🧠 GugoVoteManager.sol
- Handles `vote()` and `superVote()` only
- No XP or GUGO logic inside anymore
- `xp` mapping is optional and unused unless needed for legacy reads
- Votes are tracked off-chain
- All XP and rewards handled in backend

---

## 🏆 FIRE-First Leaderboard System

### **POA (Proof of Aesthetic) Scoring**
The leaderboard ranks NFTs using a sophisticated multi-factor algorithm:

#### **Scoring Components**
- **FIRE Vote Priority**: NFTs with FIRE votes (strong favorites) automatically rank higher
- **Elo Rating**: Win/loss performance in head-to-head matchups (1000-1200 range)
- **Slider Scores**: Direct aesthetic ratings from users (0-100 scale)
- **Win Rate**: Percentage of votes won in matchups
- **Collection Diversity**: Algorithm ensures variety across different NFT collections

#### **FIRE Vote System**
- **Trigger**: When users vote with 100% slider value, it becomes a "FIRE vote"
- **Storage**: Recorded in `favorites` table with `vote_type = 'fire'`
- **Priority**: FIRE-voted NFTs always appear at the top of leaderboard
- **Multi-factor**: Even among FIRE votes, NFTs are ranked by POA score

#### **Technical Implementation**
```sql
-- Database function with multi-factor POA calculation
CREATE OR REPLACE FUNCTION get_fire_first_leaderboard_v3(limit_count integer DEFAULT 20)
RETURNS TABLE(id uuid, name text, poa_score numeric, fire_votes bigint, ...)

-- Nuclear Option API with forced JavaScript sorting
-- Guarantees FIRE votes appear first regardless of database function behavior
```

#### **Reliability Systems**
- **Database Function**: PostgreSQL function with proper data types and FIRE vote JOINs
- **API Fallback**: "Nuclear Option" JavaScript sorting to guarantee FIRE-first order
- **Error Handling**: Multiple fallback systems prevent ranking failures
- **Real-time Updates**: Fresh database connections with versioned functions

### **User Interface**
- **Access**: "Leaderboard" menu item in status bar
- **Display**: Top 20 NFTs in Swiss minimalist modal
- **Demo Mode**: Clean professional appearance (no emojis or technical metadata)
- **Responsive**: Beautiful grid layout showcasing NFT images and names
