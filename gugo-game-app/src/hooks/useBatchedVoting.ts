import { useState, useRef } from 'react';
import { supabase } from '@lib/supabase';
import type { VoteSubmission, VoteResult } from '@/types/voting';

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
    totalVoteCount: 0
  });
  
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const processingRef = useRef(false);

  // 🚀 Add vote to local batch (instant UI feedback)
  const addVoteToBatch = async (voteData: VoteSubmission, userWallet: string): Promise<VoteResult> => {
    const newVote: BatchedVote = {
      voteData,
      userWallet,
      timestamp: Date.now(),
      processed: false
    };

    // Update local state immediately for instant UI feedback
    setBatchState(prev => ({
      ...prev,
      pendingVotes: [...prev.pendingVotes, newVote],
      totalVoteCount: prev.totalVoteCount + 1
    }));

    const newVoteCount = batchState.totalVoteCount + 1;
    const isPrizeBreak = newVoteCount % 10 === 0;

    console.log(`⚡ Vote ${newVoteCount} added to batch - ${isPrizeBreak ? 'PRIZE BREAK!' : 'batched for processing'}`);

    // Check if this triggers a prize break (every 10 votes)
    if (isPrizeBreak) {
      console.log('🎁 Prize break triggered - processing batch now!');
      // Don't await this - let it process in background during prize break
      processPendingVotes();
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

    try {
      const unprocessedVotes = batchState.pendingVotes.filter(vote => !vote.processed);
      
      if (unprocessedVotes.length === 0) {
        console.log('✅ No unprocessed votes in batch');
        return;
      }

      console.log(`📦 Processing batch of ${unprocessedVotes.length} votes...`);
      const startTime = performance.now();

      // Group votes by user for efficient processing
      const votesByUser = unprocessedVotes.reduce((groups, vote) => {
        if (!groups[vote.userWallet]) {
          groups[vote.userWallet] = [];
        }
        groups[vote.userWallet].push(vote);
        return groups;
      }, {} as Record<string, BatchedVote[]>);

      // Process each user's votes
      for (const [userWallet, userVotes] of Object.entries(votesByUser)) {
        await processUserVoteBatch(userWallet, userVotes);
      }

      // Mark all votes as processed
      setBatchState(prev => ({
        ...prev,
        pendingVotes: prev.pendingVotes.map(vote => ({ ...vote, processed: true })),
        lastProcessedBatch: Date.now()
      }));

      const processingTime = performance.now() - startTime;
      console.log(`✅ Batch processed ${unprocessedVotes.length} votes in ${Math.round(processingTime)}ms`);

      // Clean up old processed votes (keep last 50 for debugging)
      setBatchState(prev => ({
        ...prev,
        pendingVotes: prev.pendingVotes.slice(-50)
      }));

    } catch (error) {
      console.error('❌ Error processing vote batch:', error);
      // Don't throw - let individual votes be retried later
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
      const { error: voteError } = await supabase
        .from('votes')
        .insert(voteRecords);

      if (voteError) {
        console.error(`❌ Error batch inserting votes for ${userWallet}:`, voteError);
        return;
      }

      console.log(`📊 Batch inserted ${voteRecords.length} votes for ${userWallet}`);

      // Process Elo updates in batch
      await processBatchEloUpdates(userVotes);

      // Update user stats (total vote count, etc.)
      await updateUserStatsBatch(userWallet, userVotes.length);

      // Deduct vote costs in batch
      await deductVoteCostsBatch(userWallet, userVotes);

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
    const { data: nfts, error: nftError } = await supabase
      .from('nfts')
      .select('id, current_elo, wins, losses, total_votes')
      .in('id', Array.from(nftIds));

    if (nftError || !nfts) {
      console.error('❌ Error fetching NFTs for batch Elo update:', nftError);
      return;
    }

    // Create lookup map for NFT data
    const nftMap = new Map(nfts.map(nft => [nft.id, nft]));

    // Process each vote and accumulate changes
    const nftUpdates = new Map<string, {
      current_elo: number;
      wins: number;
      losses: number;
      total_votes: number;
    }>();

    for (const vote of matchupVotes) {
      if (!vote.voteData.nft_a_id || !vote.voteData.nft_b_id || !vote.voteData.winner_id) continue;

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

      // Accumulate changes for NFT A
      const updateA = nftUpdates.get(vote.voteData.nft_a_id) || {
        current_elo: nftA.current_elo,
        wins: nftA.wins,
        losses: nftA.losses,
        total_votes: nftA.total_votes
      };

      if (winner === 'a') {
        updateA.current_elo += winnerChange;
        updateA.wins += voteWeight;
      } else {
        updateA.current_elo += loserChange;
        updateA.losses += voteWeight;
      }
      updateA.total_votes += voteWeight;
      nftUpdates.set(vote.voteData.nft_a_id, updateA);

      // Accumulate changes for NFT B
      const updateB = nftUpdates.get(vote.voteData.nft_b_id) || {
        current_elo: nftB.current_elo,
        wins: nftB.wins,
        losses: nftB.losses,
        total_votes: nftB.total_votes
      };

      if (winner === 'b') {
        updateB.current_elo += winnerChange;
        updateB.wins += voteWeight;
      } else {
        updateB.current_elo += loserChange;
        updateB.losses += voteWeight;
      }
      updateB.total_votes += voteWeight;
      nftUpdates.set(vote.voteData.nft_b_id, updateB);
    }

    // Apply all updates in batch
    const updatePromises = Array.from(nftUpdates.entries()).map(([nftId, updates]) =>
      supabase
        .from('nfts')
        .update({
          ...updates,
          elo_last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', nftId)
    );

    const results = await Promise.all(updatePromises);
    const failedUpdates = results.filter(result => result.error);

    if (failedUpdates.length > 0) {
      console.error(`❌ ${failedUpdates.length} Elo updates failed`);
    } else {
      console.log(`✅ Batch updated Elo for ${nftUpdates.size} NFTs`);
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

  // 💳 Deduct vote costs in batch
  const deductVoteCostsBatch = async (userWallet: string, votes: BatchedVote[]): Promise<void> => {
    try {
      const totalCost = votes.reduce((cost, vote) => {
        return cost + (vote.voteData.super_vote ? 5 : 1);
      }, 0);

      const userId = await getOrCreateUser(userWallet);

      // Get current available votes
      const { data: userData } = await supabase
        .from('users')
        .select('available_votes')
        .eq('id', userId)
        .single();

      // Calculate new vote count (ensure it doesn't go below 0)
      const currentVotes = userData?.available_votes || 0;
      const newVoteCount = Math.max(0, currentVotes - totalCost);

      const { error } = await supabase
        .from('users')
        .update({
          available_votes: newVoteCount
        })
        .eq('id', userId);

      if (error) {
        console.warn('⚠️ Failed to deduct vote costs in batch:', error);
      } else {
        console.log(`💳 Deducted ${totalCost} votes in batch`);
      }
    } catch (error) {
      console.warn('⚠️ Error deducting vote costs in batch:', error);
    }
  };

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