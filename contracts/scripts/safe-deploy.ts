/**
 * 🔒 Safe-Compatible Contract Deployment
 * 
 * This deployment method works with:
 * - Gnosis Safe (multisig wallets)
 * - Hardware wallets via Safe
 * - Safe Transaction Service
 * - MetaMask with Safe interface
 */

import { ethers } from "hardhat";
import { getCurrentNetworkConfig } from "../config/networks";

interface SafeDeploymentConfig {
  safeAddress?: string;           // Your Safe wallet address
  proposerAddress?: string;       // Address that can propose transactions
  useTransactionService?: boolean; // Use Safe Transaction Service
  requireConfirmations?: number;   // Number of Safe confirmations needed
}

async function createDeploymentTransaction() {
  console.log("🏗️ Preparing Safe-compatible deployment...");
  
  // Get network configuration
  const config = getCurrentNetworkConfig();
  console.log(`🌐 Network: ${config.name} (Chain ID: ${config.chainId})`);
  
  // Get contract factory (use updated version with 4-wallet system)
  const GugoVoteManager = await ethers.getContractFactory("contracts/GugoVoteManager_updated.sol:GugoVoteManager");
  
  // Get deployment transaction data (without sending)
  const deploymentTx = await GugoVoteManager.getDeployTransaction();
  
  console.log("📋 Deployment Transaction Details:");
  console.log("─────────────────────────────────────");
  console.log(`📄 Contract: GugoVoteManager_updated`);
  console.log(`💾 Bytecode Size: ${deploymentTx.data?.length} characters`);
  // Estimate gas (use a reasonable default if estimation fails)
  let gasEstimate = 3000000; // Default gas limit
  try {
    if (GugoVoteManager.signer) {
      gasEstimate = await GugoVoteManager.signer.estimateGas(deploymentTx);
    }
  } catch (error) {
    console.log("⚠️ Gas estimation failed, using default:", gasEstimate);
  }
  
  console.log(`⛽ Estimated Gas: ${gasEstimate}`);
  console.log(`🔗 Network: ${config.name}`);
  console.log(`🏦 4-Wallet System: Ready`);
  
  return {
    to: null, // Contract creation
    value: 0,
    data: deploymentTx.data,
    gasLimit: gasEstimate,
    network: config,
    contractName: "GugoVoteManager (4-Wallet Revenue System)"
  };
}

async function createConfigurationTransactions(contractAddress: string, safeConfig: SafeDeploymentConfig) {
  console.log("⚙️ Preparing configuration transactions...");
  
  const config = getCurrentNetworkConfig();
  const GugoVoteManager = await ethers.getContractFactory("contracts/GugoVoteManager_updated.sol:GugoVoteManager");
  const contract = GugoVoteManager.attach(contractAddress);
  
  const transactions = [];
  
  // 1. Set Operations Wallet (your Safe address)
  if (safeConfig.safeAddress) {
    const setOpsWalletTx = await contract.setOperationsWallet.populateTransaction(safeConfig.safeAddress);
    transactions.push({
      to: contractAddress,
      value: 0,
      data: setOpsWalletTx.data,
      description: "Set Operations Wallet to Safe address"
    });
  }
  
  // 2. Set GUGO Token
  const setTokenTx = await contract.setGugoToken.populateTransaction(config.gugoTokenAddress);
  transactions.push({
    to: contractAddress,
    value: 0,
    data: setTokenTx.data,
    description: `Set GUGO token to ${config.gugoTokenAddress}`
  });
  
  return transactions;
}

