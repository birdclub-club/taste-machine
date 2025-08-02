/**
 * 🔐 Generate a Dedicated Testnet Wallet
 * 
 * This creates a wallet ONLY for testnet use - safe to export since it has no real value
 */

const { ethers } = require('ethers');

function generateTestnetWallet() {
    // Generate a random wallet
    const wallet = ethers.Wallet.createRandom();
    
    console.log('🔐 Generated Dedicated Testnet Wallet');
    console.log('══════════════════════════════════════');
    console.log('📍 Address:', wallet.address);
    console.log('🔑 Private Key:', wallet.privateKey);
    console.log('🔤 Mnemonic:', wallet.mnemonic.phrase);
    console.log('══════════════════════════════════════');
    console.log('');
    console.log('🚨 IMPORTANT SECURITY NOTES:');
    console.log('✅ This wallet is ONLY for Abstract testnet');
    console.log('✅ Never send real ETH or tokens to this address');
    console.log('✅ Only use testnet ETH from faucets');
    console.log('✅ Safe to store this key since it has no real value');
    console.log('');
    console.log('📋 Setup Instructions:');
    console.log('1. Copy the private key above');
    console.log('2. Add to your .env file: PRIVATE_KEY=' + wallet.privateKey);
    console.log('3. Get testnet ETH from Abstract faucet');
    console.log('4. Deploy your contract safely!');
    console.log('');
    console.log('🌐 Abstract Testnet Info:');
    console.log('• Faucet: https://portal.abstract.xyz/faucet');
    console.log('• Explorer: https://explorer.testnet.abs.xyz');
    console.log('• RPC: https://api.testnet.abs.xyz');
    console.log('• Chain ID: 11124');
    
    return wallet;
}

if (require.main === module) {
    generateTestnetWallet();
}

module.exports = { generateTestnetWallet };