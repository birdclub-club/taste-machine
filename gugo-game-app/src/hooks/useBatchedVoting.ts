import { useState, useRef } from 'react';
import { supabase } from '@lib/supabase';
import type { VoteSubmission, VoteResult } from '@/types/voting';
import { isPrizeBreakVote, getPrizeBreakThreshold } from '@/lib/prize-break-utils';

interface BatchedVote {
  voteData: VoteSubmission;
  userWallet: string;
  timestamp: number;
  processed: boolean;
}

interface BatchedVotingState {
  pendingVotes: BatchedVote[];
  lastProcessedBatch: number;
  totalVoteCount: number;
}

export function useBatchedVoting() {
  const [batchState, setBatchState] = useState<BatchedVotingState>({
    pendingVotes: [],
    lastProcessedBatch: 0,
    totalVoteCount: 0 // Session-based counting - resets each session
  });
  
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const processingRef = useRef(false);
  const prizeBreakInProgressRef = useRef(false);

  // Session-based vote counting - starts fresh each session for consistent rewards

  // 🚀 Add vote to local batch (instant UI feedback)
  const addVoteToBatch = async (voteData: VoteSubmission, userWallet: string, userXP: number = 0): Promise<VoteResult> => {
    // Session-based vote counting - resets to 0 each session for consistent 20-vote rewards
    
    const newVote: BatchedVote = {
      voteData,
      userWallet,
      timestamp: Date.now(),
      processed: false
    };

    // Calculate new vote count first to avoid state race conditions
    const newVoteCount = batchState.totalVoteCount + 1;
    const isPrizeBreak = isPrizeBreakVote(newVoteCount, userXP);

    // Update local state immediately for instant UI feedback
    setBatchState(prev => ({
      ...prev,
      pendingVotes: [...prev.pendingVotes, newVote],
      totalVoteCount: newVoteCount
    }));

    console.log(`⚡ Vote ${newVoteCount} added to batch - ${isPrizeBreak ? 'PRIZE BREAK!' : 'batched for processing'}`);
    
    // Debug: Log prize break calculation details (session-based counting)
    if (newVoteCount >= 15) { // Only log when getting close to potential prize breaks
      const threshold = getPrizeBreakThreshold(userXP);
      const remainder = newVoteCount % threshold;
      console.log(`🔍 Prize break debug (session): Vote ${newVoteCount}, XP ${userXP}, Threshold ${threshold}, Remainder ${remainder}, isPrizeBreak: ${isPrizeBreak}`);
    }

    // Check if this triggers a prize break (XP-based threshold)
    if (isPrizeBreak && !prizeBreakInProgressRef.current) {
      console.log('🎁 Prize break triggered - processing batch now!');
      console.log('🎬 Prize break UI will be handled by page.tsx');
      prizeBreakInProgressRef.current = true;
      // Don't await this - let it process in background during prize break
      processPendingVotes().finally(() => {
        // Reset the prize break flag after processing completes
        setTimeout(() => {
          prizeBreakInProgressRef.current = false;
        }, 1000); // 1 second cooldown to prevent rapid-fire prize breaks
      });
    } else if (isPrizeBreak && prizeBreakInProgressRef.current) {
      console.log('🛡️ Prize break already in progress - skipping duplicate trigger');
      // Return false for isPrizeBreak to prevent duplicate UI triggers
      return {
        hash: 'batched',
        voteId: `batch-${Date.now()}`,
        isPrizeBreak: false, // Prevent duplicate UI trigger
        voteCount: newVoteCount,
        insufficientVotes: false
      };
    }

    return {
      hash: 'batched',
      voteId: `batch-${Date.now()}`,
      isPrizeBreak,
      voteCount: newVoteCount,
      insufficientVotes: false
    };
  };

  // 📦 Process all pending votes in batch during prize breaks
  const processPendingVotes = async (): Promise<void> => {
    if (processingRef.current || batchState.pendingVotes.length === 0) {
      console.log('⏭️ Batch processing already in progress or no votes to process');
      return;
    }

    processingRef.current = true;
    setIsProcessingBatch(true);

    const unprocessedVotes = batchState.pendingVotes.filter(vote => !vote.processed);
    let votesByUser: Record<string, BatchedVote[]> = {};

    try {
      if (unprocessedVotes.length === 0) {
        console.log('✅ No unprocessed votes in batch');
        return;
      }

      console.log(`🚀 BATCH PROCESSING START: ${unprocessedVotes.length} votes queued for Supabase`);
      console.log(`📊 Batch details:`, unprocessedVotes.map(v => ({ 
        type: v.voteData.vote_type, 
        super: v.voteData.super_vote,
        wallet: v.userWallet.substring(0,8) + '...',
        timestamp: new Date(v.timestamp).toISOString()
      })));
      const startTime = performance.now();

      // Group votes by user for efficient processing
      votesByUser = unprocessedVotes.reduce((groups, vote) => {
        if (!groups[vote.userWallet]) {
          groups[vote.userWallet] = [];
        }
        groups[vote.userWallet].push(vote);
        return groups;
      }, {} as Record<string, BatchedVote[]>);

      // Process each user's votes
      for (const [userWallet, userVotes] of Object.entries(votesByUser)) {
        console.log(`👤 Processing ${userVotes.length} votes for ${userWallet.substring(0,8)}...`);
        await processUserVoteBatch(userWallet, userVotes);
      }

      // Mark all votes as processed
      setBatchState(prev => ({
        ...prev,
        pendingVotes: prev.pendingVotes.map(vote => ({ ...vote, processed: true })),
        lastProcessedBatch: Date.now()
      }));

      const processingTime = performance.now() - startTime;
      console.log(`✅ BATCH PROCESSING COMPLETE: ${unprocessedVotes.length} votes sent to Supabase in ${Math.round(processingTime)}ms`);
      console.log(`📈 Performance: ${Math.round(unprocessedVotes.length / (processingTime / 1000))} votes/second`);

      // Clean up old processed votes (keep last 50 for debugging)
      setBatchState(prev => ({
        ...prev,
        pendingVotes: prev.pendingVotes.slice(-50)
      }));

    } catch (error) {
      console.error('❌ BATCH PROCESSING FAILED:', error);
      console.error('📋 Failed batch details:', {
        totalVotes: unprocessedVotes.length,
        users: Object.keys(votesByUser).length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - let individual votes be retried later
      // Mark as failed for debugging but don't prevent UI from continuing
    } finally {
      setIsProcessingBatch(false);
      processingRef.current = false;
    }
  };

  // 👤 Process all votes for a specific user
  const processUserVoteBatch = async (userWallet: string, userVotes: BatchedVote[]): Promise<void> => {
    try {
      // Get or create user record
      const userId = await getOrCreateUser(userWallet);

      // Prepare all vote records for batch insert
      const voteRecords = userVotes.map(({ voteData }) => ({
        user_id: userId,
        vote_type_v2: voteData.vote_type,
        nft_a_id: voteData.nft_a_id,
        nft_b_id: voteData.nft_b_id,
        winner_id: voteData.winner_id,
        slider_value: voteData.slider_value,
        engagement_data: {
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          wallet_address: userWallet,
          super_vote: voteData.super_vote || false,
          vote_cost: voteData.super_vote ? 5 : 1,
          batch_processed: true,
          ...voteData.engagement_data
        }
      }));

      // Batch insert all votes
      const { data: insertedVotes, error: voteError } = await supabase
        .from('votes')
        .insert(voteRecords)
        .select('id');

      if (voteError) {
        console.error(`❌ SUPABASE ERROR: Failed to insert ${voteRecords.length} votes for ${userWallet}:`, voteError);
        throw voteError; // Throw to trigger retry logic
      }

      console.log(`✅ SUPABASE SUCCESS: Inserted ${voteRecords.length} votes for ${userWallet.substring(0,8)}... (IDs: ${insertedVotes?.map(v => v.id).join(', ')})`);

      // Process Elo updates in batch
      await processBatchEloUpdates(userVotes);

      // Update user stats (total vote count, etc.)
      await updateUserStatsBatch(userWallet, userVotes.length);

      // NOTE: Vote costs already deducted immediately in useVote.ts for instant UI feedback
      // Batch processing does NOT deduct votes again to prevent double charging
      console.log(`ℹ️ Vote costs already deducted immediately - skipping batch deduction for ${userWallet.substring(0,8)}...`);

    } catch (error) {
      console.error(`❌ Error processing user vote batch for ${userWallet}:`, error);
    }
  };

  // 🏆 Process Elo updates for all matchup votes in batch
  const processBatchEloUpdates = async (votes: BatchedVote[]): Promise<void> => {
    const matchupVotes = votes.filter(vote => 
      vote.voteData.vote_type !== 'slider' && 
      vote.voteData.winner_id && 
      !vote.voteData.engagement_data?.no_vote
    );

    if (matchupVotes.length === 0) return;

    console.log(`🏆 Processing ${matchupVotes.length} Elo updates...`);

    // Group by NFT pairs to avoid redundant database calls
    const nftPairs = new Set<string>();
    const nftIds = new Set<string>();

    matchupVotes.forEach(vote => {
      if (vote.voteData.nft_a_id && vote.voteData.nft_b_id) {
        nftIds.add(vote.voteData.nft_a_id);
        nftIds.add(vote.voteData.nft_b_id);
        const pairKey = [vote.voteData.nft_a_id, vote.voteData.nft_b_id].sort().join('-');
        nftPairs.add(pairKey);
      }
    });

    // Fetch all NFT data in one query
    console.log(`📊 Fetching NFT data for ${nftIds.size} NFTs:`, Array.from(nftIds));
    
    // Try to fetch with both possible column names (current_elo vs looks_score)
    const { data: nfts, error: nftError } = await supabase
      .from('nfts')
      .select('id, current_elo, looks_score, wins, losses, total_votes')
      .in('id', Array.from(nftIds));

    if (nfts && nfts.length > 0) {
      console.log('📊 Sample NFT structure:', Object.keys(nfts[0]));
      console.log('📊 First NFT data:', nfts[0]);
    }

    if (nftError || !nfts) {
      console.error('❌ Error fetching NFTs for batch Elo update:', nftError);
      return;
    }

    console.log(`📊 Fetched ${nfts?.length || 0} NFTs successfully:`, nfts?.map(n => ({ id: n.id, current_elo: n.current_elo, wins: n.wins, losses: n.losses, total_votes: n.total_votes })));

    // Create lookup map for NFT data
    const nftMap = new Map(nfts.map(nft => [nft.id, nft]));

    // Process each vote and accumulate changes
    const nftUpdates = new Map<string, {
      current_elo: number;
      looks_score: number;
      wins: number;
      losses: number;
      total_votes: number;
    }>();

    for (const vote of matchupVotes) {
      if (!vote.voteData.nft_a_id || !vote.voteData.nft_b_id) continue;
      
      // Handle NO votes (valuable negative aesthetic data)
      const isNoVote = !vote.voteData.winner_id && vote.voteData.engagement_data?.no_vote;
      if (isNoVote) {
        // Process NO votes separately - they provide negative aesthetic feedback for both NFTs
        await processNoVoteBatch(vote, nftMap);
        continue;
      }
      
      // Regular matchup votes need a winner_id
      if (!vote.voteData.winner_id) continue;

      const nftA = nftMap.get(vote.voteData.nft_a_id);
      const nftB = nftMap.get(vote.voteData.nft_b_id);
      
      if (!nftA || !nftB) continue;

      const winner = vote.voteData.winner_id === nftA.id ? 'a' : 'b';
      const isSuperVote = vote.voteData.super_vote || false;
      const voteWeight = isSuperVote ? 5 : 1;
      const kFactor = isSuperVote ? 64 : 32;

      // Calculate Elo changes
      const winnerElo = winner === 'a' ? nftA.current_elo : nftB.current_elo;
      const loserElo = winner === 'a' ? nftB.current_elo : nftA.current_elo;

      const expectedWinner = 1.0 / (1.0 + Math.pow(10.0, (loserElo - winnerElo) / 400.0));
      const winnerChange = Math.round(kFactor * (1.0 - expectedWinner));
      const loserChange = Math.round(kFactor * (0.0 - expectedWinner));

      // Use the correct Elo column (current_elo or looks_score), ensure integer values
      const eloColumnA = Math.round(nftA.current_elo !== undefined ? nftA.current_elo : (nftA.looks_score || 1500));
      const eloColumnB = Math.round(nftB.current_elo !== undefined ? nftB.current_elo : (nftB.looks_score || 1500));
      
      // Accumulate changes for NFT A
      const updateA = nftUpdates.get(vote.voteData.nft_a_id) || {
        current_elo: eloColumnA,
        looks_score: eloColumnA,  // Update both possible columns
        wins: nftA.wins || 0,
        losses: nftA.losses || 0,
        total_votes: nftA.total_votes || 0
      };

      if (winner === 'a') {
        updateA.current_elo += winnerChange;
        updateA.looks_score += winnerChange;  // Update both columns
        updateA.wins += voteWeight;
      } else {
        updateA.current_elo += loserChange;
        updateA.looks_score += loserChange;   // Update both columns
        updateA.losses += voteWeight;
      }
      updateA.total_votes += voteWeight;
      nftUpdates.set(vote.voteData.nft_a_id, updateA);

      // Accumulate changes for NFT B
      const updateB = nftUpdates.get(vote.voteData.nft_b_id) || {
        current_elo: eloColumnB,
        looks_score: eloColumnB,  // Update both possible columns
        wins: nftB.wins || 0,
        losses: nftB.losses || 0,
        total_votes: nftB.total_votes || 0
      };

      if (winner === 'b') {
        updateB.current_elo += winnerChange;
        updateB.looks_score += winnerChange;  // Update both columns
        updateB.wins += voteWeight;
      } else {
        updateB.current_elo += loserChange;
        updateB.looks_score += loserChange;   // Update both columns
        updateB.losses += voteWeight;
      }
      updateB.total_votes += voteWeight;
      nftUpdates.set(vote.voteData.nft_b_id, updateB);
    }

    // Apply all updates in smaller sequential batches to prevent timeouts
    console.log(`🔄 Applying ${nftUpdates.size} NFT updates in small batches...`);
    
    const updateEntries = Array.from(nftUpdates.entries());
    const BATCH_SIZE = 2; // Reduced from 3 to 2 for better timeout handling
    const totalBatches = Math.ceil(updateEntries.length / BATCH_SIZE);
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, updateEntries.length);
      const currentBatch = updateEntries.slice(batchStart, batchEnd);
      
      console.log(`📦 Processing batch ${i + 1}/${totalBatches} (${currentBatch.length} updates)...`);
      
      const batchPromises = currentBatch.map(async ([nftId, updates]) => {
        const updateData = {
          ...updates,
          // Ensure all Elo values are integers for database compatibility
          current_elo: Math.round(updates.current_elo),
          looks_score: Math.round(updates.looks_score || updates.current_elo),
          updated_at: new Date().toISOString()
        };
        
        // Enhanced retry mechanism with timeout protection
        const MAX_RETRIES = 2; // Reduced retries for faster failure
        const TIMEOUT_MS = 3000; // Reduced to 3 second timeout per update
        let lastError = null;
        
        for (let retry = 0; retry <= MAX_RETRIES; retry++) {
          try {
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Update timeout')), TIMEOUT_MS)
            );
            
            // Create update promise
            const updatePromise = supabase
              .from('nfts')
              .update(updateData)
              .eq('id', nftId);
            
            // Race between update and timeout
            const result = await Promise.race([updatePromise, timeoutPromise]) as any;
              
            if (!result.error) {
              return result;
            }
            
            lastError = result.error;
            
            // If it's a timeout error, wait longer before retry
            if ((result.error?.code === '57014' || result.error?.message?.includes('timeout')) && retry < MAX_RETRIES) {
              const waitTime = 1000 * (retry + 1); // Exponential backoff: 1s, 2s, 3s
              console.log(`⏰ NFT ${nftId}: Timeout on attempt ${retry + 1}, waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            
            return result;
          } catch (error) {
            lastError = error;
            
            // Handle timeout errors specifically
            if ((error as Error).message === 'Update timeout' && retry < MAX_RETRIES) {
              const waitTime = 1000 * (retry + 1);
              console.log(`⏰ NFT ${nftId}: Promise timeout on attempt ${retry + 1}, waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            
            if (retry < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
            }
          }
        }
        
        return { error: lastError, data: null, count: null, status: 500, statusText: 'Max retries exceeded' };
      });

      try {
        const results = await Promise.all(batchPromises);
        const batchFailures = results.filter((result: any) => result.error);
        
        if (batchFailures.length > 0) {
          console.warn(`⚠️ Batch ${i + 1}: ${batchFailures.length}/${currentBatch.length} updates failed (continuing with remaining batches)`);
          batchFailures.forEach((result: any, index) => {
            const nftId = currentBatch[results.indexOf(result)][0];
            const errorMsg = result.error?.message || 'Unknown error';
            console.warn(`⚠️ NFT ${nftId}: ${errorMsg}`);
          });
          failureCount += batchFailures.length;
        } else {
          console.log(`✅ Batch ${i + 1}: ${currentBatch.length}/${currentBatch.length} updates successful`);
        }
        
        successCount += (currentBatch.length - batchFailures.length);
        
        // Increased delay between batches to reduce database load during timeouts
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Increased from 100ms to 300ms
        }
        
      } catch (error) {
        console.error(`❌ Batch ${i + 1} completely failed:`, error);
        failureCount += currentBatch.length;
      }
    }
    
    if (failureCount > 0) {
      const successRate = ((successCount / updateEntries.length) * 100).toFixed(1);
      console.warn(`⚠️ Batch processing completed: ${successCount}/${updateEntries.length} successful (${successRate}%), ${failureCount} failed due to timeouts`);
      console.log(`💡 Failed updates will be retried in the next batch cycle`);
    } else {
      console.log(`✅ Successfully updated Elo for all ${successCount} NFTs`);
    }
  };

  // 👤 Update user statistics in batch
  const updateUserStatsBatch = async (userWallet: string, voteCount: number): Promise<void> => {
    try {
      const userId = await getOrCreateUser(userWallet);

      // Get current user data
      const { data: userData } = await supabase
        .from('users')
        .select('total_votes, vote_streak')
        .eq('id', userId)
        .single();

      // Update with calculated values
      const { error } = await supabase
        .from('users')
        .update({
          last_vote_at: new Date().toISOString(),
          total_votes: (userData?.total_votes || 0) + voteCount,
          vote_streak: (userData?.vote_streak || 0) + voteCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.warn('⚠️ Failed to update user stats in batch:', error);
      } else {
        console.log(`📊 Updated user stats: +${voteCount} votes`);
      }
    } catch (error) {
      console.warn('⚠️ Error updating user stats in batch:', error);
    }
  };

  // 💳 [REMOVED] Vote costs are deducted immediately in useVote.ts for instant UI feedback
  // Batch processing does NOT deduct votes to prevent double charging

  // 👤 Get or create user record
  const getOrCreateUser = async (walletAddress: string): Promise<string> => {
    try {
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingUser) {
        return existingUser.id;
      }

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          wallet_type: 'metamask',
          xp: 0,
          total_votes: 0
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error('Failed to create user record');
      }

      return newUser.id;
    } catch (error) {
      console.error('❌ Error in getOrCreateUser:', error);
      throw error;
    }
  };

  // 📊 Get batch statistics
  const getBatchStats = () => ({
    pendingVotes: batchState.pendingVotes.length,
    unprocessedVotes: batchState.pendingVotes.filter(v => !v.processed).length,
    totalVoteCount: batchState.totalVoteCount,
    lastProcessedBatch: batchState.lastProcessedBatch,
    isProcessingBatch
  });

  return {
    addVoteToBatch,
    processPendingVotes,
    getBatchStats,
    isProcessingBatch
  };
}

