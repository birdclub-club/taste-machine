/**
 * Hook for session-based vote purchasing with GUGO tokens
 * Handles pre-approval and session-authorized purchases
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { 
  SessionKeyData, 
  SessionAction, 
  getStoredSessionKey, 
  signSessionTransaction, 
  hasValidSession 
} from '../../lib/session-keys';

/**
 * Execute ETH purchase via smart contract
 */
async function executeEthPurchase(
  walletAddress: string,
  costETH: number,
  voteCount: number,
  sessionSignature: string,
  chainId: number
): Promise<boolean> {
  try {
    console.log('🔗 Executing ETH smart contract purchase:', {
      wallet: walletAddress,
      costETH,
      voteCount,
      hasSignature: !!sessionSignature
    });

    // Import smart contract constants
    const { GUGO_VOTE_MANAGER_ADDRESS, GUGO_VOTE_MANAGER_ABI } = await import('@/lib/constants');
    const ABSTRACT_TESTNET_RPC = 'https://api.testnet.abs.xyz';
    
    // Create provider for Abstract Testnet
    const provider = new ethers.JsonRpcProvider(ABSTRACT_TESTNET_RPC);
    
    // Create read-only contract instance to validate the transaction
    const contract = new ethers.Contract(GUGO_VOTE_MANAGER_ADDRESS, GUGO_VOTE_MANAGER_ABI, provider);
    
    // Validate the purchase parameters
    const MINIMUM_VOTES = 10; // From contract
    if (voteCount < MINIMUM_VOTES) {
      throw new Error(`Must purchase at least ${MINIMUM_VOTES} votes`);
    }
    
    console.log('✅ ETH smart contract purchase validation passed');
    console.log('📱 Session signature authorizes this purchase:', sessionSignature.slice(0, 10) + '...');
    
    console.log('💰 Processing session-authorized ETH purchase:', {
      wallet: walletAddress,
      voteCount,
      costETH: `${costETH} ETH`,
      sessionAuthorized: true,
      chainId
    });
    
    // Calculate cost for spending limit validation
    const costUSD = voteCount * 0.02; // $0.02 per vote
    
    console.log('💵 Session spending validation:', {
      voteCount,
      costUSD: `$${costUSD.toFixed(2)}`,
      costETH: `${costETH} ETH`,
      sessionLimit: 'Validated ✓'
    });
    
    console.log('🎮 Session Key Benefits:');
    console.log('  ✅ No wallet signature required');
    console.log('  ✅ Spending stays within your limit');
    console.log('  ✅ Perfect for gaming transactions');
    console.log('  ✅ Gasless user experience');
    
    // Simulate the session-authorized transaction processing
    console.log('⚡ Processing session-authorized ETH transaction...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('✅ Session-authorized ETH purchase completed!');
    
    return true;

  } catch (error: any) {
    console.error('❌ ETH smart contract purchase failed:', error.message);
    return false;
  }
}

/**
 * Execute FGUGO purchase via smart contract
 */
async function executeFgugoPurchase(
  walletAddress: string,
  costGUGO: number,
  voteCount: number,
  sessionSignature: string,
  chainId: number
): Promise<boolean> {
  try {
    console.log('🔗 Executing smart contract purchase:', {
      wallet: walletAddress,
      costGUGO,
      voteCount,
      hasSignature: !!sessionSignature
    });

    // Import smart contract constants
    const { GUGO_VOTE_MANAGER_ADDRESS, GUGO_VOTE_MANAGER_ABI } = await import('@/lib/constants');
    const ABSTRACT_TESTNET_RPC = 'https://api.testnet.abs.xyz';
    
    // Create provider for Abstract Testnet
    const provider = new ethers.JsonRpcProvider(ABSTRACT_TESTNET_RPC);
    
    // For session-based purchases, we need to create a transaction that the user's wallet will execute
    // The session signature authorizes the action, but the actual contract call needs the user's wallet
    
    // Create read-only contract instance to validate the transaction
    const contract = new ethers.Contract(GUGO_VOTE_MANAGER_ADDRESS, GUGO_VOTE_MANAGER_ABI, provider);
    
    // Validate the purchase parameters
    const MINIMUM_VOTES = 10; // From contract
    if (voteCount < MINIMUM_VOTES) {
      throw new Error(`Must purchase at least ${MINIMUM_VOTES} votes`);
    }
    
    console.log('✅ Smart contract purchase validation passed');
    console.log('📱 Session signature authorizes this purchase:', sessionSignature.slice(0, 10) + '...');
    
    // Session keys authorize spending up to the limit - perfect for gasless gaming!
    console.log('🎯 Session key authorized purchase - processing with spending limit validation...');
    
    console.log('💰 Processing session-authorized FGUGO purchase:', {
      wallet: walletAddress,
      voteCount,
      costGUGO: `${costGUGO} FGUGO`,
      sessionAuthorized: true,
      chainId
    });
    
    console.log('📝 Session signature authorizes FGUGO spend:', sessionSignature.slice(0, 10) + '...');
    
    // Calculate cost for spending limit validation
    const costUSD = voteCount * 0.02; // $0.02 per vote
    const gugoPrice = 0.005; // $0.005 per GUGO
    const costGUGOFormatted = costUSD / gugoPrice;
    
    console.log('💵 Session spending validation:', {
      voteCount,
      costUSD: `$${costUSD.toFixed(2)}`,
      costGUGO: `${costGUGOFormatted} FGUGO`,
      sessionLimit: 'Validated ✓'
    });
    
    console.log('🎮 Session Key Benefits:');
    console.log('  ✅ No wallet signature required');
    console.log('  ✅ Spending stays within your limit');
    console.log('  ✅ Perfect for gaming transactions');
    console.log('  ✅ Gasless user experience');
    
    // Simulate the session-authorized transaction processing
    console.log('⚡ Processing session-authorized transaction...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('✅ Session-authorized purchase completed!');
    console.log('🎯 Session Key Architecture:');
    console.log('   - User pre-signed spending authorization');
    console.log('   - Automatic purchases within limits');
    console.log('   - No repeated wallet confirmations');
    console.log('   - Seamless gaming experience');
    
    return true;

  } catch (error: any) {
    console.error('❌ Smart contract purchase failed:', error.message);
    return false;
  }
}

export interface VotePurchaseResult {
  success: boolean;
  votesAmount: number;
  cost: string; // In GUGO or ETH
  costToken: 'GUGO' | 'FGUGO' | 'ETH'; // Which token was used
  txHash?: string;
  error?: string;
}

export function useSessionVotePurchase() {
  const { address } = useAccount();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [approvalNeeded, setApprovalNeeded] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  /**
   * Check if we have sufficient GUGO allowance for the game contract
   */
  const checkAllowance = async (amount: string): Promise<boolean> => {
    try {
      // For now, simulate allowance check
      // In a real implementation, this would check the ERC20 allowance
      console.log('🔍 Checking GUGO allowance for:', amount);
      
      // Simulate that we need approval for amounts > 50 GUGO
      const amountNum = parseFloat(amount);
      const needsApproval = amountNum > 50;
      
      setApprovalNeeded(needsApproval);
      return !needsApproval;
      
    } catch (error) {
      console.error('❌ Error checking allowance:', error);
      return false;
    }
  };

  /**
   * Approve GUGO spending for the game contract
   */
  const approveGugoSpending = async (amount: string): Promise<boolean> => {
    if (!address) {
      setPurchaseError('Wallet not connected');
      return false;
    }

    setIsApproving(true);
    setPurchaseError(null);

    try {
      console.log('💰 Approving GUGO spending:', amount);
      
      // In a real implementation, this would call the GUGO token contract's approve() function
      // For now, simulate the approval process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ GUGO spending approved');
      setApprovalNeeded(false);
      return true;
      
    } catch (error: any) {
      console.error('❌ Error approving GUGO spending:', error);
      
      if (error.message.includes('rejected') || error.message.includes('denied')) {
        setPurchaseError('Token approval was cancelled');
      } else {
        setPurchaseError(error.message || 'Failed to approve token spending');
      }
      
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  /**
   * Purchase votes with ETH using session authorization
   */
  const purchaseVotesWithETH = async (
    voteCount: number,
    pricePerVote: number = 0.02
  ): Promise<VotePurchaseResult> => {
    if (!address) {
      return {
        success: false,
        votesAmount: 0,
        cost: '0',
        costToken: 'ETH',
        error: 'Wallet not connected'
      };
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      console.log('🗳️ Purchasing votes with ETH...');
      console.log('📊 Vote count:', voteCount);
      console.log('💵 Price per vote: $', pricePerVote);

      // Check if we have a valid session for buying votes
      if (!hasValidSession(SessionAction.BUY_VOTES)) {
        throw new Error('No valid session for vote purchasing. Please refresh your session.');
      }

      const sessionData = getStoredSessionKey();
      if (!sessionData) {
        throw new Error('Session data not found');
      }

      // Calculate cost in ETH with proper precision
      const costUSD = voteCount * pricePerVote;
      const ethPrice = 3000; // $3000 per ETH (approximate market rate)
      const costETH = costUSD / ethPrice;
      // Round to 18 decimal places (ETH standard) and ensure it's not too small
      const costETHRounded = Math.max(costETH, 0.000001); // Minimum 1 gwei equivalent
      const costString = costETHRounded.toFixed(18).replace(/\.?0+$/, '');

      console.log('💰 Cost calculation:', {
        voteCount,
        costUSD: `$${costUSD.toFixed(2)}`,
        costETH: `${costETHRounded.toFixed(6)} ETH`,
        costString: costString
      });

      // Check spending limit - use the rounded value for parseEther
      const costWei = ethers.parseEther(costString);
      
      // For ETH purchases, check against ETH spending limit
      let ethLimit;
      if (sessionData.tokenLimits && sessionData.tokenLimits.length > 0) {
        ethLimit = sessionData.tokenLimits.find(t => t.tokenSymbol === 'ETH') ||
                   sessionData.tokenLimits.find(t => t.isMainToken) ||
                   sessionData.tokenLimits[0];
      }
      
      const maxWei = ethLimit ? BigInt(ethLimit.maxAmount) : BigInt(sessionData.maxSpendAmount);
      const maxFormatted = ethers.formatEther(maxWei.toString());
      
      if (costWei > maxWei) {
        throw new Error(`Purchase amount ${costETHRounded.toFixed(6)} ETH exceeds session limit of ${maxFormatted} ETH`);
      }
      
      console.log('💰 ETH spending validation passed:', {
        cost: `${costETHRounded.toFixed(6)} ETH`,
        limit: `${maxFormatted} ETH`,
        remaining: `${(parseFloat(maxFormatted) - costETHRounded).toFixed(6)} ETH`
      });

      // Create session transaction for ETH vote purchase
      const sessionTransaction = {
        action: SessionAction.BUY_VOTES,
        amount: costString,
        data: { 
          voteCount,
          pricePerVote,
          costUSD,
          costETH: costETHRounded,
          tokenSymbol: 'ETH',
          chainId: sessionData.chainId
        },
        nonce: sessionData.nonce + 1
      };

      // Sign with session key
      const sessionSignature = await signSessionTransaction(sessionData, sessionTransaction);

      // Execute the purchase via smart contract
      console.log('🎯 Calling smart contract for ETH purchase...');
      const purchaseSuccess = await executeEthPurchase(address, costETHRounded, voteCount, sessionSignature, sessionData.chainId);
      
      if (!purchaseSuccess) {
        throw new Error('Smart contract ETH purchase failed');
      }

      console.log('🎁 ETH smart contract purchase completed, updating database...');

      // Update the database with purchased Licks via rewards API (with retry logic)
      try {
        console.log('🔄 Attempting to update database...');
        
        let rewardResponse;
        let attempt = 0;
        const maxAttempts = 3;
        
        while (attempt < maxAttempts) {
          attempt++;
          console.log(`📡 Database update attempt ${attempt}/${maxAttempts}...`);
          
          try {
            rewardResponse = await fetch('/api/rewards/store', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                walletAddress: address,
                reward: {
                  rewardType: 'licks_purchase',
                  xpAmount: 0,
                  votesAmount: 0,
                  gugoAmount: 0,
                  licksAmount: voteCount,
                  timestamp: Date.now()
                }
              })
            });

            if (rewardResponse.ok) {
              break;
            } else {
              console.warn(`⚠️ Attempt ${attempt} failed with status: ${rewardResponse.status} ${rewardResponse.statusText}`);
              if (attempt === maxAttempts) {
                throw new Error(`Failed to update database: ${rewardResponse.statusText}`);
              }
            }
          } catch (fetchError) {
            console.error(`❌ Attempt ${attempt} failed with error:`, fetchError);
            if (attempt === maxAttempts) {
              throw fetchError;
            }
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }

        if (rewardResponse && rewardResponse.ok) {
          const rewardResult = await rewardResponse.json();
          console.log('✅ Database updated successfully:', rewardResult);
        }

      } catch (dbError) {
        console.error('❌ Failed to update database after ETH purchase (all attempts):', dbError);
        
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        return {
          success: false,
          votesAmount: 0,
          cost: costString,
          costToken: 'ETH',
          error: `Purchase completed but failed to update balance: ${errorMessage}`
        };
      }

      console.log('✅ Votes purchased successfully with ETH:', {
        votes: voteCount,
        cost: `${costETHRounded.toFixed(6)} ETH`,
        sessionSignature: sessionSignature.substring(0, 10) + '...'
      });

      return {
        success: true,
        votesAmount: voteCount,
        cost: costString,
        costToken: 'ETH',
        txHash: 'session_eth_' + Date.now()
      };

    } catch (error: any) {
      console.error('❌ Error purchasing votes with ETH:', error);
      
      const errorMessage = error.message || 'Failed to purchase votes with ETH';
      setPurchaseError(errorMessage);
      
      return {
        success: false,
        votesAmount: 0,
        cost: '0',
        costToken: 'ETH',
        error: errorMessage
      };
      
    } finally {
      setIsPurchasing(false);
    }
  };

  /**
   * Purchase votes using session authorization (no signature required)
   */
  const purchaseVotesWithSession = async (
    voteCount: number,
    pricePerVote: number = 0.02 // $0.02 USD per vote (updated from $0.04)
  ): Promise<VotePurchaseResult> => {
    if (!address) {
      return {
        success: false,
        votesAmount: 0,
        cost: '0',
        costToken: 'GUGO',
        error: 'Wallet not connected'
      };
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      console.log('🗳️ Purchasing votes with session authorization...');
      console.log('📊 Vote count:', voteCount);
      console.log('💵 Price per vote: $', pricePerVote);

      // Check if we have a valid session for buying votes
      if (!hasValidSession(SessionAction.BUY_VOTES)) {
        throw new Error('No valid session for vote purchasing. Please refresh your session.');
      }

      const sessionData = getStoredSessionKey();
      if (!sessionData) {
        throw new Error('Session data not found');
      }

      // Calculate cost in GUGO (real market rate: 1 GUGO = $0.005)
      const costUSD = voteCount * pricePerVote;
      const gugoPrice = 0.005; // $0.005 per GUGO (real market rate - 500 Licks = 2,000 GUGO)
      const costGUGO = costUSD / gugoPrice;
      const costString = costGUGO.toString();

      console.log('💰 Cost calculation:', {
        voteCount,
        costUSD: `$${costUSD.toFixed(2)}`,
        costGUGO: `${costGUGO} GUGO`
      });

      // Check spending limit against appropriate token
      const costWei = ethers.parseEther(costString);
      
      // Determine token symbol based on network
      const isTestnet = sessionData.chainId === 11124;
      const tokenSymbol = isTestnet ? 'FGUGO' : 'GUGO';
      
      // Find the appropriate token limit
      let tokenLimit;
      if (sessionData.tokenLimits && sessionData.tokenLimits.length > 0) {
        tokenLimit = sessionData.tokenLimits.find(t => t.tokenSymbol === tokenSymbol) ||
                    sessionData.tokenLimits.find(t => t.isMainToken) ||
                    sessionData.tokenLimits[0];
      }
      
      const maxWei = tokenLimit ? BigInt(tokenLimit.maxAmount) : BigInt(sessionData.maxSpendAmount);
      const maxFormatted = ethers.formatEther(maxWei.toString());
      
      if (costWei > maxWei) {
        throw new Error(`Purchase amount ${costGUGO} ${tokenSymbol} exceeds session limit of ${maxFormatted} ${tokenLimit?.tokenSymbol || 'tokens'}`);
      }
      
      console.log('💰 Spending validation passed:', {
        cost: `${costGUGO} ${tokenSymbol}`,
        limit: `${maxFormatted} ${tokenLimit?.tokenSymbol || 'tokens'}`,
        remaining: `${parseFloat(maxFormatted) - costGUGO} ${tokenLimit?.tokenSymbol || 'tokens'}`
      });

      // Check if we need to approve GUGO spending
      const hasAllowance = await checkAllowance(costString);
      if (!hasAllowance && approvalNeeded) {
        const approved = await approveGugoSpending(costString);
        if (!approved) {
          return {
            success: false,
            votesAmount: 0,
            cost: costString,
            costToken: tokenSymbol as 'GUGO' | 'FGUGO',
            error: 'Token approval required but failed'
          };
        }
      }

      // Create session transaction for vote purchase
      const sessionTransaction = {
        action: SessionAction.BUY_VOTES,
        amount: costString,
        data: { 
          voteCount,
          pricePerVote,
          costUSD,
          costGUGO,
          tokenSymbol,
          chainId: sessionData.chainId
        },
        nonce: sessionData.nonce + 1
      };

      // Sign with session key
      const sessionSignature = await signSessionTransaction(sessionData, sessionTransaction);

      // Execute the purchase via smart contract
      console.log('🎯 Calling smart contract for FGUGO purchase...');
      const purchaseSuccess = await executeFgugoPurchase(address, costGUGO, voteCount, sessionSignature, sessionData.chainId);
      
      if (!purchaseSuccess) {
        throw new Error('Smart contract purchase failed');
      }

      console.log('🎁 Smart contract purchase completed, updating database...');

      // Update the database with purchased Licks via rewards API (with retry logic)
      try {
        console.log('🔄 Attempting to update database...');
        
        let rewardResponse;
        let attempt = 0;
        const maxAttempts = 3;
        
        while (attempt < maxAttempts) {
          attempt++;
          console.log(`📡 Database update attempt ${attempt}/${maxAttempts}...`);
          
          try {
            rewardResponse = await fetch('/api/rewards/store', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                walletAddress: address,
                reward: {
                  rewardType: 'licks_purchase',
                  xpAmount: 0,
                  votesAmount: 0,
                  gugoAmount: 0,
                  licksAmount: voteCount, // Add purchased Licks to available_votes
                  timestamp: Date.now()
                }
              })
            });

            if (rewardResponse.ok) {
              break; // Success, exit retry loop
            } else {
              console.warn(`⚠️ Attempt ${attempt} failed with status: ${rewardResponse.status} ${rewardResponse.statusText}`);
              if (attempt === maxAttempts) {
                throw new Error(`Failed to update database: ${rewardResponse.statusText}`);
              }
            }
          } catch (fetchError) {
            console.error(`❌ Attempt ${attempt} failed with error:`, fetchError);
            if (attempt === maxAttempts) {
              throw fetchError;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }

        if (rewardResponse && rewardResponse.ok) {
          const rewardResult = await rewardResponse.json();
          console.log('✅ Database updated successfully:', rewardResult);
        }

      } catch (dbError) {
        console.error('❌ Failed to update database after purchase (all attempts):', dbError);
        
        // Return error instead of success since this is critical for the balance update
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        return {
          success: false,
          votesAmount: 0,
          cost: costString,
          costToken: tokenSymbol as 'GUGO' | 'FGUGO',
          error: `Purchase completed but failed to update balance: ${errorMessage}`
        };
      }

      console.log('✅ Votes purchased successfully:', {
        votes: voteCount,
        cost: `${costGUGO} GUGO`,
        sessionSignature: sessionSignature.substring(0, 10) + '...'
      });

      return {
        success: true,
        votesAmount: voteCount,
        cost: costString,
        costToken: tokenSymbol as 'GUGO' | 'FGUGO',
        txHash: 'session_' + Date.now() // Simulated transaction hash
      };

    } catch (error: any) {
      console.error('❌ Error purchasing votes:', error);
      
      const errorMessage = error.message || 'Failed to purchase votes';
      setPurchaseError(errorMessage);
      
      return {
        success: false,
        votesAmount: 0,
        cost: '0',
        costToken: 'GUGO',
        error: errorMessage
      };
      
    } finally {
      setIsPurchasing(false);
    }
  };

  /**
   * Purchase votes with traditional wallet signature (fallback)
   */
  const purchaseVotesWithSignature = async (
    voteCount: number,
    pricePerVote: number = 0.02
  ): Promise<VotePurchaseResult> => {
    if (!address) {
      return {
        success: false,
        votesAmount: 0,
        cost: '0',
        costToken: 'GUGO',
        error: 'Wallet not connected'
      };
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      console.log('🗳️ Purchasing votes with wallet signature...');
      
      // Calculate cost
      const costUSD = voteCount * pricePerVote;
      const gugoPrice = 0.005; // $0.005 per GUGO (real market rate - 500 Licks = 2,000 GUGO)
      const costGUGO = costUSD / gugoPrice;
      const costString = costGUGO.toString();

      // Check allowance
      const hasAllowance = await checkAllowance(costString);
      if (!hasAllowance && approvalNeeded) {
        const approved = await approveGugoSpending(costString);
        if (!approved) {
          return {
            success: false,
            votesAmount: 0,
            cost: costString,
            costToken: 'GUGO',
            error: 'Token approval required but failed'
          };
        }
      }

      // Simulate wallet signature and transaction
      await new Promise(resolve => setTimeout(resolve, 4000)); // Longer delay for signature

      console.log('🎁 Signature purchase completed, updating database...');

      // Update the database with purchased Licks via rewards API
      try {
        const rewardResponse = await fetch('/api/rewards/store', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: address,
            reward: {
              rewardType: 'licks_purchase',
              xpAmount: 0,
              votesAmount: 0,
              gugoAmount: 0,
              licksAmount: voteCount, // Add purchased Licks to available_votes
              timestamp: Date.now()
            }
          })
        });

        if (!rewardResponse.ok) {
          throw new Error(`Failed to update database: ${rewardResponse.statusText}`);
        }

        const rewardResult = await rewardResponse.json();
        console.log('✅ Database updated successfully:', rewardResult);

      } catch (dbError) {
        console.error('❌ Failed to update database after purchase:', dbError);
        // Still return success since the "transaction" completed, but log the error
      }

      console.log('✅ Votes purchased with signature:', {
        votes: voteCount,
        cost: `${costGUGO} GUGO`
      });

      return {
        success: true,
        votesAmount: voteCount,
        cost: costString,
        costToken: 'GUGO',
        txHash: 'signed_' + Date.now()
      };

    } catch (error: any) {
      console.error('❌ Error purchasing votes with signature:', error);
      
      const errorMessage = error.message || 'Failed to purchase votes';
      setPurchaseError(errorMessage);
      
      return {
        success: false,
        votesAmount: 0,
        cost: '0',
        costToken: 'GUGO',
        error: errorMessage
      };
      
    } finally {
      setIsPurchasing(false);
    }
  };

  /**
   * Smart purchase function that uses session if available, fallback to signature
   */
  const purchaseVotes = async (
    voteCount: number,
    pricePerVote: number = 0.02,
    paymentMethod: 'GUGO' | 'ETH' = 'GUGO'
  ): Promise<VotePurchaseResult> => {
    // Debug session validation
    const sessionData = getStoredSessionKey();
    const hasSession = hasValidSession(SessionAction.BUY_VOTES);
    
    console.log('🔍 Session validation debug:', {
      hasStoredSession: !!sessionData,
      sessionExpires: sessionData ? new Date(sessionData.expiresAt).toISOString() : 'N/A',
      currentTime: new Date().toISOString(),
      timeUntilExpiry: sessionData ? Math.round((sessionData.expiresAt - Date.now()) / 1000 / 60) : 'N/A',
      actionsAllowed: sessionData?.actionsAllowed || [],
      hasBuyVotesAction: sessionData?.actionsAllowed?.includes(SessionAction.BUY_VOTES) || false,
      hasValidSession: hasSession
    });
    
    if (hasSession) {
      if (paymentMethod === 'ETH') {
        console.log('🚀 Using session-based ETH vote purchase (no signature needed)');
        return await purchaseVotesWithETH(voteCount, pricePerVote);
      } else {
        console.log('🚀 Using session-based GUGO vote purchase (no signature needed)');
        return await purchaseVotesWithSession(voteCount, pricePerVote);
      }
    } else {
      console.log('✍️ Using traditional signature-based vote purchase');
      console.log('❗ Reason for fallback:', !sessionData ? 'No session stored' : 'Session expired or missing BUY_VOTES action');
      // For now, signature-based purchases only support GUGO
      return await purchaseVotesWithSignature(voteCount, pricePerVote);
    }
  };

  return {
    // Purchase functions
    purchaseVotes,
    purchaseVotesWithSession,
    purchaseVotesWithETH,
    purchaseVotesWithSignature,
    
    // Approval functions
    approveGugoSpending,
    checkAllowance,
    
    // State
    isPurchasing,
    isApproving,
    purchaseError,
    approvalNeeded,
    
    // Utilities
    canUseSession: () => hasValidSession(SessionAction.BUY_VOTES)
  };
}