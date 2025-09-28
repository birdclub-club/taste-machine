/**
 * Utility functions for system-wide duplicate prevention
 */

export async function checkPairDuplicate(nftAId: string, nftBId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/matchup-duplicate-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nft_a_id: nftAId,
        nft_b_id: nftBId,
        check_only: true
      })
    });
    
    const result = await response.json();
    if (result.success) {
      if (result.is_duplicate) {
        console.log(`🔄 Duplicate pair detected: ${nftAId} vs ${nftBId} (${result.minutes_since_last_use} min ago)`);
      }
      return result.is_duplicate;
    }
  } catch (error) {
    console.warn('⚠️ Duplicate check failed, allowing pair:', error);
  }
  
  return false; // Default to allowing pair if check fails
}

export async function filterDuplicatePairs(pairs: Array<{nft_a_id: string, nft_b_id: string}>): Promise<Array<{nft_a_id: string, nft_b_id: string}>> {
  const filteredPairs = [];
  
  for (const pair of pairs) {
    const isDuplicate = await checkPairDuplicate(pair.nft_a_id, pair.nft_b_id);
    if (!isDuplicate) {
      filteredPairs.push(pair);
    }
  }
  
  return filteredPairs;
}

export function createPairKey(nftAId: string, nftBId: string): string {
  return [nftAId, nftBId].sort().join('|');
}