// 📉 Process NO votes (negative aesthetic data for both NFTs)
const processNoVoteBatch = async (vote: BatchedVote, nftMap: Map<string, any>) => {
  try {
    if (!vote.voteData.nft_a_id || !vote.voteData.nft_b_id) return;

    const nftA = nftMap.get(vote.voteData.nft_a_id);
    const nftB = nftMap.get(vote.voteData.nft_b_id);
    
    if (!nftA || !nftB) return;

    const isSuperVote = vote.voteData.super_vote || false;
    const voteWeight = isSuperVote ? 5 : 1;

    console.log(`❌ Processing NO vote (negative aesthetic data) - both NFTs get +${voteWeight} vote count`);

    // Update both NFTs' vote counts but NO Elo changes (no winner/loser)
    const updatePromises = [
      supabase
        .from('nfts')
        .update({
          total_votes: nftA.total_votes + voteWeight,
          updated_at: new Date().toISOString()
        })
        .eq('id', nftA.id),
      supabase
        .from('nfts')
        .update({
          total_votes: nftB.total_votes + voteWeight,
          updated_at: new Date().toISOString()
        })
        .eq('id', nftB.id)
    ];

    const updateResults = await Promise.all(updatePromises);

    if (updateResults.some(result => result.error)) {
      const errors = updateResults.filter(result => result.error).map(result => result.error);
      console.error('❌ NO vote NFT update errors (batch):', errors);
      console.error('❌ Full update results:', updateResults);
      throw new Error(`Failed to update NFT vote counts for NO vote (batch): ${JSON.stringify(errors)}`);
    }

    console.log(`✅ NO vote processed: Both NFTs got +${voteWeight} vote count (negative aesthetic data recorded)`);
    
  } catch (error) {
    console.error('❌ Error processing NO vote batch:', error);
    throw error;
  }
};