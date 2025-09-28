// 🛡️ Enhanced Database Error Handler
// Provides robust error handling, retry logic, and timeout management for database operations

import { supabase } from '../../lib/supabase';

export interface DatabaseOperation<T> {
  operation: () => Promise<T>;
  operationName: string;
  timeout?: number;
  retries?: number;
  fallback?: () => Promise<T>;
}

export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  duration: number;
}

export class DatabaseErrorHandler {
  private static instance: DatabaseErrorHandler;
  private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds
  private readonly DEFAULT_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 3000]; // Progressive delays

  static getInstance(): DatabaseErrorHandler {
    if (!DatabaseErrorHandler.instance) {
      DatabaseErrorHandler.instance = new DatabaseErrorHandler();
    }
    return DatabaseErrorHandler.instance;
  }

  /**
   * Execute database operation with comprehensive error handling
   */
  async executeWithRetry<T>(config: DatabaseOperation<T>): Promise<DatabaseResult<T>> {
    const startTime = Date.now();
    const maxRetries = config.retries ?? this.DEFAULT_RETRIES;
    const timeout = config.timeout ?? this.DEFAULT_TIMEOUT;
    
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${config.operationName} (attempt ${attempt}/${maxRetries})`);
        
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timeout after ${timeout}ms`));
          }, timeout);
        });
        
        // Race between operation and timeout
        const result = await Promise.race([
          config.operation(),
          timeoutPromise
        ]);
        
        const duration = Date.now() - startTime;
        console.log(`✅ ${config.operationName} succeeded (${duration}ms, attempt ${attempt})`);
        
        return {
          success: true,
          data: result,
          attempts: attempt,
          duration
        };
        
      } catch (error: any) {
        lastError = error;
        const duration = Date.now() - startTime;
        
        console.warn(`⚠️ ${config.operationName} failed (attempt ${attempt}/${maxRetries}):`, error.message);
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === maxRetries) {
          // Try fallback if available
          if (config.fallback && attempt === maxRetries) {
            try {
              console.log(`🔄 ${config.operationName} trying fallback...`);
              const fallbackResult = await config.fallback();
              
              return {
                success: true,
                data: fallbackResult,
                attempts: attempt,
                duration: Date.now() - startTime
              };
            } catch (fallbackError: any) {
              console.error(`❌ ${config.operationName} fallback failed:`, fallbackError.message);
            }
          }
          
          return {
            success: false,
            error: this.formatError(lastError),
            attempts: attempt,
            duration
          };
        }
        
        // Wait before retry (progressive backoff)
        if (attempt < maxRetries) {
          const delay = this.RETRY_DELAYS[attempt - 1] || 3000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }
    
    return {
      success: false,
      error: this.formatError(lastError),
      attempts: maxRetries,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute RPC function with enhanced error handling
   */
  async executeRPC<T>(
    functionName: string, 
    params: any = {}, 
    options: { timeout?: number; retries?: number; fallback?: () => Promise<T> } = {}
  ): Promise<DatabaseResult<T>> {
    return this.executeWithRetry({
      operation: async () => {
        const { data, error } = await supabase.rpc(functionName, params);
        
        if (error) {
          throw new Error(`RPC ${functionName} failed: ${error.message} (${error.code})`);
        }
        
        return data;
      },
      operationName: `RPC ${functionName}`,
      timeout: options.timeout,
      retries: options.retries,
      fallback: options.fallback
    });
  }

  /**
   * Execute query with enhanced error handling
   */
  async executeQuery<T>(
    queryBuilder: any,
    operationName: string,
    options: { timeout?: number; retries?: number; fallback?: () => Promise<T> } = {}
  ): Promise<DatabaseResult<T>> {
    return this.executeWithRetry({
      operation: async () => {
        const result = await queryBuilder;
        
        if (result.error) {
          throw new Error(`Query ${operationName} failed: ${result.error.message} (${result.error.code})`);
        }
        
        return result.data;
      },
      operationName,
      timeout: options.timeout,
      retries: options.retries,
      fallback: options.fallback
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;
    
    // Timeout errors - always retryable
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return true;
    }
    
    // Statement timeout (PostgreSQL error code 57014)
    if (errorCode === '57014' || errorMessage.includes('statement timeout')) {
      return true;
    }
    
    // Connection errors - retryable
    if (errorMessage.includes('connection') || errorMessage.includes('network')) {
      return true;
    }
    
    // Server errors (5xx) - retryable
    if (errorCode >= 500 && errorCode < 600) {
      return true;
    }
    
    // Rate limiting - retryable
    if (errorCode === 429 || errorMessage.includes('rate limit')) {
      return true;
    }
    
    // Temporary unavailable - retryable
    if (errorMessage.includes('temporarily unavailable') || errorMessage.includes('service unavailable')) {
      return true;
    }
    
    return false;
  }

  /**
   * Format error message for logging
   */
  private formatError(error: any): string {
    if (!error) return 'Unknown error';
    
    if (error.message) {
      return `${error.message}${error.code ? ` (${error.code})` : ''}`;
    }
    
    return String(error);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a circuit breaker for frequently failing operations
   */
  createCircuitBreaker(operationName: string, failureThreshold = 5, resetTimeout = 30000) {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;
    
    return {
      async execute<T>(operation: () => Promise<T>): Promise<T> {
        const now = Date.now();
        
        // Check if circuit should reset
        if (isOpen && (now - lastFailureTime) > resetTimeout) {
          console.log(`🔄 Circuit breaker reset for ${operationName}`);
          isOpen = false;
          failures = 0;
        }
        
        // If circuit is open, fail fast
        if (isOpen) {
          throw new Error(`Circuit breaker open for ${operationName} (${failures} failures)`);
        }
        
        try {
          const result = await operation();
          
          // Reset on success
          if (failures > 0) {
            console.log(`✅ Circuit breaker success for ${operationName}, resetting failure count`);
            failures = 0;
          }
          
          return result;
        } catch (error) {
          failures++;
          lastFailureTime = now;
          
          if (failures >= failureThreshold) {
            isOpen = true;
            console.warn(`🚨 Circuit breaker opened for ${operationName} (${failures} failures)`);
          }
          
          throw error;
        }
      },
      
      getStatus() {
        return { isOpen, failures, lastFailureTime };
      }
    };
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Simple query to test connection
      const { error } = await supabase
        .from('nfts')
        .select('id')
        .limit(1);
      
      if (error) {
        return {
          healthy: false,
          error: error.message
        };
      }
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency
      };
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const databaseErrorHandler = DatabaseErrorHandler.getInstance();
