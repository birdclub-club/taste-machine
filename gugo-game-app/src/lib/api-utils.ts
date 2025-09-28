/**
 * 🔧 Standardized API Utilities for Taste Machine
 * 
 * Provides consistent error handling, response formatting, and common patterns
 * across all API routes to reduce code duplication and improve maintainability.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

// ================================
// 📋 STANDARDIZED RESPONSE TYPES
// ================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
  statusCode: number;
}

// ================================
// 🚀 RESPONSE UTILITIES
// ================================

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  metadata?: Record<string, any>,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    metadata
  }, { status });
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string | ApiError,
  status?: number,
  details?: string
): NextResponse<ApiResponse> {
  const errorObj = typeof error === 'string' 
    ? { message: error, statusCode: status || 500 }
    : error;

  return NextResponse.json({
    success: false,
    error: errorObj.message,
    details: details || errorObj.details,
    timestamp: new Date().toISOString()
  }, { status: status || errorObj.statusCode });
}

/**
 * Creates a validation error response (400)
 */
export function createValidationError(
  message: string,
  details?: string
): NextResponse<ApiResponse> {
  return createErrorResponse(message, 400, details);
}

/**
 * Creates an internal server error response (500)
 */
export function createInternalError(
  message = 'Internal server error',
  details?: string
): NextResponse<ApiResponse> {
  return createErrorResponse(message, 500, details);
}

/**
 * Creates an unauthorized error response (401)
 */
export function createUnauthorizedError(
  message = 'Unauthorized',
  details?: string
): NextResponse<ApiResponse> {
  return createErrorResponse(message, 401, details);
}

/**
 * Creates a not found error response (404)
 */
export function createNotFoundError(
  message = 'Resource not found',
  details?: string
): NextResponse<ApiResponse> {
  return createErrorResponse(message, 404, details);
}

// ================================
// 🛡️ ERROR HANDLING WRAPPER
// ================================

/**
 * Wraps an API handler with standardized error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<ApiResponse<R>>>
) {
  return async (...args: T): Promise<NextResponse<ApiResponse<R>>> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('❌ Unhandled API error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
      
      return createInternalError(
        'Internal server error',
        errorMessage
      );
    }
  };
}

// ================================
// 🔍 REQUEST VALIDATION
// ================================

/**
 * Validates required query parameters
 */
export function validateQueryParams(
  searchParams: URLSearchParams,
  requiredParams: string[]
): { isValid: boolean; missing: string[]; values: Record<string, string> } {
  const missing: string[] = [];
  const values: Record<string, string> = {};

  for (const param of requiredParams) {
    const value = searchParams.get(param);
    if (!value) {
      missing.push(param);
    } else {
      values[param] = value;
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    values
  };
}

/**
 * Validates required body fields
 */
export function validateBodyFields<T extends Record<string, any>>(
  body: T,
  requiredFields: (keyof T)[]
): { isValid: boolean; missing: string[]; values: T } {
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (!body[field]) {
      missing.push(String(field));
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    values: body
  };
}

// ================================
// 🗄️ DATABASE UTILITIES
// ================================

/**
 * Executes a Supabase RPC with standardized error handling
 */
export async function executeRPC<T>(
  functionName: string,
  params?: Record<string, any>
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const { data, error } = await supabase.rpc(functionName, params);
    
    if (error) {
      console.error(`❌ RPC ${functionName} failed:`, error);
      return {
        data: null,
        error: {
          message: `Database function ${functionName} failed`,
          details: error.message,
          statusCode: 500
        }
      };
    }

    return { data, error: null };
  } catch (error) {
    console.error(`❌ RPC ${functionName} exception:`, error);
    return {
      data: null,
      error: {
        message: `Database function ${functionName} exception`,
        details: error instanceof Error ? error.message : String(error),
        statusCode: 500
      }
    };
  }
}

/**
 * Executes a Supabase query with standardized error handling
 */
export async function executeQuery<T>(
  queryBuilder: any
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const { data, error } = await queryBuilder;
    
    if (error) {
      console.error('❌ Query failed:', error);
      return {
        data: null,
        error: {
          message: 'Database query failed',
          details: error.message,
          statusCode: 500
        }
      };
    }

    return { data, error: null };
  } catch (error) {
    console.error('❌ Query exception:', error);
    return {
      data: null,
      error: {
        message: 'Database query exception',
        details: error instanceof Error ? error.message : String(error),
        statusCode: 500
      }
    };
  }
}

// ================================
// 📊 LOGGING UTILITIES
// ================================

/**
 * Standardized API logging
 */
export function logApiCall(
  method: string,
  endpoint: string,
  params?: Record<string, any>,
  metadata?: Record<string, any>
) {
  const timestamp = new Date().toISOString();
  console.log(`🔗 [${timestamp}] ${method} ${endpoint}`);
  
  if (params && Object.keys(params).length > 0) {
    console.log('📋 Parameters:', params);
  }
  
  if (metadata && Object.keys(metadata).length > 0) {
    console.log('📊 Metadata:', metadata);
  }
}

/**
 * Logs API performance metrics
 */
export function logPerformance(
  operation: string,
  startTime: number,
  metadata?: Record<string, any>
) {
  const duration = Date.now() - startTime;
  const status = duration < 500 ? '🚀 FAST' : duration < 1000 ? '⚡ OK' : '🐌 SLOW';
  
  console.log(`${status} ${operation}: ${duration}ms`);
  
  if (metadata) {
    console.log('📊 Performance metadata:', metadata);
  }
}

// ================================
// 🔧 UTILITY FUNCTIONS
// ================================

/**
 * Safely parses JSON with error handling
 */
export async function safeParseJSON<T>(
  request: Request
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const data = await request.json();
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        message: 'Invalid JSON in request body',
        details: error instanceof Error ? error.message : String(error),
        statusCode: 400
      }
    };
  }
}

/**
 * Extracts wallet address from various sources
 */
export function extractWalletAddress(
  searchParams?: URLSearchParams,
  body?: Record<string, any>
): string | null {
  return (
    searchParams?.get('wallet') ||
    searchParams?.get('walletAddress') ||
    body?.wallet ||
    body?.walletAddress ||
    null
  );
}

/**
 * Validates Ethereum wallet address format
 */
export function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ================================
// 📈 ANALYTICS HELPERS
// ================================

/**
 * Creates standardized metadata for analytics
 */
export function createAnalyticsMetadata(
  operation: string,
  additionalData?: Record<string, any>
): Record<string, any> {
  return {
    operation,
    timestamp: new Date().toISOString(),
    system: 'taste-machine-api',
    ...additionalData
  };
}

/**
 * Formats large numbers for display
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// ================================
// 🎯 EXPORT ALL UTILITIES
// ================================

export default {
  // Response creators
  createSuccessResponse,
  createErrorResponse,
  createValidationError,
  createInternalError,
  createUnauthorizedError,
  createNotFoundError,
  
  // Error handling
  withErrorHandling,
  
  // Validation
  validateQueryParams,
  validateBodyFields,
  
  // Database
  executeRPC,
  executeQuery,
  
  // Logging
  logApiCall,
  logPerformance,
  
  // Utilities
  safeParseJSON,
  extractWalletAddress,
  isValidWalletAddress,
  createAnalyticsMetadata,
  formatNumber
};
