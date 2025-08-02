#!/usr/bin/env node

/**
 * GUGO Price Update Script
 * 
 * This script helps you update the GUGO price in the codebase based on real market data.
 * Run this daily or whenever you need to update the GUGO closing price.
 * 
 * Usage:
 *   node scripts/update-gugo-price.js [price]
 *   
 * Examples:
 *   node scripts/update-gugo-price.js 0.15
 *   node scripts/update-gugo-price.js 0.25
 */

const fs = require('fs');
const path = require('path');

// Get the price from command line argument
const newPrice = process.argv[2];

if (!newPrice || isNaN(parseFloat(newPrice)) || parseFloat(newPrice) <= 0) {
  console.log('❌ Please provide a valid GUGO price');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/update-gugo-price.js [price]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/update-gugo-price.js 0.15  # Sets GUGO to $0.15');
  console.log('  node scripts/update-gugo-price.js 0.25  # Sets GUGO to $0.25');
  console.log('');
  process.exit(1);
}

const price = parseFloat(newPrice);
const priceInCents = Math.round(price * 100);
const priceWith8Decimals = Math.round(price * 100000000); // For smart contract (price * 1e8)

console.log(`🪙 Updating GUGO price to $${price}`);
console.log(`📊 Price in cents: ${priceInCents}¢`);
console.log(`🔢 Price for smart contract: ${priceWith8Decimals} (${price} * 1e8)`);

// Files to update
const filesToUpdate = [
  {
    file: 'lib/token.ts',
    search: /const estimatedPrice = [0-9.]+; \/\/ \$[0-9.]+ - Update with real market price/,
    replace: `const estimatedPrice = ${price}; // $${price} - Updated ${new Date().toDateString()}`
  },
  {
    file: 'lib/token.ts', 
    search: /const fallbackPrice = [0-9.]+; \/\/ \$[0-9.]+ fallback/,
    replace: `const fallbackPrice = ${price}; // $${price} fallback`
  },
  {
    file: '../contracts/config/networks.ts',
    search: /gugoPriceUSD: BigInt\("15000000"\),     \/\/ \$0\.15 \* 1e8 \(yesterday's GUGO close - update with real data\)/,
    replace: `gugoPriceUSD: BigInt("${priceWith8Decimals}"),     // $${price} * 1e8 (yesterday's GUGO close - updated ${new Date().toDateString()})`
  }
];

let updatedFiles = 0;

filesToUpdate.forEach(({ file, search, replace }) => {
  const filePath = path.resolve(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (search.test(content)) {
      const newContent = content.replace(search, replace);
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Updated ${file}`);
      updatedFiles++;
    } else {
      console.log(`⚠️  Pattern not found in ${file}`);
    }
  } catch (error) {
    console.log(`❌ Error updating ${file}:`, error.message);
  }
});

if (updatedFiles > 0) {
  console.log('');
  console.log(`🎉 Successfully updated ${updatedFiles} file(s) with GUGO price $${price}`);
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Restart your development server to pick up the changes');
  console.log('2. Test the new pricing in your application');
  console.log('3. Deploy updated smart contracts if needed');
  console.log('4. Consider updating the mainnet config as well');
} else {
  console.log('');
  console.log('❌ No files were updated. Please check the patterns and file paths.');
} 