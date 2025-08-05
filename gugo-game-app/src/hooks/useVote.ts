import { useState } from 'react';
import { supabase } from '@lib/supabase';
import type { VoteSubmission, EloUpdate, SliderUpdate, VoteType, VoteResult } from '@/types/voting';

export function useVote() {
  const [isVoting, setVoting] = useState(false);

  // 🗳️ New sophisticated voting function
  const submitVote = async (voteData: VoteSubmission, userWallet?: string, userVoteCount: number = 0): Promise<VoteResult> => {
    setVoting(true);
    try {
      // Require wallet connection for voting
      if (!userWallet) {
        throw new Error('Wallet connection required to vote. Please connect your wallet first.');
      }

      // Check vote requirements (regular or super)
      if (voteData.super_vote) {
        const hasEnoughVotes = await checkSuperVoteEligibility(userWallet);
        if (!hasEnoughVotes) {
          // Return insufficient votes result instead of throwing error
          return { 
            hash: 'insufficient-votes', 
            voteId: null,
            isPrizeBreak: false,
            voteCount: userVoteCount,
            insufficientVotes: true,
            requiredVotes: 5
          };
        }
      } else {
        const hasEnoughVotes = await checkRegularVoteEligibility(userWallet);
        if (!hasEnoughVotes) {
          // Return insufficient votes result for regular vote
          return { 
            hash: 'insufficient-votes', 
            voteId: null,
            isPrizeBreak: false,
            voteCount: userVoteCount,
            insufficientVotes: true,
            requiredVotes: 1
          };
        }
      }

      const isNoVote = !voteData.winner_id && voteData.engagement_data?.no_vote;
      const voteTypeDescription = isNoVote ? '"No" vote' : `${voteData.vote_type} vote`;
      console.log(`🗳️ Submitting ${voteData.super_vote ? '🔥 SUPER' : 'regular'} ${voteTypeDescription}:`, voteData);

      // Get or create user record
      const userId = await getOrCreateUser(userWallet);

      // Insert the vote record
      const { data: voteRecord, error: voteError } = await supabase
        .from('votes')
        .insert({
          user_id: userId,
          vote_type_v2: voteData.vote_type,
          nft_a_id: voteData.nft_a_id,
          nft_b_id: voteData.nft_b_id,
          winner_id: voteData.winner_id,
          slider_value: voteData.slider_value,
          engagement_data: {
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            vote_count: userVoteCount,
            wallet_address: userWallet,
            super_vote: voteData.super_vote || false,
            vote_cost: voteData.super_vote ? 5 : 1,
            ...voteData.engagement_data
          }
        })
        .select()
        .single();

      if (voteError) {
        throw new Error(`Failed to record vote: ${voteError.message}`);
      }

      // Process the vote based on type  
      if (voteData.vote_type === 'slider') {
        await processSliderVote(voteData);
      } else {
        // Check if this is a "No" vote (no winner selected)
        const isNoVote = !voteData.winner_id && voteData.engagement_data?.no_vote;
        
        if (isNoVote) {
          console.log('🚫 Processing "No" vote - skipping Elo updates');
          // For "No" votes, we record the vote but don't update Elo scores
          // The vote is already recorded in the database above
        } else {
          await processMatchupVote(voteData);
        }
      }

      // Deduct vote cost (1 for regular, 5 for super)
      if (voteData.super_vote) {
        await deductSuperVoteCost(userWallet);
      } else {
        await deductRegularVoteCost(userWallet);
      }

      // Update user statistics
      await updateUserStats(userWallet);

      // Clean up used matchup from queue if it came from queue
      if (voteData.engagement_data?.queueId && typeof voteData.engagement_data.queueId === 'string') {
        await cleanupUsedMatchup(voteData.engagement_data.queueId);
      }

      console.log('✅ Vote processed successfully');
      
      // Check if this triggers a prize break
      const isPrizeBreak = userVoteCount > 0 && (userVoteCount + 1) % 10 === 0;
      
      return { 
        hash: 'vote-processed', 
        voteId: voteRecord.id,
        isPrizeBreak,
        voteCount: userVoteCount + 1,
        insufficientVotes: false
      };

    } catch (err) {
      console.error('❌ Voting failed:', err);
      throw err;
    } finally {
      setVoting(false);
    }
  };

  // 📊 Process slider vote (update NFT slider average)
  const processSliderVote = async (voteData: VoteSubmission) => {
    if (!voteData.nft_a_id || voteData.slider_value === undefined) {
      throw new Error('Invalid slider vote data');
    }

    console.log(`📊 Processing slider vote: NFT ${voteData.nft_a_id}, value: ${voteData.slider_value}`);

    // Get current NFT data for logging
    const { data: nft, error: nftError } = await supabase
      .from('nfts')
      .select('id, slider_average, slider_count')
      .eq('id', voteData.nft_a_id)
      .single();

    if (nftError || !nft) {
      throw new Error('Failed to fetch NFT for slider update');
    }

    // Call the database function with correct parameters (nft_uuid, new_rating)
    const { error: updateError } = await supabase
      .rpc('update_slider_average', {
        nft_uuid: voteData.nft_a_id, 
        new_rating: voteData.slider_value
      });

    if (updateError) {
      console.error('❌ Slider vote update error:', updateError);
      throw new Error(`Failed to update slider average: ${updateError.message}`);
    }

    // Get updated NFT data for logging
    const { data: updatedNft, error: fetchError } = await supabase
      .from('nfts')
      .select('slider_average, slider_count')
      .eq('id', voteData.nft_a_id)
      .single();

    if (!fetchError && updatedNft) {
      console.log(`📊 Slider updated: ${nft.slider_average} → ${updatedNft.slider_average} (count: ${nft.slider_count} → ${updatedNft.slider_count})`);
    } else {
      console.log(`📊 Slider vote processed successfully for NFT ${voteData.nft_a_id}`);
    }
  };

  // 🥊 Process matchup vote (update Elo ratings)
  const processMatchupVote = async (voteData: VoteSubmission) => {
    if (!voteData.nft_a_id || !voteData.nft_b_id || !voteData.winner_id) {
      throw new Error('Invalid matchup vote data');
    }

    const isSuperVote = voteData.super_vote || false;

    // Get current Elo ratings
    const [nftAResult, nftBResult] = await Promise.all([
      supabase
        .from('nfts')
        .select('id, current_elo, wins, losses, total_votes')
        .eq('id', voteData.nft_a_id)
        .single(),
      supabase
        .from('nfts')
        .select('id, current_elo, wins, losses, total_votes')
        .eq('id', voteData.nft_b_id)
        .single()
    ]);

    if (nftAResult.error || nftBResult.error || !nftAResult.data || !nftBResult.data) {
      throw new Error('Failed to fetch NFTs for Elo update');
    }

    const nftA = nftAResult.data;
    const nftB = nftBResult.data;
    const winner = voteData.winner_id === nftA.id ? 'a' : 'b';

    // Determine winner and loser Elo ratings
    const winnerElo = winner === 'a' ? nftA.current_elo : nftB.current_elo;
    const loserElo = winner === 'a' ? nftB.current_elo : nftA.current_elo;
    const voteType = isSuperVote ? 'super' : 'standard';

    // Calculate new Elo ratings using Supabase function
    const { data: eloResult, error: eloError } = await supabase
      .rpc('calculate_elo_update', {
        winner_elo: winnerElo,
        loser_elo: loserElo,
        vote_type: voteType
      });

    if (eloError || !eloResult || !Array.isArray(eloResult) || eloResult.length === 0) {
      console.error('❌ Elo calculation error:', eloError || 'No result returned');
      console.error('❌ Raw eloResult:', eloResult);
      throw new Error('Failed to calculate new Elo ratings');
    }

    const { winner_new_elo, loser_new_elo } = eloResult[0];

    // Map back to NFT A and B ratings
    let new_rating_a, new_rating_b;
    if (winner === 'a') {
      new_rating_a = winner_new_elo;
      new_rating_b = loser_new_elo;
    } else {
      new_rating_a = loser_new_elo;
      new_rating_b = winner_new_elo;
    }

    console.log(`🎯 Elo update calculated:`, {
      nftA: `${nftA.current_elo} → ${new_rating_a}`,
      nftB: `${nftB.current_elo} → ${new_rating_b}`,
      winner: winner === 'a' ? 'NFT A' : 'NFT B',
      voteType
    });

    // Update both NFTs
    const voteWeight = isSuperVote ? 5 : 1; // Super votes count as 5 votes for statistics
    const updatePromises = [
      supabase
        .from('nfts')
        .update({
          current_elo: new_rating_a,
          wins: winner === 'a' ? nftA.wins + voteWeight : nftA.wins,
          losses: winner === 'a' ? nftA.losses : nftA.losses + voteWeight,
          total_votes: nftA.total_votes + voteWeight,
          elo_last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', nftA.id),
      supabase
        .from('nfts')
        .update({
          current_elo: new_rating_b,
          wins: winner === 'b' ? nftB.wins + voteWeight : nftB.wins,
          losses: winner === 'b' ? nftB.losses : nftB.losses + voteWeight,
          total_votes: nftB.total_votes + voteWeight,
          elo_last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', nftB.id)
    ];

    const updateResults = await Promise.all(updatePromises);

    if (updateResults.some(result => result.error)) {
      throw new Error('Failed to update NFT Elo ratings');
    }

    console.log(`${isSuperVote ? '🔥' : '🥊'} Updated Elo${isSuperVote ? ' (SUPER 2x)' : ''}: A(${nftA.current_elo} → ${new_rating_a}) vs B(${nftB.current_elo} → ${new_rating_b}), Winner: ${winner.toUpperCase()}`);
  };

  // 👤 Update user voting statistics
  const updateUserStats = async (userWallet: string) => {
    try {
      // Get user ID first
      const userId = await getOrCreateUser(userWallet);
      
      // First get current values to increment them
      const { data: currentUser } = await supabase
        .from('users')
        .select('total_votes, vote_streak')
        .eq('id', userId)
        .single();

      const { error } = await supabase
        .from('users')
        .update({
          last_vote_at: new Date().toISOString(),
          total_votes: (currentUser?.total_votes || 0) + 1,
          vote_streak: (currentUser?.vote_streak || 0) + 1, // TODO: Add logic to reset if gap > 24h
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.warn('⚠️ Failed to update user stats:', error);
        // Don't throw - this shouldn't block voting
      }
    } catch (error) {
      console.warn('⚠️ Failed to update user stats:', error);
      // Don't throw - this shouldn't block voting
    }
  };

  // 🗑️ Clean up used matchup from queue
  const cleanupUsedMatchup = async (queueId: string) => {
    try {
      const { error } = await supabase
        .from('matchup_queue')
        .delete()
        .eq('id', queueId);
        
      if (error) {
        console.warn('⚠️ Failed to cleanup queue matchup:', error);
        // Don't throw - this shouldn't block voting
      } else {
        console.log('🗑️ Cleaned up used matchup from queue');
      }
    } catch (error) {
      console.warn('⚠️ Queue cleanup error:', error);
    }
  };

  // 🔄 Legacy vote function for backwards compatibility
  const vote = async (winnerId: string, superVote: boolean = false) => {
    console.log('⚠️ Using legacy vote function - consider migrating to submitVote');
    
    // Convert to new vote format
    const voteData: VoteSubmission = {
      vote_type: superVote ? 'same_coll' : 'same_coll', // Map old super vote logic
      winner_id: winnerId,
      engagement_data: {
        legacy_vote: true,
        super_vote: superVote
      }
    };

    return await submitVote(voteData);
  };

  // 👤 Get or create user record
  const getOrCreateUser = async (walletAddress: string): Promise<string> => {
    try {
      // First, try to find existing user
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingUser) {
        return existingUser.id;
      }

      // If not found, create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          wallet_type: 'metamask', // Default, could be detected
          xp: 0,
          total_votes: 0
        })
        .select('id')
        .single();

      if (createError) {
        console.error('❌ Failed to create user:', createError);
        throw new Error('Failed to create user record');
      }

      console.log('✅ Created new user record');
      return newUser.id;
    } catch (error) {
      console.error('❌ Error in getOrCreateUser:', error);
      throw error;
    }
  };

  // 💰 Check if user has enough votes for regular vote (costs 1 vote)
  const checkRegularVoteEligibility = async (userWallet: string): Promise<boolean> => {
    try {
      const userId = await getOrCreateUser(userWallet);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('available_votes')
        .eq('id', userId)
        .single();

      if (error || !user) {
        // If no available_votes field exists, assume they can't vote yet
        console.log('ℹ️ User has no available_votes field - voting not available');
        return false;
      }

      const hasEnough = (user.available_votes || 0) >= 1;
      console.log(`💰 Regular vote eligibility: ${hasEnough} (${user.available_votes}/1 votes)`);
      return hasEnough;
    } catch (error) {
      console.error('❌ Error checking regular vote eligibility:', error);
      return false;
    }
  };

  // 🔥 Check if user has enough votes for super vote (costs 5 votes)
  const checkSuperVoteEligibility = async (userWallet: string): Promise<boolean> => {
    try {
      const userId = await getOrCreateUser(userWallet);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('available_votes')
        .eq('id', userId)
        .single();

      if (error || !user) {
        // If no available_votes field exists, assume they can't super vote yet
        console.log('ℹ️ User has no available_votes field - super vote not available');
        return false;
      }

      const hasEnough = (user.available_votes || 0) >= 5;
      console.log(`🔥 Super vote eligibility: ${hasEnough} (${user.available_votes}/5 votes)`);
      return hasEnough;
    } catch (error) {
      console.error('❌ Error checking super vote eligibility:', error);
      return false;
    }
  };

  // 💳 Deduct votes for regular vote usage
  const deductRegularVoteCost = async (userWallet: string): Promise<void> => {
    try {
      const userId = await getOrCreateUser(userWallet);
      
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('available_votes')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        throw new Error('Could not fetch user vote balance');
      }

      if ((user.available_votes || 0) < 1) {
        throw new Error('Insufficient votes for regular vote');
      }

      const newBalance = (user.available_votes || 0) - 1;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          available_votes: Math.max(0, newBalance) // Ensure it doesn't go negative
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error('Failed to deduct regular vote cost');
      }

      console.log(`💰 Regular vote cost deducted: ${user.available_votes} → ${newBalance} votes`);
    } catch (error) {
      console.error('❌ Error deducting regular vote cost:', error);
      throw error;
    }
  };

  // 💳 Deduct votes for super vote usage
  const deductSuperVoteCost = async (userWallet: string): Promise<void> => {
    try {
      const userId = await getOrCreateUser(userWallet);
      
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('available_votes')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        throw new Error('Could not fetch user vote balance');
      }

      const newBalance = (user.available_votes || 0) - 5;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          available_votes: Math.max(0, newBalance) // Ensure it doesn't go negative
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error('Failed to deduct super vote cost');
      }

      console.log(`💳 Super vote cost deducted: ${user.available_votes} → ${newBalance} votes`);
    } catch (error) {
      console.error('❌ Error deducting super vote cost:', error);
      throw error;
    }
  };

  // Note: Removed anonymous user creation - wallet connection required for voting

  return { 
    submitVote,
    vote, // Legacy function
    isVoting,
    checkSuperVoteEligibility // Export for UI use
  };
}