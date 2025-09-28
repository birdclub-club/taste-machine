#!/usr/bin/env node

/**
 * 🔧 API Route Refactoring Script
 * 
 * Automatically refactors existing API routes to use standardized utilities
 * and consistent error handling patterns.
 * 
 * Usage: node scripts/refactor-api-routes.js [--dry-run] [--route=specific-route]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_DIR = path.join(__dirname, '../src/app/api');
const BACKUP_DIR = path.join(__dirname, '../backups/api-routes');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const specificRoute = args.find(arg => arg.startsWith('--route='))?.split('=')[1];

// Refactoring patterns
const REFACTORING_PATTERNS = {
  // Import statements to add
  imports: `import {
  withErrorHandling,
  createSuccessResponse,
  createValidationError,
  createInternalError,
  createUnauthorizedError,
  validateQueryParams,
  validateBodyFields,
  executeRPC,
  executeQuery,
  logApiCall,
  extractWalletAddress,
  isValidWalletAddress,
  safeParseJSON
} from '../../../lib/api-utils';`,

  // Error response patterns to replace
  errorPatterns: [
    {
      // Pattern 1: NextResponse.json({ error: 'message' }, { status: 500 })
      regex: /NextResponse\.json\(\s*{\s*error:\s*['"`]([^'"`]+)['"`]\s*}\s*,\s*{\s*status:\s*(\d+)\s*}\s*\)/g,
      replacement: (match, message, status) => {
        if (status === '400') return `createValidationError('${message}')`;
        if (status === '401') return `createUnauthorizedError('${message}')`;
        if (status === '404') return `createNotFoundError('${message}')`;
        return `createInternalError('${message}')`;
      }
    },
    {
      // Pattern 2: NextResponse.json({ success: false, error: 'message' }, { status: 500 })
      regex: /NextResponse\.json\(\s*{\s*success:\s*false\s*,\s*error:\s*['"`]([^'"`]+)['"`]\s*}\s*,\s*{\s*status:\s*(\d+)\s*}\s*\)/g,
      replacement: (match, message, status) => {
        if (status === '400') return `createValidationError('${message}')`;
        if (status === '401') return `createUnauthorizedError('${message}')`;
        if (status === '404') return `createNotFoundError('${message}')`;
        return `createInternalError('${message}')`;
      }
    }
  ],

  // Success response patterns
  successPatterns: [
    {
      // Pattern: NextResponse.json({ success: true, data: ... })
      regex: /NextResponse\.json\(\s*{\s*success:\s*true\s*,\s*([^}]+)\s*}\s*(?:,\s*{\s*status:\s*(\d+)\s*})?\s*\)/g,
      replacement: (match, dataFields, status) => {
        const statusCode = status || '200';
        return `createSuccessResponse({ ${dataFields} }, undefined, ${statusCode})`;
      }
    }
  ],

  // Validation patterns
  validationPatterns: [
    {
      // Pattern: if (!param) { return error }
      regex: /if\s*\(\s*!([^)]+)\s*\)\s*{\s*return\s+NextResponse\.json\([^}]+error[^}]+\)\s*;\s*}/g,
      replacement: (match, param) => {
        return `// TODO: Replace with validateQueryParams or validateBodyFields`;
      }
    }
  ]
};

/**
 * Creates backup directory if it doesn't exist
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Creates a backup of the original file
 */
function backupFile(filePath) {
  const relativePath = path.relative(API_DIR, filePath);
  const backupPath = path.join(BACKUP_DIR, relativePath);
  const backupDir = path.dirname(backupPath);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`💾 Backed up: ${relativePath}`);
}

/**
 * Finds all API route files
 */
function findApiRoutes() {
  const routes = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        scanDirectory(itemPath);
      } else if (item === 'route.ts' && !itemPath.includes('route-refactored.ts')) {
        routes.push(itemPath);
      }
    }
  }
  
  scanDirectory(API_DIR);
  return routes;
}

/**
 * Analyzes a route file for refactoring opportunities
 */
