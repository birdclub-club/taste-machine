"use client"

import { useState, useEffect } from 'react';

export type CollectionPreference = 'bearish' | 'mix' | null;

export function useCollectionPreference() {
  const [hasSeenTour, setHasSeenTour] = useState(false);

  // Load tour status from localStorage on mount
  useEffect(() => {
    const hasSeenTourStored = localStorage.getItem('has-seen-onboarding-tour');
    if (hasSeenTourStored === 'true') {
      setHasSeenTour(true);
      console.log('✅ User has seen onboarding tour before');
    } else {
      setHasSeenTour(false);
      console.log('🎯 First-time user - onboarding tour will show');
    }
  }, []);

  // Mark tour as seen
  const markTourAsSeen = () => {
    setHasSeenTour(true);
    localStorage.setItem('has-seen-onboarding-tour', 'true');
    console.log('✅ Onboarding tour marked as seen');
  };

  // Always return 'mix' preference for maximum speed - no collection filtering
  const preference: CollectionPreference = 'mix';

  // Simplified function - no longer needed for welcome logic
  const setCollectionPreference = () => {
    console.log('✅ Collection preference set to mix');
  };

  return {
    preference,
    setCollectionPreference,
    shouldShowTour: !hasSeenTour,
    markTourAsSeen
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