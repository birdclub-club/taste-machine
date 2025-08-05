"use client"

import { useState, useEffect } from 'react';

export type CollectionPreference = 'bearish' | 'mix' | null;

export function useCollectionPreference() {
  const [preference, setPreference] = useState<CollectionPreference>('bearish'); // Default to bearish
  const [hasSetPreference, setHasSetPreference] = useState(true); // Default to true since we have a default

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('collection-preference');
    if (stored && (stored === 'bearish' || stored === 'mix')) {
      setPreference(stored);
      setHasSetPreference(true);
    } else {
      // If no stored preference, set default to bearish
      setPreference('bearish');
      setHasSetPreference(true);
      localStorage.setItem('collection-preference', 'bearish');
    }
  }, []);

  // Save preference to localStorage
  const setCollectionPreference = (pref: CollectionPreference) => {
    setPreference(pref);
    setHasSetPreference(true);
    
    if (pref) {
      localStorage.setItem('collection-preference', pref);
      console.log(`🎯 Collection preference set to: ${pref}`);
    } else {
      localStorage.removeItem('collection-preference');
      console.log('🗑️ Collection preference cleared');
    }
  };

  // Check if user should see welcome popup
  const shouldShowWelcome = !hasSetPreference;

  return {
    preference,
    hasSetPreference,
    shouldShowWelcome,
    setCollectionPreference
  };
}

// Utility function to get collection filter for API calls
export function getCollectionFilter(preference: CollectionPreference): string | null {
  switch (preference) {
    case 'bearish':
      return 'Bearish';
    case 'mix':
      return null; // No filter = all collections
    default:
      return 'Bearish'; // Default to Bearish
  }
}

// Utility function to check if an NFT matches the current preference
export function matchesCollectionPreference(
  nftCollectionName: string | null, 
  preference: CollectionPreference
): boolean {
  if (preference === 'mix' || preference === null) {
    return true; // Show all collections
  }
  
  if (preference === 'bearish') {
    return nftCollectionName === 'Bearish';
  }
  
  return nftCollectionName === 'Bearish'; // Default to Bearish only
}