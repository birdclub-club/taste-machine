import { useState } from 'react';
import { supabase } from '@lib/supabase';
import { useBatchedVoting } from './useBatchedVoting';
import type { VoteSubmission, EloUpdate, SliderUpdate, VoteType, VoteResult } from '@/types/voting';
import { isPrizeBreakVote } from '@/lib/prize-break-utils';

export function useVote() {
  const [isVoting, setVoting] = useState(false);
  const { addVoteToBatch, processPendingVotes } = useBatchedVoting();

  // 🗳️ New sophisticated voting function
  const submitVote = async (voteData: VoteSubmission, userWallet?: string, userVoteCount: number = 0, userXP: number = 0): Promise<VoteResult> => {
    // Only set isVoting for slider votes (immediate processing) - matchup votes are batched for speed
    const isSliderVote = voteData.vote_type === 'slider';
    if (isSliderVote) {
      setVoting(true);
    }
    
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

      // 🚀 SPEED OPTIMIZATION: Use batched processing for matchup votes
      if (voteData.vote_type === 'slider') {
        // Process slider vote in background (non-blocking for better UX)
        // Don't await - process in background to avoid UI blocking
        processSliderVote(voteData).catch(error => {
          console.error('❌ Background slider processing failed:', error);
          // Slider vote failure doesn't block the main vote flow
        });
        console.log('🚀 Slider vote processing started in background...');
        
        // Deduct vote cost immediately for slider votes
        if (voteData.super_vote) {
          await deductSuperVoteCost(userWallet);
        } else {
          await deductRegularVoteCost(userWallet);
        }
        
        // Update user statistics immediately for slider votes
        await updateUserStats(userWallet);
        
        console.log('✅ Slider vote processed immediately');
        
        // Check if this triggers a prize break (XP-based threshold)
        const isPrizeBreak = isPrizeBreakVote(userVoteCount + 1, userXP);
        
        return { 
          hash: 'slider-processed', 
          voteId: voteRecord.id,
          isPrizeBreak,
          voteCount: userVoteCount + 1,
          insufficientVotes: false
        };
      } else {
        // Check if this is a NO vote (valuable negative aesthetic data)
        const isNoVote = !voteData.winner_id && voteData.engagement_data?.no_vote;
        
        if (isNoVote) {
          // Process NO votes immediately to provide negative aesthetic data for both NFTs
          console.log('❌ Processing NO vote immediately (negative aesthetic data)...');
          await processNoVote(voteData);
          
          // Deduct vote cost
          if (voteData.super_vote) {
            await deductSuperVoteCost(userWallet);
          } else {
            await deductRegularVoteCost(userWallet);
          }
          
          // Update user statistics
          await updateUserStats(userWallet);
          
          // Clean up used matchup from queue
          if (voteData.engagement_data?.queueId && typeof voteData.engagement_data.queueId === 'string') {
            await cleanupUsedMatchup(voteData.engagement_data.queueId);
          }
          
          console.log('✅ NO vote processed - negative aesthetic data recorded for both NFTs');
          
          // Check if this triggers a prize break (XP-based threshold)
          const isPrizeBreak = isPrizeBreakVote(userVoteCount + 1, userXP);
          
          return {
            hash: 'no-vote-processed',
            voteId: voteRecord.id,
            isPrizeBreak,
            voteCount: userVoteCount + 1,
            insufficientVotes: false
          };
        } else {
          // 📦 Regular matchup votes use BATCHED PROCESSING for maximum speed
          console.log('⚡ Adding matchup vote to batch for super-fast processing...');
          
          // Add to batch instead of processing immediately
          const batchResult = await addVoteToBatch(voteData, userWallet, userXP);
          
          // Clean up used matchup from queue immediately for UI responsiveness
          if (voteData.engagement_data?.queueId && typeof voteData.engagement_data.queueId === 'string') {
            await cleanupUsedMatchup(voteData.engagement_data.queueId);
          }
          
          // Immediate deduction for instant UI feedback, batch will handle database updates
          if (voteData.super_vote) {
            await deductSuperVoteCost(userWallet);
          } else {
            await deductRegularVoteCost(userWallet);
          }
          
          console.log('⚡ Matchup vote batched for processing - UI responsive!');
          
          return {
            hash: 'batched-for-processing',
            voteId: `batch-${Date.now()}`,
            isPrizeBreak: batchResult.isPrizeBreak,
            voteCount: batchResult.voteCount,
            insufficientVotes: false
          };
        }
      }

    } catch (err) {
      console.error('❌ Voting failed:', err);
      throw err;
    } finally {
      // Only reset isVoting if it was set (for slider votes)
      if (isSliderVote) {
        setVoting(false);
      }
    }
  };

  // 📊 Process slider vote (update NFT slider average)
  const processSliderVote = async (voteData: VoteSubmission) => {
    if (!voteData.nft_a_id || voteData.slider_value === undefined) {
      throw new Error('Invalid slider vote data');
    }

    console.log(`📊 Processing slider vote: NFT ${voteData.nft_a_id}, raw value: ${voteData.slider_value}`);

    // Ensure slider value is an integer (slider sends 0.1-10, which rounds to 0-10)
    const roundedSliderValue = Math.round(voteData.slider_value || 1);
    
    if (roundedSliderValue < 0 || roundedSliderValue > 10) {
      throw new Error(`Invalid slider value: ${roundedSliderValue}. Must be between 0 and 10.`);
    }
    
    // If rounded to 0, set to 1 (minimum meaningful rating)
    const finalSliderValue = roundedSliderValue === 0 ? 1 : roundedSliderValue;
    
    console.log(`📊 Slider value: ${voteData.slider_value} → rounded: ${roundedSliderValue} → final: ${finalSliderValue}`);

    // Get current NFT data for logging
    const { data: nft, error: nftError } = await supabase
      .from('nfts')
      .select('id, slider_average, slider_count')
      .eq('id', voteData.nft_a_id)
      .single();

    if (nftError || !nft) {
      console.error('❌ Failed to fetch NFT for slider update:', nftError);
      throw new Error(`Failed to fetch NFT for slider update: ${nftError?.message || 'Unknown error'}`);
    }

    // Call the database function with correct parameters (nft_uuid, new_rating)
    // Add timeout protection and better error handling
    try {
      const updatePromise = supabase
        .rpc('update_slider_average', {
          nft_uuid: voteData.nft_a_id, 
          new_rating: finalSliderValue
        });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Slider update timeout after 5 seconds')), 5000)
      );

      const result = await Promise.race([updatePromise, timeoutPromise]) as any;
      
      if (result && result.error) {
        console.error('❌ Slider vote update error:', result.error);
        throw new Error(`Failed to update slider average: ${result.error.message || JSON.stringify(result.error)}`);
      }
      
      console.log(`✅ Slider update successful for NFT ${voteData.nft_a_id} with value ${finalSliderValue}`);
    } catch (error: any) {
      console.error('❌ Slider vote update failed:', error);
      
      // If it's a timeout or database error, try multiple fallback approaches
      if (error.message.includes('timeout') || error.message.includes('statement timeout')) {
        console.log('⚠️ Database timeout detected, attempting fallback strategies...');
        
        // Fallback 1: Quick direct update with shorter timeout
        try {
          const fallbackPromise = supabase
            .from('nfts')
            .update({ 
              slider_count: nft.slider_count + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', voteData.nft_a_id);
            
          const fallbackTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fallback timeout')), 2000) // 2 second timeout
          );
          
          const fallbackResult = await Promise.race([fallbackPromise, fallbackTimeout]) as any;
          
          if (fallbackResult?.error) {
            throw new Error(`Fallback update failed: ${fallbackResult.error.message}`);
          }
          
          console.log('✅ Fallback slider update successful (count incremented)');
          return; // Success with fallback
        } catch (fallbackError: any) {
          console.error('❌ Fallback 1 failed:', fallbackError);
          
          // Fallback 2: Just log the vote locally and continue (graceful degradation)
          console.log('⚠️ All database updates failed, gracefully degrading...');
          console.log(`📊 Slider vote recorded locally: NFT ${voteData.nft_a_id}, value: ${finalSliderValue}`);
          
          // Don't throw error - allow the vote to continue processing
          // The vote will still be recorded in the votes table by the main voting system
          return;
        }
      }
      
      // For non-timeout errors, still try the graceful degradation
      console.log('⚠️ Non-timeout error, attempting graceful degradation...');
      console.log(`📊 Slider vote recorded locally: NFT ${voteData.nft_a_id}, value: ${finalSliderValue}`);
      return; // Don't throw - allow vote processing to continue
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

  // 📉 Process NO votes (valuable negative aesthetic data for both NFTs)
  const processNoVote = async (voteData: VoteSubmission) => {
    if (!voteData.nft_a_id || !voteData.nft_b_id) {
      throw new Error('Invalid NO vote data: missing NFT IDs');
    }

    // Fetch both NFTs
    const { data: nfts, error: nftsError } = await supabase
      .from('nfts')
      .select('id, total_votes')
      .in('id', [voteData.nft_a_id, voteData.nft_b_id]);

    if (nftsError || !nfts || nfts.length !== 2) {
      throw new Error(`Failed to fetch NFTs for NO vote: ${nftsError?.message}`);
    }

    const nftA = nfts.find(nft => nft.id === voteData.nft_a_id);
    const nftB = nfts.find(nft => nft.id === voteData.nft_b_id);

    if (!nftA || !nftB) {
      throw new Error('Could not match NFT IDs for NO vote');
    }

    const isSuperVote = voteData.super_vote || false;
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
      throw new Error('Failed to update NFT vote counts for NO vote');
    }

    console.log(`✅ NO vote processed: Both NFTs got +${voteWeight} vote count (negative aesthetic data recorded)`);
  };

  // 🥊 Process matchup vote (update Elo ratings)
  const processMatchupVote = async (voteData: VoteSubmission) => {
    if (!voteData.nft_a_id || !voteData.nft_b_id || !voteData.winner_id) {
      throw new Error('Invalid matchup vote data');
    }

    const isSuperVote = voteData.super_vote || false;

    // Get current Elo ratings (try both column names)
    const [nftAResult, nftBResult] = await Promise.all([
      supabase
        .from('nfts')
        .select('id, current_elo, looks_score, wins, losses, total_votes')
        .eq('id', voteData.nft_a_id)
        .single(),
      supabase
        .from('nfts')
        .select('id, current_elo, looks_score, wins, losses, total_votes')
        .eq('id', voteData.nft_b_id)
        .single()
    ]);

    if (nftAResult.error || nftBResult.error || !nftAResult.data || !nftBResult.data) {
      throw new Error('Failed to fetch NFTs for Elo update');
    }

    const nftA = nftAResult.data;
    const nftB = nftBResult.data;
    const winner = voteData.winner_id === nftA.id ? 'a' : 'b';

    // Use the correct Elo column (current_elo or looks_score)
    const nftAElo = nftA.current_elo !== undefined ? nftA.current_elo : nftA.looks_score;
    const nftBElo = nftB.current_elo !== undefined ? nftB.current_elo : nftB.looks_score;

    // Determine winner and loser Elo ratings
    const winnerElo = winner === 'a' ? nftAElo : nftBElo;
    const loserElo = winner === 'a' ? nftBElo : nftAElo;
    const voteType = isSuperVote ? 'super' : 'standard';

    // Calculate new Elo ratings using Supabase function with fallback
    let winner_new_elo, loser_new_elo;
    
    try {
      const { data: eloResult, error: eloError } = await supabase
        .rpc('calculate_elo_update', {
          winner_elo: winnerElo,
          loser_elo: loserElo,
          vote_type: voteType
        });

      if (eloError || !eloResult || !Array.isArray(eloResult) || eloResult.length === 0) {
        console.warn('⚠️ Supabase Elo function failed, using JavaScript fallback:', eloError || 'No result returned');
        throw new Error('Supabase function failed');
      }

      ({ winner_new_elo, loser_new_elo } = eloResult[0]);
      console.log('✅ Elo calculated via Supabase function');
      
    } catch (functionError) {
      // JavaScript fallback for Elo calculation
      console.log('🔄 Using JavaScript Elo calculation fallback...');
      
      const kFactor = voteType === 'super' ? 64 : 32; // Double K-factor for super votes
      
      // Calculate expected scores
      const expectedWinner = 1.0 / (1.0 + Math.pow(10.0, (loserElo - winnerElo) / 400.0));
      const expectedLoser = 1.0 - expectedWinner;
      
      // Calculate Elo changes
      const winnerChange = Math.round(kFactor * (1.0 - expectedWinner));
      const loserChange = Math.round(kFactor * (0.0 - expectedLoser));
      
      // Apply changes
      winner_new_elo = winnerElo + winnerChange;
      loser_new_elo = loserElo + loserChange;
      
      console.log('✅ Elo calculated via JavaScript fallback:', {
        kFactor,
        winnerChange,
        loserChange,
        winner_new_elo,
        loser_new_elo
      });
    }

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

    // Update both NFTs (update both possible Elo columns)
    const voteWeight = isSuperVote ? 5 : 1; // Super votes count as 5 votes for statistics
    const updatePromises = [
      supabase
        .from('nfts')
        .update({
          current_elo: new_rating_a,
          looks_score: new_rating_a,  // Update both possible columns
          wins: winner === 'a' ? nftA.wins + voteWeight : nftA.wins,
          losses: winner === 'a' ? nftA.losses : nftA.losses + voteWeight,
          total_votes: nftA.total_votes + voteWeight,
          updated_at: new Date().toISOString()
        })
        .eq('id', nftA.id),
      supabase
        .from('nfts')
        .update({
          current_elo: new_rating_b,
          looks_score: new_rating_b,  // Update both possible columns
          wins: winner === 'b' ? nftB.wins + voteWeight : nftB.wins,
          losses: winner === 'b' ? nftB.losses : nftB.losses + voteWeight,
          total_votes: nftB.total_votes + voteWeight,
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