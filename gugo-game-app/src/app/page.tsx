"use client"

import { useEffect, useState } from 'react';
import MatchupCard from '@/components/MatchupCard';
import { useVote } from '@/hooks/useVote';
import { fetchMatchup } from '@lib/matchup'; // Using path alias for lib directory

// Define a basic NFTData type
interface NFTData {
  id: string;
  image: string;
  name?: string;
}

// Define a type for the matchup data
interface Matchup {
  id: string;
  nft1: NFTData;
  nft2: NFTData;
}

export default function Page() {
  const [matchup, setMatchup] = useState<Matchup | null>(null); // Added type for matchup
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { vote, isVoting } = useVote();

  useEffect(() => {
    fetchMatchup()
      .then(setMatchup)
      .catch((err) => {
        console.error('Failed to fetch matchup:', err);
        setError('Failed to load matchup. Please refresh the page.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleVote = async (winnerId: string, superVote: boolean) => {
    try {
      await vote(winnerId, superVote);
      alert('Vote submitted!'); // swap for toast later
      
      // Fetch new matchup
      setLoading(true);
      const newMatchup = await fetchMatchup();
      setMatchup(newMatchup);
    } catch (err) {
      console.error('Vote failed:', err);
      alert('Vote failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!matchup) return <div className="p-4">No matchups available.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Taste Machine</h1>
          <p className="text-gray-600">Vote on aesthetic appeal of NFTs</p>
          <p className="text-sm text-gray-500 mt-2">
            ✨ Now featuring real <strong>BEARISH</strong> NFTs from Abstract Chain!
          </p>
        </header>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-center mb-6">Choose Your Favorite</h2>
          <MatchupCard
            nft1={matchup.nft1}
            nft2={matchup.nft2}
            onVote={handleVote}
            isVoting={isVoting}
          />
        </div>
      </div>
    </div>
  );
}
