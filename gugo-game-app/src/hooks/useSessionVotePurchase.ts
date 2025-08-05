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

export interface VotePurchaseResult {
  success: boolean;
  votesAmount: number;
  cost: string; // In GUGO
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

      // Simulate the purchase process (replace with real blockchain transaction later)
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('🎁 Purchase transaction completed, updating database...');

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

      console.log('✅ Votes purchased successfully:', {
        votes: voteCount,
        cost: `${costGUGO} GUGO`,
        sessionSignature: sessionSignature.substring(0, 10) + '...'
      });

      return {
        success: true,
        votesAmount: voteCount,
        cost: costString,
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
    pricePerVote: number = 0.02
  ): Promise<VotePurchaseResult> => {
    if (hasValidSession(SessionAction.BUY_VOTES)) {
      console.log('🚀 Using session-based vote purchase (no signature needed)');
      return await purchaseVotesWithSession(voteCount, pricePerVote);
    } else {
      console.log('✍️ Using traditional signature-based vote purchase');
      return await purchaseVotesWithSignature(voteCount, pricePerVote);
    }
  };

  return {
    // Purchase functions
    purchaseVotes,
    purchaseVotesWithSession,
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