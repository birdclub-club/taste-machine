/**
 * Session Key Management System
 * Allows users to sign once and authorize gasless transactions for a period of time
 */

import { ethers } from 'ethers';

export interface SessionKeyData {
  sessionPrivateKey: string;
  sessionPublicKey: string;
  userAddress: string;
  expiresAt: number;
  maxSpendAmount: string; // In token wei
  tokenLimits: TokenLimit[]; // Multiple token spending limits
  actionsAllowed: SessionAction[];
  nonce: number;
  signature: string; // User's signature authorizing this session
  chainId: number; // Network chain ID
}

export interface TokenLimit {
  tokenAddress: string; // Contract address, or 'ETH' for native
  tokenSymbol: string; // FGUGO, GUGO, ETH
  maxAmount: string; // In token wei
  isMainToken: boolean; // Primary spending token for this session
}

export enum SessionAction {
  CLAIM_PRIZE_BREAK = 'CLAIM_PRIZE_BREAK',
  BUY_VOTES = 'BUY_VOTES', 
  CLAIM_FREE_VOTES = 'CLAIM_FREE_VOTES',
  CAST_VOTE = 'CAST_VOTE'
}

export interface SessionTransaction {
  action: SessionAction;
  amount?: string; // For spending actions
  data?: any; // Additional data for the action
  nonce: number;
}

/**
 * Generate a new session key pair
 */
export function generateSessionKey(): { privateKey: string; publicKey: string; address: string } {
  const wallet = ethers.Wallet.createRandom();
  return {
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    address: wallet.address
  };
}

/**
 * Get network-specific token configurations
 */
export function getNetworkTokenConfig(chainId: number): TokenLimit[] {
  if (chainId === 11124) {
    // Abstract Testnet
    return [
      {
        tokenAddress: '0x3eAd960365697E1809683617af9390ABC9C24E56', // FGUGO contract on Abstract Testnet
        tokenSymbol: 'FGUGO',
        maxAmount: ethers.parseEther('500000').toString(), // 500,000 FGUGO (~$2,250 USD)
        isMainToken: true
      },
      {
        tokenAddress: 'ETH',
        tokenSymbol: 'ETH',
        maxAmount: ethers.parseEther('0.5').toString(), // 0.5 ETH for gas/vote purchases (~$1,750)
        isMainToken: false
      }
    ];
  } else if (chainId === 2741) {
    // Abstract Mainnet
    return [
      {
        tokenAddress: 'TBD_GUGO_MAINNET_CONTRACT', // To be deployed on mainnet
        tokenSymbol: 'GUGO',
        maxAmount: ethers.parseEther('500000').toString(), // 500,000 GUGO (~$2,250 USD)
        isMainToken: true
      },
      {
        tokenAddress: 'ETH',
        tokenSymbol: 'ETH',
        maxAmount: ethers.parseEther('0.5').toString(), // 0.5 ETH for gas/vote purchases (~$1,750)
        isMainToken: false
      }
    ];
  } else {
    // Default/fallback configuration
    return [
      {
        tokenAddress: 'GUGO_CONTRACT_ADDRESS',
        tokenSymbol: 'GUGO',
        maxAmount: ethers.parseEther('500000').toString(), // 500,000 GUGO standard
        isMainToken: true
      }
    ];
  }
}

/**
 * Create authorization message for user to sign
 */
export function createSessionAuthMessage(
  userAddress: string,
  sessionPublicKey: string,
  expiresAt: number,
  tokenLimits: TokenLimit[],
  actionsAllowed: SessionAction[],
  chainId: number
): string {
  const networkName = chainId === 11124 ? 'Abstract Testnet' : 
                     chainId === 2741 ? 'Abstract Mainnet' : 
                     `Chain ${chainId}`;

  // Find the main token for display
  const mainToken = tokenLimits.find(t => t.isMainToken) || tokenLimits[0];
  const mainAmount = mainToken ? ethers.formatEther(mainToken.maxAmount) : '0';
  const mainSymbol = mainToken?.tokenSymbol || 'TOKEN';

  // Create token limits summary
  const tokenLimitsSummary = tokenLimits.map(token => 
    `• ${ethers.formatEther(token.maxAmount)} ${token.tokenSymbol}${token.isMainToken ? ' (primary)' : ''}`
  ).join('\n');

  return `Taste Machine Session Authorization

Network: ${networkName}
User: ${userAddress}
Session Key: ${sessionPublicKey}
Duration: Secure session (expires ${new Date(expiresAt).toLocaleString()})

💰 Spending Limits:
${tokenLimitsSummary}

🎯 Authorized Actions:
${actionsAllowed.map(action => `• ${action.replace('_', ' ')}`).join('\n')}

This signature opens a secure session to interact without repeated approvals.
It allows up to ${Math.round(parseFloat(mainAmount)).toLocaleString()} ${mainSymbol} + 0.5 ETH for vote purchasing.

⚠️ This session expires automatically and is stored only in your browser tab.`;
}

