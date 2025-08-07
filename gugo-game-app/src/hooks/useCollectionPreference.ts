"use client"

import { useState, useEffect } from 'react';

export type CollectionPreference = 'bearish' | 'mix' | null;

export function useCollectionPreference() {
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  // Load welcome status from localStorage on mount
  useEffect(() => {
    const hasSeenWelcomeStored = localStorage.getItem('has-seen-welcome');
    if (hasSeenWelcomeStored === 'true') {
      setHasSeenWelcome(true);
      console.log('✅ User has seen welcome popup before');
    } else {
      setHasSeenWelcome(false);
      console.log('🆕 First-time user - welcome popup will show');
    }
  }, []);

  // Mark welcome as seen
  const markWelcomeAsSeen = () => {
    setHasSeenWelcome(true);
    localStorage.setItem('has-seen-welcome', 'true');
    console.log('✅ Welcome popup marked as seen');
  };

  // Always return 'mix' preference for maximum speed - no collection filtering
  const preference: CollectionPreference = 'mix';

  return {
    preference,
    hasSetPreference: hasSeenWelcome,
    shouldShowWelcome: !hasSeenWelcome,
    setCollectionPreference: markWelcomeAsSeen // Simplified - just marks welcome as seen
  };
}

// Utility function to get collection filter for API calls
// Always returns null for maximum speed - no collection filtering
export function getCollectionFilter(preference: CollectionPreference): string | null {
  return null; // Always return null = show all collections for maximum variety and speed
}

// Utility function to check if an NFT matches the current preference
// Always returns true for maximum speed - no collection filtering
export function matchesCollectionPreference(
  nftCollectionName: string | null, 
  preference: CollectionPreference
): boolean {
  return true; // Always return true = show all NFTs for maximum variety and speed
}