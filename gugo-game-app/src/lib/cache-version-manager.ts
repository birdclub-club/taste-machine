// 🔄 Cache Version Manager
// Handles cache invalidation when collection status changes

import { supabase } from '../../lib/supabase';

export interface CacheVersion {
  version: number;
  timestamp: number;
  collections_hash: string;
}

export class CacheVersionManager {
  private static instance: CacheVersionManager;
  private currentVersion: CacheVersion | null = null;
  private readonly CACHE_VERSION_KEY = 'taste-machine-cache-version';
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds
  private intervalId: NodeJS.Timeout | null = null;

  static getInstance(): CacheVersionManager {
    if (!CacheVersionManager.instance) {
      CacheVersionManager.instance = new CacheVersionManager();
    }
    return CacheVersionManager.instance;
  }

  /**
   * Initialize cache version monitoring
   */
  async initialize(): Promise<void> {
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      console.log('🔄 Cache version manager: Server-side, skipping initialization');
      return;
    }

    console.log('🔄 Initializing cache version manager...');
    
    // Load current version from localStorage
    await this.loadCurrentVersion();
    
    // Check for version changes immediately
    await this.checkForVersionChanges();
    
    // Start periodic checking
    this.startPeriodicChecking();
  }

  /**
   * Load current cache version from localStorage
   */
  private async loadCurrentVersion(): Promise<void> {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.CACHE_VERSION_KEY);
      if (stored) {
        this.currentVersion = JSON.parse(stored);
        console.log('📦 Loaded cache version:', this.currentVersion?.version);
      }
    } catch (error) {
      console.warn('⚠️ Could not load cache version:', error);
      this.currentVersion = null;
    }
  }

  /**
   * Get current collection status hash
   */
  private async getCollectionsHash(): Promise<string> {
    try {
      const { data: collections, error } = await supabase
        .from('collection_management')
        .select('collection_name, active, priority')
        .order('collection_name');

      if (error) {
        console.warn('⚠️ Could not fetch collections for hash:', error);
        return 'error';
      }

      // Create hash from collection status
      const collectionsString = JSON.stringify(collections);
      const hash = await this.simpleHash(collectionsString);
      
      return hash;
    } catch (error) {
      console.warn('⚠️ Error getting collections hash:', error);
      return 'error';
    }
  }

  /**
   * Simple hash function for collection status
   */
  private async simpleHash(str: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if collection status has changed and invalidate cache if needed
   */
  async checkForVersionChanges(): Promise<boolean> {
    try {
      const newHash = await this.getCollectionsHash();
      const newVersion: CacheVersion = {
        version: Date.now(),
        timestamp: Date.now(),
        collections_hash: newHash
      };

      // If no current version, set it
      if (!this.currentVersion) {
        this.currentVersion = newVersion;
        this.saveCurrentVersion();
        console.log('🆕 Set initial cache version:', newVersion.version);
        return false;
      }

      // Check if collections have changed
      if (this.currentVersion.collections_hash !== newHash) {
        console.log('🚨 Collection status changed! Invalidating cache...');
        console.log('📊 Old hash:', this.currentVersion.collections_hash);
        console.log('📊 New hash:', newHash);
        
        // Update version
        this.currentVersion = newVersion;
        this.saveCurrentVersion();
        
        // Trigger cache invalidation
        await this.invalidateCache();
        
        return true;
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Error checking version changes:', error);
      return false;
    }
  }

  /**
   * Save current version to localStorage
   */
  private saveCurrentVersion(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      if (this.currentVersion) {
        localStorage.setItem(this.CACHE_VERSION_KEY, JSON.stringify(this.currentVersion));
      }
    } catch (error) {
      console.warn('⚠️ Could not save cache version:', error);
    }
  }

  /**
   * Invalidate all caches when collection status changes
   */
  private async invalidateCache(): Promise<void> {
    console.log('🧹 Invalidating all caches due to collection status change...');

    // Clear preloader cache
    try {
      const preloader = (window as any).votingPreloader;
      if (preloader && typeof preloader.clearAllSessions === 'function') {
        preloader.clearAllSessions();
        console.log('✅ Cleared preloader cache');
      }
    } catch (error) {
      console.warn('⚠️ Could not clear preloader cache:', error);
    }

    // Clear localStorage cache keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('taste-machine-sessions') ||
        key.includes('preloader-') ||
        key.includes('voting-session') ||
        key.includes('seen-pairs') ||
        key.includes('seen-nfts')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      if (key !== this.CACHE_VERSION_KEY) { // Don't remove version key
        localStorage.removeItem(key);
        console.log('🗑️ Removed cache key:', key);
      }
    });

    // Clear sessionStorage
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.includes('taste-machine') ||
        key.includes('preloader') ||
        key.includes('voting')
      )) {
        sessionKeysToRemove.push(key);
      }
    }

    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log('🗑️ Removed session key:', key);
    });

    console.log('✅ Cache invalidation complete');
    
    // Emit custom event for components to react to
    window.dispatchEvent(new CustomEvent('cache-invalidated', {
      detail: { reason: 'collection-status-change', version: this.currentVersion?.version }
    }));
  }

  /**
   * Start periodic checking for collection changes
   */
  private startPeriodicChecking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      await this.checkForVersionChanges();
    }, this.CHECK_INTERVAL);

    console.log(`🔄 Started cache version monitoring (${this.CHECK_INTERVAL}ms interval)`);
  }

  /**
   * Stop periodic checking
   */
  stopPeriodicChecking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Stopped cache version monitoring');
    }
  }

  /**
   * Get current cache version info
   */
  getCurrentVersion(): CacheVersion | null {
    return this.currentVersion;
  }

  /**
   * Force cache invalidation (for manual testing)
   */
  async forceInvalidation(): Promise<void> {
    console.log('🚨 Force invalidating cache...');
    await this.invalidateCache();
  }

  /**
   * Cleanup when component unmounts
   */
  cleanup(): void {
    this.stopPeriodicChecking();
  }
}

// Export singleton instance
export const cacheVersionManager = CacheVersionManager.getInstance();
