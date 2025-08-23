// 🚀 System Initializer
// Initializes all critical systems for the Taste Machine app

import { cacheVersionManager } from './cache-version-manager';
import { databaseErrorHandler } from './database-error-handler';

export class SystemInitializer {
  private static initialized = false;

  /**
   * Initialize all critical systems
   */
  static async initialize(): Promise<void> {
    if (SystemInitializer.initialized) {
      console.log('✅ Systems already initialized');
      return;
    }

    console.log('🚀 Initializing Taste Machine systems...');

    try {
      // Initialize cache version management
      await cacheVersionManager.initialize();
      console.log('✅ Cache version manager initialized');

      // Test database connection
      const healthCheck = await databaseErrorHandler.healthCheck();
      if (healthCheck.healthy) {
        console.log(`✅ Database connection healthy (${healthCheck.latency}ms)`);
      } else {
        console.warn('⚠️ Database connection issues:', healthCheck.error);
      }

      SystemInitializer.initialized = true;
      console.log('🎉 All systems initialized successfully');

    } catch (error) {
      console.error('❌ System initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  static getStatus(): { initialized: boolean } {
    return {
      initialized: SystemInitializer.initialized
    };
  }

  /**
   * Cleanup systems (for testing or shutdown)
   */
  static cleanup(): void {
    cacheVersionManager.cleanup();
    SystemInitializer.initialized = false;
    console.log('🧹 Systems cleaned up');
  }
}

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  // Initialize after a short delay to ensure DOM is ready
  setTimeout(() => {
    SystemInitializer.initialize().catch(error => {
      console.error('❌ Auto-initialization failed:', error);
    });
  }, 1000);
}
