import React from 'react';

interface NFTData {
  id: string;
  image: string;
  name?: string;
}

interface MatchupCardProps {
  nft1: NFTData;
  nft2: NFTData;
  onVote: (winnerId: string, superVote: boolean) => void;
  isVoting?: boolean;
}

export default function MatchupCard({ nft1, nft2, onVote, isVoting = false }: MatchupCardProps) {
  const NFTCard = ({ nft }: { nft: NFTData }) => (
    <div className="flex-1 max-w-md">
      <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 hover:border-blue-300 transition-colors">
        <div className="aspect-square relative overflow-hidden rounded-lg mb-4">
          <img 
            src={nft.image} 
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
            alt={nft.name || `NFT ${nft.id}`}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://picsum.photos/400/400?random=${nft.id}`;
            }}
          />
        </div>
        
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            {nft.name || `BEARISH #${nft.id}`}
          </h3>
          <p className="text-sm text-gray-500 mb-4">Token ID: {nft.id}</p>
          
          <button
            onClick={() => onVote(nft.id, false)}
            disabled={isVoting}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
              isVoting 
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1'
            }`}
          >
            {isVoting ? '⏳ Voting...' : `🗳️ Vote for This NFT`}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-center">
      <NFTCard nft={nft1} />
      
      {/* VS indicator */}
      <div className="flex-shrink-0">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full w-16 h-16 flex items-center justify-center font-bold text-xl shadow-lg">
          VS
        </div>
      </div>
      
      <NFTCard nft={nft2} />
    </div>
  );
}