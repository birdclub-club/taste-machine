
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
