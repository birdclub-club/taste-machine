
# 🗳️ Voting UI Layer Scaffold

This scaffold helps you implement the NFT aesthetic voting interface for "Taste Machine".

---

## 🧱 File Structure

```bash
src/
├── components/
│   ├── MatchupCard.tsx         # Shows two NFTs side-by-side (or stacked on mobile)
│   ├── VoteControls.tsx        # Vote / Super Vote buttons
│   └── VoteResultToast.tsx     # Toast UI for feedback
├── hooks/
│   └── useVote.ts              # Encapsulates vote contract interaction
├── lib/
│   └── matchup.ts              # Fetch current matchup from Supabase
```

---

## 🧩 MatchupCard.tsx

```tsx
// props: { nft1: NFTData; nft2: NFTData; onVote: (winnerId: string, super: boolean) => void }
export default function MatchupCard({ nft1, nft2, onVote }) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      {[nft1, nft2].map((nft, i) => (
        <div key={nft.id} className="flex-1 border p-2 text-center">
          <img src={nft.image} className="w-full rounded" />
          <button
            onClick={() => onVote(nft.id, false)}
            className="mt-2 w-full bg-blue-500 text-white rounded p-2"
          >
            Vote for {i === 0 ? 'Left' : 'Right'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🧠 useVote.ts

```ts
import { useState } from 'react';
import { writeContract } from 'wagmi/actions';
import { GUGO_VOTE_MANAGER_ABI, GUGO_VOTE_MANAGER_ADDRESS } from '@/lib/constants';

export function useVote() {
  const [isVoting, setVoting] = useState(false);

  const vote = async (winnerId: string, superVote: boolean = false) => {
    setVoting(true);
    try {
      const result = await writeContract({
        address: GUGO_VOTE_MANAGER_ADDRESS,
        abi: GUGO_VOTE_MANAGER_ABI,
        functionName: superVote ? 'superVote' : 'vote',
        args: [winnerId],
      });
      return result;
    } catch (err) {
      console.error('Voting failed:', err);
      throw err;
    } finally {
      setVoting(false);
    }
  };

  return { vote, isVoting };
}
```

---

## 📡 matchup.ts

```ts
import { supabase } from './supabase';

export async function fetchMatchup() {
  const { data, error } = await supabase
    .from('matchups')
    .select('*, nft1:nfts(*), nft2:nfts(*)')
    .eq('status', 'pending')
    .limit(1)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    nft1: data.nft1,
    nft2: data.nft2,
  };
}
```

---

## ✅ Integration (example in `app/page.tsx`)

```tsx
'use client';
import { useEffect, useState } from 'react';
import MatchupCard from '@/components/MatchupCard';
import { useVote } from '@/hooks/useVote';
import { fetchMatchup } from '@/lib/matchup';

export default function Page() {
  const [matchup, setMatchup] = useState(null);
  const { vote, isVoting } = useVote();

  useEffect(() => {
    fetchMatchup().then(setMatchup);
  }, []);

  const handleVote = async (winnerId: string, superVote: boolean) => {
    await vote(winnerId, superVote);
    alert('Vote submitted!'); // swap for toast later
    fetchMatchup().then(setMatchup);
  };

  if (!matchup) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <MatchupCard
        nft1={matchup.nft1}
        nft2={matchup.nft2}
        onVote={handleVote}
      />
    </div>
  );
}
```

---

## 🧪 Test Plan

- ✅ Ensure two NFTs render
- ✅ Clicking vote button triggers contract write
- ✅ Errors are logged and don’t break the app
- ✅ Page refreshes with a new matchup after vote
- ✅ Works on mobile (test swipe/tap sizes)

---

## ⏭ Next Steps

- Add support for Super Vote via hold or toggle
- Integrate PrizeBreak modal after every 10 votes
- Log vote result in Supabase
- Show Looks Score and XP in header

---