/**
 * Sign a message with the user's wallet to authorize a session
 */
export async function authorizeSession(
  userAddress: string,
  sessionPublicKey: string,
  expiresAt: number,
  tokenLimits: TokenLimit[],
  actionsAllowed: SessionAction[],
  chainId: number
): Promise<string> {
  const message = createSessionAuthMessage(
    userAddress, 
    sessionPublicKey, 
    expiresAt, 
    tokenLimits, 
    actionsAllowed, 
    chainId
  );
  
  // Use wallet to sign the authorization message
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, userAddress]
      });
      
      const mainToken = tokenLimits.find(t => t.isMainToken) || tokenLimits[0];
      const mainAmount = mainToken ? ethers.formatEther(mainToken.maxAmount) : '0';
      
      console.log('✅ Session authorized by user:', {
        userAddress,
        sessionKey: sessionPublicKey,
        chainId,
        expiresAt: new Date(expiresAt).toISOString(),
        mainTokenLimit: `${mainAmount} ${mainToken?.tokenSymbol}`,
        totalTokens: tokenLimits.length,
        signature: signature.substring(0, 10) + '...'
      });
      
      return signature;
    } catch (error) {
      console.error('❌ User rejected session authorization:', error);
      throw new Error('Session authorization rejected');
    }
  } else {
    throw new Error('No wallet available');
  }
}

/**
 * Store session key securely in browser storage
 */
export function storeSessionKey(sessionData: SessionKeyData): void {
  // Store in sessionStorage (cleared when browser tab closes)
  // This is more secure than localStorage for sensitive session keys
  sessionStorage.setItem('taste-machine-session', JSON.stringify(sessionData));
  
  const mainToken = sessionData.tokenLimits?.find(t => t.isMainToken) || sessionData.tokenLimits?.[0];
  const mainAmount = mainToken ? ethers.formatEther(mainToken.maxAmount) : 'N/A';
  
  console.log('💾 Session key stored:', {
    sessionKey: sessionData.sessionPublicKey,
    chainId: sessionData.chainId,
    expiresAt: new Date(sessionData.expiresAt).toISOString(),
    mainTokenLimit: mainToken ? `${mainAmount} ${mainToken.tokenSymbol}` : 'Legacy',
    actionsAllowed: sessionData.actionsAllowed,
    totalTokens: sessionData.tokenLimits?.length || 1
  });
}

/**
 * Retrieve stored session key
 */
export function getStoredSessionKey(): SessionKeyData | null {
  try {
    const stored = sessionStorage.getItem('taste-machine-session');
    if (!stored) return null;
    
    const sessionData: SessionKeyData = JSON.parse(stored);
    
    // Check if session is expired
    if (Date.now() > sessionData.expiresAt) {
      console.log('⏰ Session expired, clearing stored session');
      clearSessionKey();
      return null;
    }
    
    return sessionData;
  } catch (error) {
    console.error('❌ Error retrieving session key:', error);
    return null;
  }
}

/**
 * Clear stored session key
 */
export function clearSessionKey(): void {
  sessionStorage.removeItem('taste-machine-session');
  console.log('🗑️ Session key cleared');
}

/**
 * Sign a transaction with the session key
 */
export async function signSessionTransaction(
  sessionData: SessionKeyData,
  transaction: SessionTransaction
): Promise<string> {
  // Validate session is still valid
  if (Date.now() > sessionData.expiresAt) {
    throw new Error('Session expired');
  }
  
  // Validate action is allowed
  if (!sessionData.actionsAllowed.includes(transaction.action)) {
    throw new Error(`Action ${transaction.action} not authorized for this session`);
  }
  
  // Validate spending limit (if applicable)
  if (transaction.amount) {
    const amountWei = ethers.parseEther(transaction.amount);
    
    // Check against token-specific limits if available
    if (sessionData.tokenLimits && sessionData.tokenLimits.length > 0) {
      // Find the appropriate token limit (use main token by default)
      const tokenSymbol = transaction.data?.tokenSymbol || 
                         sessionData.tokenLimits.find(t => t.isMainToken)?.tokenSymbol ||
                         sessionData.tokenLimits[0].tokenSymbol;
      
      const tokenLimit = sessionData.tokenLimits.find(t => t.tokenSymbol === tokenSymbol);
      
      if (tokenLimit) {
        const maxWei = BigInt(tokenLimit.maxAmount);
        if (amountWei > maxWei) {
          throw new Error(`Transaction amount ${transaction.amount} ${tokenSymbol} exceeds session limit of ${ethers.formatEther(tokenLimit.maxAmount)} ${tokenSymbol}`);
        }
      }
    } else {
      // Fallback to legacy maxSpendAmount
      const maxWei = BigInt(sessionData.maxSpendAmount);
      if (amountWei > maxWei) {
        throw new Error(`Transaction amount ${transaction.amount} exceeds session limit`);
      }
    }
  }
  
  // Create session wallet from private key
  const sessionWallet = new ethers.Wallet(sessionData.sessionPrivateKey);
  
  // Create transaction message
  const transactionMessage = JSON.stringify({
    action: transaction.action,
    amount: transaction.amount || '0',
    data: transaction.data || {},
    nonce: transaction.nonce,
    timestamp: Date.now()
  });
  
  // Sign transaction with session key
  const signature = await sessionWallet.signMessage(transactionMessage);
  
  console.log('✍️ Transaction signed with session key:', {
    action: transaction.action,
    amount: transaction.amount,
    signature: signature.substring(0, 10) + '...'
  });
  
  return signature;
}

