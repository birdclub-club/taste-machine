// 🧹 Cache Clear Utility
// Comprehensive cache clearing for when database changes require fresh data

export class CacheClearUtility {
  static async clearAllCaches(): Promise<void> {
    console.log('🧹 CLEARING ALL CACHES: Database changes detected...');
    
    try {
      // 1. Clear localStorage
      if (typeof window !== 'undefined' && localStorage) {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes('taste-machine') ||
            key.includes('cache-version') ||
            key.includes('preloader') ||
            key.includes('nft') ||
            key.includes('session')
          )) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ Removed localStorage key: ${key}`);
        });
      }
      
      // 2. Clear sessionStorage
      if (typeof window !== 'undefined' && sessionStorage) {
        sessionStorage.clear();
        console.log('🗑️ Cleared sessionStorage');
      }
      
      // 3. Clear any global cache objects
      if (typeof window !== 'undefined') {
        // Clear preloader cache
        if ((window as any).votingPreloader) {
          (window as any).votingPreloader.clearAllSessions?.();
          console.log('🗑️ Cleared preloader sessions');
        }
        
        // Clear any other cached data
        delete (window as any).cachedCollections;
        delete (window as any).cachedNFTs;
        console.log('🗑️ Cleared global cache objects');
      }
      
      // 4. Force browser cache refresh
      if (typeof window !== 'undefined') {
        // Dispatch custom event for components to listen to
        window.dispatchEvent(new CustomEvent('cache-cleared', {
          detail: { timestamp: Date.now(), reason: 'database-changes' }
        }));
        console.log('📡 Dispatched cache-cleared event');
      }
      
      console.log('✅ All caches cleared successfully');
      
    } catch (error) {
      console.error('❌ Cache clearing failed:', error);
      throw error;
    }
  }
  
  static async forceCacheClear(): Promise<void> {
    try {
      // Call server endpoint to coordinate cache clearing
      const response = await fetch('/api/force-cache-clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Server cache clear successful:', result);
        
        // Clear client-side caches
        await this.clearAllCaches();
        
        // Force page reload if needed
        if (result.instructions?.reload_required) {
          console.log('🔄 Reloading page to ensure fresh data...');
          window.location.reload();
        }
        
      } else {
        console.warn('⚠️ Server cache clear failed, clearing client-side only');
        await this.clearAllCaches();
      }
      
    } catch (error) {
      console.error('❌ Force cache clear failed:', error);
      // Fallback to client-side clearing
      await this.clearAllCaches();
    }
  }
}

// Export for easy use
export const clearAllCaches = CacheClearUtility.clearAllCaches;
export const forceCacheClear = CacheClearUtility.forceCacheClear;

