"use client"

import { useState, useEffect } from 'react';

export type CollectionPreference = 'bearish' | 'mix' | null;

export function useCollectionPreference() {
  const [preference, setPreference] = useState<CollectionPreference>(null); // Start with null
  const [hasSetPreference, setHasSetPreference] = useState(false); // Start with false to trigger welcome popup

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('collection-preference');
    if (stored && (stored === 'bearish' || stored === 'mix')) {
      setPreference(stored);
      setHasSetPreference(true);
      console.log(`🎯 Loaded stored preference: ${stored}`);
    } else {
      // If no stored preference, user needs to see welcome popup
      setPreference(null); // Keep as null until user chooses
      setHasSetPreference(false); // This will trigger welcome popup
      console.log('🆕 No stored preference - welcome popup will show');
      // Don't save to localStorage yet - let user choose in welcome popup
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
      return 'BEARISH'; // Updated to match actual database collection name
    case 'mix':
      return null; // No filter = all collections
    case null:
      return 'BEARISH'; // Default to BEARISH for null (before user has chosen)
    default:
      return 'BEARISH'; // Default to BEARISH
  }
}

// Utility function to check if an NFT matches the current preference
export function matchesCollectionPreference(
  nftCollectionName: string | null, 
  preference: CollectionPreference
): boolean {
  if (preference === 'mix') {
    return true; // Show all collections
  }
  
  if (preference === 'bearish' || preference === null) {
    return nftCollectionName === 'BEARISH'; // Updated to match actual database collection name
  }
  
  return nftCollectionName === 'BEARISH'; // Default to BEARISH only