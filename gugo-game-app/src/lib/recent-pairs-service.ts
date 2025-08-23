/**
 * Centralized Recent Pairs Tracking Service
 * Prevents duplicate matchups across all matchup generation systems
 */

class RecentPairsService {
  private static instance: RecentPairsService;
  private recentPairs = new Set<string>();
  private readonly MAX_RECENT_PAIRS = 10000; // Increased to handle much more history
  private readonly STORAGE_KEY = 'taste-machine-recent-pairs';

  static getInstance(): RecentPairsService {
    if (!RecentPairsService.instance) {
      RecentPairsService.instance = new RecentPairsService();
      RecentPairsService.instance.loadFromStorage();
    }
    return RecentPairsService.instance;
  }

  /**
   * Generate consistent pair key from two NFT IDs
   */
  private getPairKey(nftId1: string, nftId2: string): string {
    return [nftId1, nftId2].sort().join('|');
  }

  /**
   * Check if a pair has been used recently
   */
  isRecentPair(nftId1: string, nftId2: string): boolean {
    const pairKey = this.getPairKey(nftId1, nftId2);
    return this.recentPairs.has(pairKey);
  }

  /**
   * Track a new pair to prevent immediate repeats
   */
  trackPair(nftId1: string, nftId2: string): void {
    const pairKey = this.getPairKey(nftId1, nftId2);
    this.recentPairs.add(pairKey);
    
    console.log(`🔒 Tracked pair: ${pairKey.substring(0, 16)}... (${this.recentPairs.size}/${this.MAX_RECENT_PAIRS})`);
    
    // Limit memory usage
    if (this.recentPairs.size > this.MAX_RECENT_PAIRS) {
      this.cleanupOldPairs();
    }
    
    // Persist to storage
    this.saveToStorage();
  }

  /**
   * Clean up oldest pairs when limit is reached
   */
  private cleanupOldPairs(): void {
    const keysToRemove = Array.from(this.recentPairs).slice(0, 1000); // Remove oldest 1000
    keysToRemove.forEach(key => this.recentPairs.delete(key));
    
    console.log(`🧹 Cleaned up ${keysToRemove.length} old pairs, ${this.recentPairs.size} remaining`);
  }

  /**
   * Get current tracking statistics
   */
  getStats(): { trackedPairs: number; maxPairs: number; memoryUsage: string } {
    return {
      trackedPairs: this.recentPairs.size,
      maxPairs: this.MAX_RECENT_PAIRS,
      memoryUsage: `${((this.recentPairs.size / this.MAX_RECENT_PAIRS) * 100).toFixed(1)}%`
    };
  }

  /**
   * Force clear all tracked pairs (for debugging/reset)
   */
  clearAll(): void {
    this.recentPairs.clear();
    this.saveToStorage();
    console.log('🔄 Cleared all tracked pairs');
  }

  /**
   * Load tracked pairs from localStorage (browser persistence)
   */
  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const pairsArray = JSON.parse(stored);
          this.recentPairs = new Set(pairsArray);
          console.log(`📂 Loaded ${this.recentPairs.size} tracked pairs from storage`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load recent pairs from storage:', error);
    }
  }

  /**
   * Save tracked pairs to localStorage (browser persistence)
   */
  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const pairsArray = Array.from(this.recentPairs);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pairsArray));
      }
    } catch (error) {
      console.warn('⚠️ Failed to save recent pairs to storage:', error);
    }
  }

  /**
   * Get recent pairs for debugging
   */
  getRecentPairs(limit: number = 10): string[] {
    return Array.from(this.recentPairs).slice(-limit);
  }
}

// Export singleton instance
export const recentPairsService = RecentPairsService.getInstance();