async function generateSafeTransactionBundle(safeConfig: SafeDeploymentConfig) {
  console.log("🔒 Generating Safe Transaction Bundle...");
  console.log("════════════════════════════════════════");
  
  try {
    // Step 1: Generate deployment transaction
    const deploymentTx = await createDeploymentTransaction();
    
    // Step 2: Calculate future contract address
    const deployer = safeConfig.safeAddress || "YOUR_SAFE_ADDRESS";
    const nonce = 0; // Adjust based on Safe's nonce
    const futureAddress = ethers.getCreateAddress({ from: deployer, nonce });
    
    console.log(`🎯 Predicted Contract Address: ${futureAddress}`);
    
    // Step 3: Generate configuration transactions
    const configTxs = await createConfigurationTransactions(futureAddress, safeConfig);
    
    // Step 4: Create Safe transaction bundle
    const bundle = {
      chainId: deploymentTx.network.chainId,
      networkName: deploymentTx.network.name,
      transactions: [
        {
          ...deploymentTx,
          description: "Deploy GugoVoteManager with 4-wallet revenue system"
        },
        ...configTxs
      ],
      safeConfig,
      instructions: generateInstructions(deploymentTx.network.name)
    };
    
    // Step 5: Output for Safe interface (handle BigInt serialization)
    console.log("📋 Safe Transaction Bundle Generated:");
    console.log(JSON.stringify(bundle, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
    
    // Step 6: Generate Safe App URL (if available)
    const safeAppUrl = generateSafeAppUrl(bundle);
    if (safeAppUrl) {
      console.log(`🔗 Safe App URL: ${safeAppUrl}`);
    }
    
    return bundle;
    
  } catch (error) {
    console.error("❌ Error generating Safe bundle:", error);
    throw error;
  }
}

function generateInstructions(networkName: string) {
  return {
    title: "🏦 Deploy 4-Wallet Revenue System",
    steps: [
      "1. 🔒 Open your Safe wallet interface",
      `2. 🌐 Ensure you're on ${networkName}`,
      "3. 📋 Create new transaction batch",
      "4. 📄 Add deployment transaction (contract creation)",
      "5. ⚙️ Add configuration transactions",
      "6. 👥 Get required confirmations from Safe signers",
      "7. 🚀 Execute transaction batch",
      "8. ✅ Verify deployment on block explorer"
    ],
    important: [
      "⚠️ Verify all transaction data before signing",
      "⚠️ Ensure sufficient ETH for gas fees",
      "⚠️ Double-check operations wallet address",
      "⚠️ Confirm GUGO token address is correct"
    ]
  };
}

function generateSafeAppUrl(bundle: any): string | null {
  // Generate URL for Safe Transaction Builder app
  // This would integrate with Safe's transaction builder
  const baseUrl = "https://app.safe.global/apps";
  const chainId = bundle.chainId;
  
  // For now, return generic Safe app URL
  // In production, this would generate a specific transaction bundle URL
  return `${baseUrl}?chain=${chainId}`;
}

// CLI interface
async function main() {
  console.log("🔒 Safe-Compatible GugoVoteManager Deployment");
  console.log("═════════════════════════════════════════════");
  
  // Configuration - update these values
  const safeConfig: SafeDeploymentConfig = {
    safeAddress: process.env.SAFE_ADDRESS || "0x544f075E54aa90fDB21c19C02e45bD8Faded6A87", // Your operations wallet
    proposerAddress: process.env.PROPOSER_ADDRESS,
    useTransactionService: true,
    requireConfirmations: 1 // Adjust based on your Safe setup
  };
  
  console.log("📋 Safe Configuration:");
  console.log(`🏦 Safe Address: ${safeConfig.safeAddress}`);
  console.log(`👤 Proposer: ${safeConfig.proposerAddress || "Not set"}`);
  console.log(`🔄 Transaction Service: ${safeConfig.useTransactionService ? "Enabled" : "Disabled"}`);
  console.log(`✅ Required Confirmations: ${safeConfig.requireConfirmations}`);
  console.log("");
  
  try {
    const bundle = await generateSafeTransactionBundle(safeConfig);
    
    console.log("🎉 Safe deployment bundle ready!");
    console.log("📄 Use the transaction data above in your Safe interface");
    console.log("🔗 Visit https://app.safe.global to execute transactions");
    
  } catch (error) {
    console.error("❌ Deployment preparation failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { createDeploymentTransaction, createConfigurationTransactions, generateSafeTransactionBundle };