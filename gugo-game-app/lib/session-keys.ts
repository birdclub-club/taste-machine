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

  // Create spending limits summary
  const spendingLimits = tokenLimits.map(token => 
    `• Up to ${ethers.formatEther(token.maxAmount)} ${token.tokenSymbol}${token.tokenSymbol === 'ETH' ? '' : ' (for vote-related actions)'}`
  ).join('\n');

  // Create authorized actions summary
  const authorizedActions = actionsAllowed.map(action => `• ${action}`).join('\n');

  return `Taste Machine: Secure Session Authorization
You are authorizing a temporary session to interact with Taste Machine without needing to sign each transaction individually.

Network: ${networkName}
User: ${userAddress}
Session Key: ${sessionPublicKey}
Session Duration: Until ${new Date(expiresAt).toLocaleString()} (local time)

Spending Limits:
${spendingLimits}

Authorized Actions:
${authorizedActions}

This session key is only valid in this browser tab and will expire automatically at the time listed above. No funds can be moved beyond the authorized limits. You may revoke access at any time.

By signing this message, you enable a secure and seamless voting experience on Taste Machine.`;
}

/**
 * Sign a message with the user's wallet to authorize a session
 * Uses wagmi/viem for better wallet compatibility (AGW, MetaMask, etc.)
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
  
  // Try to use wagmi/viem first for better wallet compatibility
  if (typeof window !== 'undefined') {
    try {
      console.log('🔄 Starting wagmi session authorization process...');
      
      // Import wagmi dynamically to avoid SSR issues
      console.log('📦 Importing wagmi modules...');
      const { signMessage } = await import('wagmi/actions');
      const { config } = await import('./wagmi');
      
      console.log('✅ Wagmi modules imported successfully');
      console.log('🔑 Requesting session authorization signature from wallet...', {
        wallet: 'wagmi',
        userAddress,
        messageLength: message.length,
        message: message.substring(0, 100) + '...'
      });
      
      console.log('⏳ Calling signMessage - user should see wallet popup now...');
      
      // Add timeout to prevent infinite hanging
      const signaturePromise = signMessage(config, {
        message,
        account: userAddress as `0x${string}`
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log('⏰ Signature request timed out after 30 seconds');
          reject(new Error('Signature request timed out after 30 seconds'));
        }, 30000);
      });
      
      const signature = await Promise.race([signaturePromise, timeoutPromise]) as string;
      
      console.log('✅ Signature received from wagmi:', signature.substring(0, 10) + '...');
      
      const mainToken = tokenLimits.find(t => t.isMainToken) || tokenLimits[0];
      const mainAmount = mainToken ? ethers.formatEther(mainToken.maxAmount) : '0';
      
      console.log('✅ Session authorized by user via wagmi:', {
        userAddress,
        sessionKey: sessionPublicKey,
        chainId,
        expiresAt: new Date(expiresAt).toISOString(),
        mainTokenLimit: `${mainAmount} ${mainToken?.tokenSymbol}`,
        totalTokens: tokenLimits.length,
        signature: signature.substring(0, 10) + '...'
      });
      
      return signature;
    } catch (wagmiError: any) {
      console.log('⚠️ Wagmi signing failed, analyzing error...', {
        error: wagmiError,
        message: wagmiError?.message,
        code: wagmiError?.code,
        name: wagmiError?.name
      });
      
      // Check if this is a user rejection
      if (wagmiError?.message?.toLowerCase().includes('rejected') || 
          wagmiError?.message?.toLowerCase().includes('denied') ||
          wagmiError?.code === 4001) {
        console.log('👋 User rejected wagmi signature request');
        throw new Error('Session authorization rejected');
      }
      
      console.log('🔄 Falling back to window.ethereum due to wagmi error:', wagmiError?.message);
      
      // Try to get the provider from wagmi first for AGW compatibility
      let provider = window.ethereum;
      
      try {
        console.log('🔄 Attempting to get provider from wagmi config...');
        const { getConnectors } = await import('wagmi/actions');
        const { config: wagmiConfig } = await import('./wagmi');
        const connectors = getConnectors(wagmiConfig);
        const activeConnector = connectors.find(c => c.name.toLowerCase().includes('abstract'));
        
        if (activeConnector) {
          console.log('✅ Found AGW connector, getting provider...');
          const connectorProvider = await activeConnector.getProvider();
          if (connectorProvider) {
            provider = connectorProvider;
            console.log('✅ Using AGW-specific provider for signing');
          }
        }
      } catch (providerError) {
        console.log('⚠️ Could not get AGW provider, using window.ethereum:', providerError);
      }
      
      // Fallback to window.ethereum or AGW provider
      if (provider) {
        try {
          console.log('🔑 Requesting session authorization signature via provider...', {
            providerType: provider === window.ethereum ? 'window.ethereum' : 'AGW provider'
          });
          
          const signature = await provider.request({
            method: 'personal_sign',
            params: [message, userAddress]
          });
          
          const mainToken = tokenLimits.find(t => t.isMainToken) || tokenLimits[0];
          const mainAmount = mainToken ? ethers.formatEther(mainToken.maxAmount) : '0';
          
          console.log('✅ Session authorized by user via provider:', {
            userAddress,
            sessionKey: sessionPublicKey,
            chainId,
            expiresAt: new Date(expiresAt).toISOString(),
            mainTokenLimit: `${mainAmount} ${mainToken?.tokenSymbol}`,
            totalTokens: tokenLimits.length,
            signature: signature.substring(0, 10) + '...'
          });
          
          return signature;
        } catch (ethError) {
          console.error('❌ User rejected session authorization via provider:', ethError);
          throw new Error('Session authorization rejected');
        }
      } else {
        console.error('❌ User rejected session authorization via wagmi:', wagmiError);
        throw new Error('Session authorization rejected');
      }
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