/**
 * Verify a session transaction signature
 */
export function verifySessionTransaction(
  sessionData: SessionKeyData,
  transaction: SessionTransaction,
  signature: string
): boolean {
  try {
    // Recreate the message that was signed
    const transactionMessage = JSON.stringify({
      action: transaction.action,
      amount: transaction.amount || '0',
      data: transaction.data || {},
      nonce: transaction.nonce,
      timestamp: transaction.data?.timestamp || Date.now()
    });
    
    // Verify signature was created by session key
    const recoveredAddress = ethers.verifyMessage(transactionMessage, signature);
    const sessionAddress = ethers.computeAddress(sessionData.sessionPublicKey);
    
    const isValid = recoveredAddress.toLowerCase() === sessionAddress.toLowerCase();
    
    console.log('🔐 Session transaction verification:', {
      isValid,
      expectedAddress: sessionAddress,
      recoveredAddress
    });
    
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying session transaction:', error);
    return false;
  }
}

/**
 * Create a new gaming session with network-specific token limits
 */
export async function createGamingSession(userAddress: string, chainId?: number): Promise<SessionKeyData> {
  // Detect current chain ID if not provided
  const currentChainId = chainId || await getCurrentChainId();
  
  // Generate new session key
  const sessionKey = generateSessionKey();
  
  // Set session to expire in 2 hours
  const expiresAt = Date.now() + (2 * 60 * 60 * 1000);
  
  // Get network-specific token configuration
  const tokenLimits = getNetworkTokenConfig(currentChainId);
  
  // Use main token's max amount as the primary spending limit
  const mainToken = tokenLimits.find(t => t.isMainToken) || tokenLimits[0];
  const maxSpendAmount = mainToken?.maxAmount || ethers.parseEther('100000').toString();
  
  // Allow all gaming actions
  const actionsAllowed = [
    SessionAction.CLAIM_PRIZE_BREAK,
    SessionAction.BUY_VOTES,
    SessionAction.CLAIM_FREE_VOTES,
    SessionAction.CAST_VOTE
  ];
  
  console.log('🔑 Creating gaming session with enhanced limits:', {
    chainId: currentChainId,
    mainTokenLimit: mainToken ? `${ethers.formatEther(mainToken.maxAmount)} ${mainToken.tokenSymbol}` : 'N/A',
    totalTokens: tokenLimits.length,
    duration: 'secure session'
  });
  
  // Get user authorization
  const signature = await authorizeSession(
    userAddress,
    sessionKey.address,
    expiresAt,
    tokenLimits,
    actionsAllowed,
    currentChainId
  );
  
  // Create session data
  const sessionData: SessionKeyData = {
    sessionPrivateKey: sessionKey.privateKey,
    sessionPublicKey: sessionKey.address,
    userAddress,
    expiresAt,
    maxSpendAmount,
    tokenLimits,
    actionsAllowed,
    nonce: 0,
    signature,
    chainId: currentChainId
  };
  
  // Store session
  storeSessionKey(sessionData);
  
  return sessionData;
}

/**
 * Get current chain ID from wallet
 */
async function getCurrentChainId(): Promise<number> {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      return parseInt(chainId, 16);
    } catch (error) {
      console.warn('⚠️ Could not detect chain ID, defaulting to Abstract Testnet');
      return 11124; // Default to Abstract Testnet
    }
  }
  return 11124; // Default to Abstract Testnet
}

/**
 * Check if we have a valid session for a specific action
 */
export function hasValidSession(action: SessionAction): boolean {
  const session = getStoredSessionKey();
  if (!session) return false;
  
  return session.actionsAllowed.includes(action) && Date.now() < session.expiresAt;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}