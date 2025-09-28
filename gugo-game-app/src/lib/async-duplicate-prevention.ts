/**
 * Non-blocking duplicate prevention system
 * Uses background checks to avoid UI blocking
 */

interface DuplicateCheckCache {
  [pairKey: string]: {
    isDuplicate: boolean;
    timestamp: number;
    ttl: number;
  };
}

class AsyncDuplicatePrevention {
  private static instance: AsyncDuplicatePrevention;
  private cache: DuplicateCheckCache = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly COOLDOWN_PERIOD = 2 * 60 * 60 * 1000; // 2 hours

  static getInstance(): AsyncDuplicatePrevention {
    if (!AsyncDuplicatePrevention.instance) {
      AsyncDuplicatePrevention.instance = new AsyncDuplicatePrevention();
    }
    return AsyncDuplicatePrevention.instance;
  }

  /**
   * Fast, non-blocking duplicate check with cache
   */
  async checkPairFast(nftAId: string, nftBId: string): Promise<boolean> {
    const pairKey = this.createPairKey(nftAId, nftBId);
    const now = Date.now();

    // Check cache first (instant response)
    const cached = this.cache[pairKey];
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.isDuplicate;
    }

    // Background check (don't await - return optimistic result)
    this.backgroundCheck(pairKey, nftAId, nftBId);

    // Return optimistic result (assume not duplicate for better UX)
    return false;
  }

  /**
   * Background duplicate check that updates cache
   */
  private async backgroundCheck(pairKey: string, nftAId: string, nftBId: string): Promise<void> {
    try {
      // Use local storage for instant checks first
      const localResult = this.checkLocalStorage(pairKey);
      if (localResult !== null) {
        this.updateCache(pairKey, localResult);
        return;
      }

      // Fallback to API check (background only)
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
        this.updateCache(pairKey, result.is_duplicate);
        this.updateLocalStorage(pairKey, result.is_duplicate);
      }
    } catch (error) {
      console.warn('Background duplicate check failed:', error);
      // Cache as "not duplicate" on error to avoid blocking
      this.updateCache(pairKey, false);
    }
  }

  /**
   * Check local storage for recent pairs (instant)
   */
  private checkLocalStorage(pairKey: string): boolean | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const stored = localStorage.getItem('recent-pairs-fast');
      if (!stored) return null;

      const recentPairs = JSON.parse(stored);
      const pairData = recentPairs[pairKey];
      
      if (pairData) {
        const age = Date.now() - pairData.timestamp;
        if (age < this.COOLDOWN_PERIOD) {
          return true; // Still in cooldown
        } else {
          // Remove expired entry
          delete recentPairs[pairKey];
          localStorage.setItem('recent-pairs-fast', JSON.stringify(recentPairs));
          return false;
        }
      }
      
      return false; // Not found in recent pairs
    } catch (error) {
      console.warn('Local storage check failed:', error);
      return null;
    }
  }

  /**
   * Update local storage with new pair (instant)
   */
  private updateLocalStorage(pairKey: string, isDuplicate: boolean): void {
    try {
      if (typeof window === 'undefined') return;
      
      const stored = localStorage.getItem('recent-pairs-fast') || '{}';
      const recentPairs = JSON.parse(stored);
      
      if (isDuplicate) {
        recentPairs[pairKey] = {
          timestamp: Date.now(),
          isDuplicate: true
        };
      }
      
      // Clean up old entries (keep only last 1000)
      const entries = Object.entries(recentPairs);
      if (entries.length > 1000) {
        const sorted = entries.sort((a: any, b: any) => b[1].timestamp - a[1].timestamp);
        const cleaned = Object.fromEntries(sorted.slice(0, 1000));
        localStorage.setItem('recent-pairs-fast', JSON.stringify(cleaned));
      } else {
        localStorage.setItem('recent-pairs-fast', JSON.stringify(recentPairs));
      }
    } catch (error) {
      console.warn('Local storage update failed:', error);
    }
  }

  /**
   * Update memory cache
   */
  private updateCache(pairKey: string, isDuplicate: boolean): void {
    this.cache[pairKey] = {
      isDuplicate,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    };
  }

  /**
   * Create consistent pair key
   */
  private createPairKey(nftAId: string, nftBId: string): string {
    return [nftAId, nftBId].sort().join('|');
  }

  /**
   * Track a new pair (when vote is submitted)
   */
  trackPair(nftAId: string, nftBId: string): void {
    const pairKey = this.createPairKey(nftAId, nftBId);
    this.updateCache(pairKey, true);
    this.updateLocalStorage(pairKey, true);
  }

  /**
   * Get cache statistics
   */
  getStats(): { cacheSize: number; hitRate: string } {
    const size = Object.keys(this.cache).length;
    return {
      cacheSize: size,
      hitRate: size > 0 ? 'Active' : 'Empty'
    };
  }
}

// Export singleton
export const asyncDuplicatePrevention = AsyncDuplicatePrevention.getInstance();

