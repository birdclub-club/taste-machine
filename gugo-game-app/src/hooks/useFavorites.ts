import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

interface Favorite {
  id: string;
  nft_id: string;
  token_id?: string;
  collection_name?: string;
  image_url?: string;
  vote_type: 'fire' | 'slider_max';
  created_at: string;
}

interface FavoritesState {
  favorites: Favorite[];
  isLoading: boolean;
  error: string | null;
}

export function useFavorites() {
  const { address } = useAccount();
  const [state, setState] = useState<FavoritesState>({
    favorites: [],
    isLoading: false,
    error: null
  });

  // Fetch user's favorites
  const fetchFavorites = useCallback(async () => {
    if (!address) {
      setState(prev => ({ ...prev, favorites: [], isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/favorites?wallet=${address}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch favorites');
      }

      setState(prev => ({
        ...prev,
        favorites: data.favorites || [],
        isLoading: false
      }));

      console.log(`📚 Loaded ${data.count} favorites for ${address}`);
    } catch (error) {
      console.error('❌ Error fetching favorites:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch favorites',
        isLoading: false
      }));
    }
  }, [address]);

  // Add NFT to favorites
  const addToFavorites = useCallback(async (
    nftId: string,
    voteType: 'fire' | 'slider_max',
    tokenId?: string,
    collectionName?: string,
    imageUrl?: string
  ) => {
    if (!address) {
      console.error('❌ No wallet connected');
      return false;
    }

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          nftId,
          tokenId,
          collectionName,
          imageUrl,
          voteType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add to favorites');
      }

      console.log(`⭐ Added ${nftId} to favorites (${voteType})`);
      
      // Refresh favorites list
      await fetchFavorites();
      return true;
    } catch (error) {
      console.error('❌ Error adding to favorites:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to add to favorites'
      }));
      return false;
    }
  }, [address, fetchFavorites]);

  // Remove NFT from favorites
  const removeFromFavorites = useCallback(async (nftId: string) => {
    if (!address) {
      console.error('❌ No wallet connected');
      return false;
    }

    try {
      const response = await fetch(`/api/favorites?wallet=${address}&nftId=${nftId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove from favorites');
      }

      console.log(`🗑️ Removed ${nftId} from favorites`);
      
      // Refresh favorites list
      await fetchFavorites();
      return data.success;
    } catch (error) {
      console.error('❌ Error removing from favorites:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to remove from favorites'
      }));
      return false;
    }
  }, [address, fetchFavorites]);

  // Check if NFT is in favorites
  const isFavorite = useCallback((nftId: string) => {
    return state.favorites.some(fav => fav.nft_id === nftId);
  }, [state.favorites]);

  // Load favorites when wallet connects
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return {
    favorites: state.favorites,
    isLoading: state.isLoading,
    error: state.error,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    refreshFavorites: fetchFavorites,
    favoritesCount: state.favorites.length
  };
}