function analyzeRoute(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(API_DIR, filePath);
  
  const analysis = {
    path: relativePath,
    fullPath: filePath,
    issues: [],
    improvements: [],
    complexity: 0
  };
  
  // Check for inconsistent error patterns
  const errorPatterns = [
    /NextResponse\.json\(\s*{\s*error:/g,
    /NextResponse\.json\(\s*{\s*success:\s*false/g,
    /status:\s*500/g,
    /status:\s*400/g
  ];
  
  errorPatterns.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      analysis.issues.push(`${matches.length} inconsistent error pattern(s) type ${index + 1}`);
      analysis.complexity += matches.length;
    }
  });
  
  // Check for duplicate Supabase connection logic
  if (content.includes('createClient') || content.includes('supabaseUrl')) {
    analysis.issues.push('Duplicate Supabase connection logic');
    analysis.complexity += 2;
  }
  
  // Check for missing error handling
  const tryBlocks = (content.match(/try\s*{/g) || []).length;
  const catchBlocks = (content.match(/catch\s*\(/g) || []).length;
  if (tryBlocks !== catchBlocks) {
    analysis.issues.push('Inconsistent try/catch blocks');
    analysis.complexity += 1;
  }
  
  // Check for validation opportunities
  if (content.includes('searchParams.get') && !content.includes('validateQueryParams')) {
    analysis.improvements.push('Can use validateQueryParams utility');
  }
  
  if (content.includes('request.json()') && !content.includes('safeParseJSON')) {
    analysis.improvements.push('Can use safeParseJSON utility');
  }
  
  if (content.includes('.rpc(') && !content.includes('executeRPC')) {
    analysis.improvements.push('Can use executeRPC utility');
  }
  
  return analysis;
}

/**
 * Refactors a single route file
 */
function refactorRoute(filePath, analysis) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  console.log(`🔧 Refactoring: ${analysis.path}`);
  
  // Add imports if not present
  if (!content.includes('api-utils')) {
    const importIndex = content.indexOf('import');
    if (importIndex !== -1) {
      content = content.slice(0, importIndex) + 
                REFACTORING_PATTERNS.imports + '\n' + 
                content.slice(importIndex);
      changes++;
    }
  }
  
  // Replace error patterns
  REFACTORING_PATTERNS.errorPatterns.forEach(pattern => {
    const matches = content.match(pattern.regex);
    if (matches) {
      content = content.replace(pattern.regex, pattern.replacement);
      changes += matches.length;
    }
  });
  
  // Replace success patterns
  REFACTORING_PATTERNS.successPatterns.forEach(pattern => {
    const matches = content.match(pattern.regex);
    if (matches) {
      content = content.replace(pattern.regex, pattern.replacement);
      changes += matches.length;
    }
  });
  
  // Add withErrorHandling wrapper to exports
  if (!content.includes('withErrorHandling')) {
    content = content.replace(
      /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g,
      'export const $1 = withErrorHandling(async ('
    );
    
    // Close the wrapper
    content = content.replace(
      /}\s*$/g,
      '});'
    );
    
    changes++;
  }
  
  console.log(`  ✅ Applied ${changes} changes`);
  return { content, changes };
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting API Route Refactoring');
  console.log(`📁 Scanning directory: ${API_DIR}`);
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified');
  }
  
  // Find all API routes
  const routes = findApiRoutes();
  console.log(`📋 Found ${routes.length} API routes`);
  
  // Filter to specific route if specified
  const routesToProcess = specificRoute 
    ? routes.filter(route => route.includes(specificRoute))
    : routes;
  
  if (routesToProcess.length === 0) {
    console.log('❌ No routes found to process');
    return;
  }
  
  console.log(`🎯 Processing ${routesToProcess.length} routes`);
  
  // Ensure backup directory exists
  if (!isDryRun) {
    ensureBackupDir();
  }
  
  // Analyze and refactor each route
  const results = {
    analyzed: 0,
    refactored: 0,
    totalChanges: 0,
    errors: []
  };
  
  for (const routePath of routesToProcess) {
    try {
      // Analyze the route
      const analysis = analyzeRoute(routePath);
      results.analyzed++;
      
      console.log(`\n📊 Analysis: ${analysis.path}`);
      console.log(`  Issues: ${analysis.issues.length}`);
      console.log(`  Improvements: ${analysis.improvements.length}`);
      console.log(`  Complexity: ${analysis.complexity}`);
      
      if (analysis.issues.length > 0) {
        console.log(`  🚨 Issues found:`);
        analysis.issues.forEach(issue => console.log(`    - ${issue}`));
      }
      
      if (analysis.improvements.length > 0) {
        console.log(`  💡 Improvements available:`);
        analysis.improvements.forEach(improvement => console.log(`    - ${improvement}`));
      }
      
      // Refactor if issues found and not dry run
      if (analysis.complexity > 0 && !isDryRun) {
        // Create backup
        backupFile(routePath);
        
        // Refactor the route
        const { content, changes } = refactorRoute(routePath, analysis);
        
        // Write refactored content
        fs.writeFileSync(routePath, content, 'utf8');
        
        results.refactored++;
        results.totalChanges += changes;
        
        console.log(`  ✅ Refactored with ${changes} changes`);
      } else if (analysis.complexity === 0) {
        console.log(`  ✨ Route already follows best practices`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${routePath}:`, error.message);
      results.errors.push({ path: routePath, error: error.message });
    }
  }
  
  // Summary
  console.log('\n📊 REFACTORING SUMMARY');
  console.log(`Routes analyzed: ${results.analyzed}`);
  console.log(`Routes refactored: ${results.refactored}`);
  console.log(`Total changes applied: ${results.totalChanges}`);
  console.log(`Errors encountered: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(({ path, error }) => {
      console.log(`  ${path}: ${error}`);
    });
  }
  
  if (!isDryRun && results.refactored > 0) {
    console.log(`\n💾 Backups created in: ${BACKUP_DIR}`);
    console.log('🔧 Run linting and tests to verify refactored routes');
  }
  
  if (isDryRun) {
    console.log('\n🔍 DRY RUN COMPLETE - Run without --dry-run to apply changes');
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  analyzeRoute,
  refactorRoute,
  findApiRoutes
};
