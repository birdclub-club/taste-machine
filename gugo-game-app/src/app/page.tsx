"use client"

import React, { useEffect, useState, useRef } from 'react';
import MatchupCard from '@/components/MatchupCard';
import StatusBar, { StatusBarRef } from '@/components/StatusBar';
import PurchaseAlert from '@/components/PurchaseAlert';
import NetworkStatus from '@/components/NetworkStatus';
import { SessionPrompt } from '@/components/SessionPrompt';
import WelcomePopup from '@/components/WelcomePopup';
import { useVote } from '@/hooks/useVote';
import { usePrizeBreak } from '@/hooks/usePrizeBreak';
import { useSessionKey } from '@/hooks/useSessionKey';
import { useCollectionPreference, getCollectionFilter } from '@/hooks/useCollectionPreference';
import { fetchVotingSession } from '@lib/matchup';
import { votingPreloader } from '@lib/preloader';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { VotingSession, VoteSubmission } from '@/types/voting';
import { fixImageUrl, getNextIPFSGateway, ipfsGatewayManager } from '@lib/ipfs-gateway-manager';
import { supabase } from '@lib/supabase';

// 🔢 Simple hash function for consistent placeholders
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};



// Legacy type for backward compatibility
interface NFTData {
  id: string;
  image: string;
  name?: string;
  collection_address?: string;
  token_address?: string;
}

// Legacy type for backward compatibility
interface Matchup {
  id: string;
  nft1: NFTData;
  nft2: NFTData;
}

export default function Page() {
  const [votingSession, setVotingSession] = useState<VotingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Removed showWalletConnect - now using direct RainbowKit integration
  const [userVoteCount, setUserVoteCount] = useState(0);
  const [preloaderReady, setPreloaderReady] = useState(false);
  const [preloaderStatus, setPreloaderStatus] = useState({ 
    queueLength: 0, 
    isPreloading: false, 
    cacheSize: 0, 
    seenNFTs: 0, 
    maxSeenNFTs: 50 
  });
  const [currentSliderValue, setCurrentSliderValue] = useState(0);
  const [showPurchaseAlert, setShowPurchaseAlert] = useState(false);
  const [requiredVotes, setRequiredVotes] = useState(5);
  const [imageFailureCount, setImageFailureCount] = useState(0);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [freeVotesPrizeBreak, setFreeVotesPrizeBreak] = useState(false);
  const [showSessionPrompt, setShowSessionPrompt] = useState<{
    isOpen: boolean;
    trigger: 'first-reward' | 'vote-purchase';
    pendingPrizeBreak?: { voteCount: number };
  }>({
    isOpen: false,
    trigger: 'first-reward'
  });
  const { submitVote, vote, isVoting } = useVote();
  const { prizeBreakState, startPrizeBreak, endPrizeBreak, clearRewardState } = usePrizeBreak();
  const { address, isConnected } = useAccount();
  const { 
    sessionStatus, 
    createSession, 
    isCreatingSession, 
    isSessionActive 
  } = useSessionKey();
  const { 
    preference, 
    shouldShowWelcome, 
    setCollectionPreference 
  } = useCollectionPreference();
  const statusBarRef = useRef<StatusBarRef>(null);
  
  // Current blockchain - can be made dynamic in the future
  const currentChain = "Abstract";




  // 📊 Update preloader status (only when changed)
  const updatePreloaderStatus = () => {
    const status = votingPreloader.getSessionStats();
    // Only update if status actually changed to prevent unnecessary re-renders
    setPreloaderStatus(prev => {
      if (prev.queueLength !== status.queueLength || 
          prev.isPreloading !== status.isPreloading || 
          prev.cacheSize !== status.cacheSize ||
          prev.seenNFTs !== status.seenNFTs) {
        return status;
      }
      return prev;
    });
  };

  // 🔄 Reset slider when session changes
  useEffect(() => {
    if (votingSession?.vote_type === 'slider') {
      setCurrentSliderValue(0);
    }
  }, [votingSession]);

  // ⚡ Ultra-fast session loading with preloader  
  const loadVotingSession = React.useCallback(async () => {
    try {
      setError(null);
      
      // Try to get from preloader first (instant)
      const preloadedSession = votingPreloader.getNextSession();
      updatePreloaderStatus(); // Update status after getting session
      
      if (preloadedSession) {
        setLoading(false);
        const session = preloadedSession;
        setVotingSession(session);
        console.log(`⚡ Instant ${session.vote_type} session from preloader`);
        return;
      }
      
      // Fallback to database if preloader empty
      console.log('📦 Preloader empty, falling back to database...');
      setLoading(true);
      
      // Get collection filter based on user preference
      const collectionFilter = getCollectionFilter(preference);
      const session = await fetchVotingSession(address, collectionFilter || undefined);
      setVotingSession(session);
      
      console.log(`🎯 Loaded ${session.vote_type} voting session from database`);
    } catch (err) {
      console.error('Failed to fetch voting session:', err);
      setError('Failed to load voting session. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [address]);

  // 🔥 Initialize preloader on mount
  useEffect(() => {
    const initializePreloader = async () => {
      console.log('🔥 Initializing voting preloader...');
      await votingPreloader.initialize();
      
      // 🚫👻 Force clear any old cached sessions with unrevealed NFTs
      console.log('🔄 Forcing full reset to apply unrevealed NFT filters...');
      await votingPreloader.forceFullReset();
      
      setPreloaderReady(true);
      updatePreloaderStatus();
      console.log('✅ Preloader ready with fresh sessions!');
    };
    
    initializePreloader();
    
    // Update status every 5 seconds and enforce minimum queue  
    const statusInterval = setInterval(() => {
      updatePreloaderStatus();
      
      // Periodic queue health check
      const status = votingPreloader.getStatus();
      if (status.queueLength < 5 && !status.isPreloading) {
        console.log('🔧 Queue health check: topping up queue');
        // Use preloadSessions as fallback if ensureMinimumQueue doesn't exist
        if (typeof votingPreloader.ensureMinimumQueue === 'function') {
          votingPreloader.ensureMinimumQueue();
        } else {
          votingPreloader.preloadSessions(3);
        }
      }
    }, 5000);
    
    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    if (preloaderReady) {
      loadVotingSession();
    }
  }, [address, preloaderReady]);

  const handleVote = async (winnerId: string, superVote: boolean = false) => {
    if (!votingSession) return;
    
    // Require wallet connection (handled at page level now)
    if (!isConnected || !address) {
      setError('Please connect your wallet to vote.');
      return;
    }
    
    try {
      // Create vote submission data based on voting session type
      const voteData: VoteSubmission = {
        vote_type: votingSession.vote_type,
        super_vote: superVote,
        engagement_data: {
          queueId: votingSession.queueId,
          super_vote: superVote,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      if (votingSession.vote_type === 'slider') {
        // For slider votes, winnerId is actually the slider value
        voteData.nft_a_id = votingSession.nft.id;
        voteData.slider_value = parseFloat(winnerId); // Convert slider value
      } else {
        // For matchup votes
        voteData.nft_a_id = votingSession.nft1.id;
        voteData.nft_b_id = votingSession.nft2.id;
        voteData.winner_id = winnerId;
      }

      const result = await submitVote(voteData, address, userVoteCount);
      
      // Check for insufficient votes
      if (result.insufficientVotes) {
        console.log(`💳 Insufficient votes for super vote: need ${result.requiredVotes || 5}`);
        setRequiredVotes(result.requiredVotes || 5);
        setShowPurchaseAlert(true);
        return; // Don't proceed with vote
      }
      
      // Update vote count
      setUserVoteCount(result.voteCount);
      
      // Refresh user data to update Licks balance in status bar
      statusBarRef.current?.refreshUserData();
      
      // Check for prize break
      if (result.isPrizeBreak) {
        console.log(`🎁 Prize break triggered after ${result.voteCount} votes!`);
        
        // 🔑 CHECK: Does user have session key for claiming rewards?
        const hasSession = sessionStatus?.hasActiveSession && !sessionStatus?.isExpired;
        
        if (!hasSession) {
          console.log('⚠️ Prize break triggered but no session - prompting for session creation');
          setShowSessionPrompt({
            isOpen: true,
            trigger: 'first-reward',
            pendingPrizeBreak: { voteCount: result.voteCount }
          });
          return; // Don't start prize break without session
        }
        
        // User has session - proceed with normal prize break flow
        await startPrizeBreak(result.voteCount);
        
        // Reset duplicate tracking for fresh variety after prize break
        console.log('🎯 Resetting session for fresh NFTs after prize break...');
        votingPreloader.resetSession();
        
        // Load next session now during prize break so it's ready when break ends
        console.log('🔄 Loading next session during prize break...');
        await loadVotingSession();
        
        // Show prize break UI for 3 seconds minimum, then end break
        setTimeout(async () => {
          try {
            console.log('⏰ Auto-ending prize break after 3 seconds...');
            const refillResult = await endPrizeBreak();
            if (refillResult) {
              console.log(`🔄 Queue refilled during prize break: +${refillResult.added.total} matchups`);
            }
            // Only load new session if we don't already have one
            if (!votingSession) {
              console.log('📭 No session loaded, fetching new one...');
              await loadVotingSession();
            } else {
              console.log('✅ Session already loaded, keeping current one');
            }
          } catch (error) {
            console.error('❌ Error ending prize break:', error);
            // Force end prize break on error
            await endPrizeBreak();
            if (!votingSession) {
              await loadVotingSession();
            }
          }
        }, 3000);
        return; // Don't load next session immediately
      }
      
      // Load next voting session after successful vote (only if not prize break)
      await loadVotingSession();
      
    } catch (error) {
      console.error('Vote failed:', error);
      if (error instanceof Error && error.message.includes('Wallet connection required')) {
        setError('Please connect your wallet to vote.');
      } else {
        setError('Vote failed. Please try again.');
      }
    }
  };

  const handleSliderVote = async (sliderValue: number, superVote: boolean = false) => {
    await handleVote(sliderValue.toString(), superVote);
  };

  // Removed handleConnectWallet - now using direct RainbowKit integration

  // 💳 Handle vote purchase
  const handlePurchaseVotes = () => {
    console.log('💳 Opening vote purchase...');
    // TODO: Integrate with payment system
    alert('💳 Vote purchase coming soon! This will open a payment interface to buy more votes.');
    setShowPurchaseAlert(false);
  };

  // ❌ Close purchase alert
  const handleClosePurchaseAlert = () => {
    setShowPurchaseAlert(false);
  };

  // 🔑 Session prompt handlers
  const handleCreateSession = async () => {
    console.log('🔑 Creating session from prompt...');
    
    try {
      const success = await createSession();
      
      if (success) {
        console.log('✅ Session created successfully!');
        
        // If there's a pending prize break, execute it now
        if (showSessionPrompt.pendingPrizeBreak) {
          console.log('🎁 Executing pending prize break with new session...');
          await startPrizeBreak(showSessionPrompt.pendingPrizeBreak.voteCount);
          
          // Reset tracking and load next session
          votingPreloader.resetSession();
          await loadVotingSession();
        }
        
        // Close the prompt
        setShowSessionPrompt({ isOpen: false, trigger: 'first-reward' });
        
      } else {
        console.log('❌ Session creation failed or was cancelled');
        // Keep prompt open so user can try again
      }
    } catch (error) {
      console.error('❌ Error creating session:', error);
      // Keep prompt open so user can try again
    }
  };

  const handleSkipSession = () => {
    console.log('⏭️ User skipped session creation');
    
    if (showSessionPrompt.trigger === 'first-reward') {
      // Show warning that they'll miss the reward
      setError('⚠️ You skipped your reward! Create a gaming session to claim future rewards.');
      
      // Clear any pending prize break
      setShowSessionPrompt({ isOpen: false, trigger: 'first-reward' });
      
      // Continue voting normally
      loadVotingSession();
    } else {
      // For vote purchase, just close and continue
      setShowSessionPrompt({ isOpen: false, trigger: 'first-reward' });
    }
  };

  const handleCloseSessionPrompt = () => {
    console.log('❌ User closed session prompt');
    
    // Same as skip for now
    handleSkipSession();
  };

  // 🎯 Handle collection preference choice
  const handleCollectionChoice = async (choice: 'bearish' | 'mix') => {
    console.log(`🎯 User chose collection preference: ${choice}`);
    setCollectionPreference(choice);
    
    // Force reload preloader with new preference
    console.log('🔄 Reloading preloader with collection preference...');
    await votingPreloader.forceFullReset();
    await votingPreloader.initialize();
    
    // Load a new session that matches the preference
    await loadVotingSession();
  };

  // 🛒 Function to trigger session prompt for vote purchase
  const promptSessionForPurchase = () => {
    const hasSession = sessionStatus?.hasActiveSession && !sessionStatus?.isExpired;
    
    if (!hasSession) {
      console.log('🛒 Prompting for session before vote purchase');
      setShowSessionPrompt({
        isOpen: true,
        trigger: 'vote-purchase'
      });
      return true; // Prompt shown
    }
    
    return false; // No prompt needed
  };

  // 🎁 Graceful image failure handler with free votes
  const handleImageSystemFailure = async () => {
    setImageFailureCount(prev => prev + 1);
    
    // First failure: Give 10 free votes and trigger prize break
    if (imageFailureCount === 0) {
      console.log('🎁 Image loading issues detected - giving 10 free votes!');
      
      // Award 10 free votes to the user
      if (address) {
        try {
          await supabase
            .from('users')
            .upsert({
              wallet_address: address,
              available_votes: (userVoteCount || 0) + 10,
              last_free_votes: new Date().toISOString()
            }, {
              onConflict: 'wallet_address'
            });
          
          setUserVoteCount(prev => prev + 10);
          console.log('✅ Awarded 10 free votes to user');
        } catch (error) {
          console.error('❌ Error awarding free votes:', error);
        }
      }
      
      // Trigger prize break with free votes message
      setFreeVotesPrizeBreak(true);
      await startPrizeBreak(userVoteCount);
      
      // Try to reload sessions during prize break
      setTimeout(async () => {
        try {
          console.log('🔄 Attempting to recover during prize break...');
          votingPreloader.forceFullReset();
          await votingPreloader.preloadSessions(8);
          
          // Check if we have valid sessions now
          const testSession = votingPreloader.getNextSession();
          if (testSession) {
            console.log('✅ System recovered - ending prize break early');
            await endPrizeBreak();
            setImageFailureCount(0); // Reset failure count
            setMaintenanceMode(false);
            setFreeVotesPrizeBreak(false); // Reset free votes flag
            await loadVotingSession();
          } else {
            console.log('⚠️ System still having issues - entering maintenance mode');
            setMaintenanceMode(true);
            setFreeVotesPrizeBreak(false); // Reset free votes flag
            await endPrizeBreak();
          }
        } catch (error) {
          console.error('❌ Recovery failed:', error);
          setMaintenanceMode(true);
          setFreeVotesPrizeBreak(false); // Reset free votes flag
          await endPrizeBreak();
        }
      }, 3000); // Give 3 seconds during prize break
      
    } else {
      // Subsequent failures: Enter maintenance mode
      console.log('🔧 Multiple image failures - entering maintenance mode');
      setMaintenanceMode(true);
      setError('System currently undergoing routine maintenance. Please check back in a few minutes.');
    }
  };

  // Always show the normal dark gaming interface
  // Wallet connection is handled in StatusBar with RainbowKit

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#1a1a1a',
      position: 'relative'
    }}>
      {/* Clean Dot Grid Background */}
      <div className="dot-grid"></div>
      
      {/* Network Status Alert */}
      <NetworkStatus />
      
      {/* Status Bar */}
              <StatusBar 
          ref={statusBarRef} 
          onConnectWallet={() => {}} // No longer needed - StatusBar has direct RainbowKit
        />
        
        {/* Main Content */}
      <main style={{ 
        padding: 'var(--space-4) var(--space-6)',
        minHeight: 'calc(100vh - 80px)',
        position: 'relative',
        zIndex: 5,
        overflow: 'visible'
      }}>
        <div className="swiss-grid" style={{ overflow: 'visible' }}>
          <div style={{ 
            gridColumn: '1 / 13',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8)',
            overflow: 'visible'
          }}>
            
            {/* Title and Tagline */}
            <div className="fade-in" style={{ 
              textAlign: 'center',
              paddingTop: 'var(--space-6)'
            }}>
              <h1 className="text-hero" style={{ 
                color: '#aca9a9',
                opacity: '0.10',
                marginBottom: 'var(--space-4)',
                maxWidth: '1200px',
                margin: '0 auto var(--space-4) auto',
                fontSize: 'clamp(3rem, 6vw, 5rem)',
                lineHeight: '1.1',
                whiteSpace: 'nowrap'
              }}>
                BEAUTY OVER METADATA
              </h1>
              <p className="text-subtitle" style={{ 
                color: '#e5e5e5',
                maxWidth: '500px',
                margin: '0 auto',
                fontWeight: '300'
              }}>
                Powered by GUGO
              </p>
            </div>

            {/* Voting Section - Now at the top */}
            <section style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-8)',
              paddingTop: 'var(--space-4)'
            }}>
              {loading ? (
                <div className="slide-up" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-6)',
                  background: '#2a2a2a', // Dark background to match site theme
                  border: '1px solid #444444', // Dark border
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)', // Darker shadow
                  color: 'var(--color-white)' // White text for dark background
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--color-green)',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Loading matchups</span>
                </div>
              ) : maintenanceMode ? (
                <div className="slide-up" style={{
                  padding: 'var(--space-8)',
                  background: 'var(--color-white)',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow)',
                  color: 'var(--color-grey-800)',
                  textAlign: 'center',
                  maxWidth: '500px'
                }}>
                  <div style={{ 
                    fontSize: '3rem',
                    marginBottom: 'var(--space-4)'
                  }}>
                    🔧
                  </div>
                  <div style={{ 
                    color: 'var(--color-black)',
                    fontWeight: '600',
                    fontSize: 'var(--font-size-xl)',
                    marginBottom: 'var(--space-3)'
                  }}>
                    System Maintenance
                  </div>
                  <div className="text-caption" style={{ 
                    marginBottom: 'var(--space-4)',
                    lineHeight: 1.5
                  }}>
                    We're currently performing routine maintenance to improve your experience.
                    <br />
                    Please check back in a few minutes.
                  </div>
                  <button 
                    onClick={() => {
                      setMaintenanceMode(false);
                      setImageFailureCount(0);
                      setError(null);
                      window.location.reload();
                    }}
                    className="btn-primary"
                    style={{ marginBottom: 'var(--space-3)' }}
                  >
                    Try Again
                  </button>
                  <div style={{ 
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-grey-500)'
                  }}>
                    Thank you for your patience
                  </div>
                </div>
              ) : error ? (
                <div className="slide-up" style={{
                  padding: 'var(--space-6)',
                  background: 'var(--color-white)',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow)',
                  color: 'var(--color-grey-800)',
                  textAlign: 'center',
                  maxWidth: '500px'
                }}>
                  <div style={{ 
                    color: 'var(--color-black)',
                    fontWeight: '600',
                    marginBottom: 'var(--space-2)'
                  }}>
                    Something went wrong
                  </div>
                  <div className="text-caption" style={{ marginBottom: 'var(--space-4)' }}>
                    {error}
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    className="btn-primary"
                  >
                    Refresh Page
                  </button>
                </div>
              ) : !votingSession ? (
                <div className="slide-up" style={{
                  padding: 'var(--space-6)',
                  background: 'var(--color-white)',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow)',
                  color: 'var(--color-grey-600)',
                  textAlign: 'center'
                }}>
                  No voting sessions available at the moment.
                </div>
              ) : !isConnected ? (
                <div className="slide-up" style={{
                  padding: 'var(--space-8)',
                  background: 'var(--color-white)',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow)',
                  textAlign: 'center',
                  maxWidth: '500px'
                }}>
                  <div style={{ 
                    fontSize: 'var(--font-size-2xl)',
                    fontWeight: '600',
                    color: 'var(--color-black)',
                    marginBottom: 'var(--space-3)'
                  }}>
                    Connect to Start Voting
                  </div>
                  <div className="text-caption" style={{ marginBottom: 'var(--space-6)' }}>
                    Connect your wallet to participate in aesthetic voting and earn rewards.
                  </div>
                  
                  {/* RainbowKit Connect Button */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ConnectButton 
                      label="Connect Wallet"
                      showBalance={false}
                      chainStatus="icon"
                      accountStatus={{
                        smallScreen: 'avatar',
                        largeScreen: 'full',
                      }}
                    />
                  </div>
                </div>
              ) : votingSession ? (
                votingSession.vote_type === 'slider' ? (
                  // Slider voting interface - Matchup card style
                  <div className="slide-up" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-6)',
                    width: '100%',
                    maxWidth: '600px'
                  }}>
                    
                    {/* Matchup-style NFT Card */}
                    <div style={{
                      width: '100%',
                      maxWidth: '600px',
                      background: 'var(--color-white)',
                      border: '2px solid var(--color-grey-200)',
                      borderRadius: 'var(--border-radius-lg)',
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out',
                      opacity: isVoting ? 0.7 : 1
                    }}>
                      {/* Image Container */}
                      <div style={{
                        aspectRatio: '1',
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'var(--color-grey-100)'
                      }}>
                        <img 
                          src={fixImageUrl(votingSession.nft.image)} 
                          alt={votingSession.nft.name}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover'
                          }}
                          onLoadStart={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Set 5-second timeout for image loading
                            const timeoutId = setTimeout(() => {
                              console.log(`⏰ Image loading timeout for slider NFT ${votingSession.nft.id}, trying next gateway...`);
                              target.dispatchEvent(new Event('error'));
                            }, 5000);
                            target.dataset.loadTimeout = timeoutId.toString();
                          }}
                          onError={async (e) => {
                            const target = e.target as HTMLImageElement;
                            
                            // Clear loading timeout
                            if (target.dataset.loadTimeout) {
                              clearTimeout(parseInt(target.dataset.loadTimeout));
                              delete target.dataset.loadTimeout;
                            }
                            
                            const retryCount = parseInt(target.dataset.retryCount || '0');
                            
                            // Check if we've already tried retrying this image 3 times
                            if (retryCount >= 3) {
                              console.log(`❌ All gateways failed for slider NFT ${votingSession.nft.id} after ${retryCount} attempts, skipping to next session...`);
                              
                              // Skip to next session with working images
                              try {
                                const nextSession = await votingPreloader.skipFailedSession();
                                if (nextSession) {
                                  setVotingSession(nextSession);
                                  console.log(`✅ Loaded next session: ${nextSession.vote_type}`);
                                } else {
                                  console.log('🚨 No valid sessions available - triggering graceful fallback');
                                  await handleImageSystemFailure();
                                }
                              } catch (error) {
                                console.error('❌ Error skipping to next session:', error);
                                await handleImageSystemFailure();
                              }
                              return;
                            }
                            
                            console.log(`❌ Slider image failed for NFT ${votingSession.nft.id} (attempt ${retryCount + 1}):`, target.src);
                            target.dataset.retryCount = (retryCount + 1).toString();
                            
                            const nextSrc = getNextIPFSGateway(target.src, votingSession.nft.image);
                            console.log(`🔄 Trying next gateway:`, nextSrc);
                            target.src = nextSrc;
                          }}
                          onLoad={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Clear loading timeout on successful load
                            if (target.dataset.loadTimeout) {
                              clearTimeout(parseInt(target.dataset.loadTimeout));
                              delete target.dataset.loadTimeout;
                            }
                            
                            // Track gateway success
                            const currentGateway = target.src.split('/ipfs/')[0] + '/ipfs/';
                            ipfsGatewayManager.recordSuccess(currentGateway);
                            
                            console.log(`✅ Slider image loaded for NFT ${votingSession.nft.id}`);
                          }}
                        />
                      </div>
                      
                      {/* White Info Section - Exact Matchup Card Style */}
                      <div style={{
                        padding: 'var(--space-4)',
                        background: 'var(--color-white)',
                        borderTop: '1px solid var(--color-grey-200)',
                        cursor: 'default',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end'
                      }}>
                        {/* Left side - Collection info and Super Vote button */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-grey-600)',
                          justifyContent: 'flex-start',
                          flex: '1'
                        }}>
                          {/* Super Vote Fire Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('🔥 Super vote triggered for slider NFT:', votingSession.nft.id);
                              handleSliderVote(currentSliderValue, true); // true = super vote
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                              padding: 'var(--space-1)',
                              borderRadius: 'var(--border-radius-sm)',
                              transition: 'transform 0.2s ease, background 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 'var(--space-2)'
                            }}
                            onMouseEnter={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.transform = 'scale(1.1)';
                              target.style.background = 'rgba(255, 69, 0, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.transform = 'scale(1)';
                              target.style.background = 'none';
                            }}
                            title="Super Vote"
                          >
                            🔥
                          </button>

                        </div>
                        
                        {/* Token ID - Right Side - Exact MatchupCard style */}
                        {votingSession.nft.token_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(votingSession.nft.token_id.toString());
                            }}
                            onMouseEnter={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.opacity = '0.6';
                              target.style.color = '#d0d0d0';
                            }}
                            onMouseLeave={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.opacity = '0.3';
                              target.style.color = '#e5e5e5';
                            }}
                            style={{
                              fontSize: '2.5rem',
                              fontWeight: '900',
                              color: '#e5e5e5',
                              lineHeight: '1',
                              userSelect: 'none',
                              opacity: 0.3,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0',
                              transition: 'opacity 0.2s ease, color 0.2s ease'
                            }}
                            title="Copy token ID"
                          >
                            #{votingSession.nft.token_id}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Custom Slider Section - Matchup style */}
                    <div style={{ 
                      width: '100%', 
                      maxWidth: '600px',
                      padding: 'var(--space-4)',
                      paddingBottom: 'var(--space-6)'
                    }}>
                      {/* Instruction text */}
                      <div style={{
                        textAlign: 'center',
                        marginBottom: 'var(--space-4)',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--color-grey-500)',
                        fontWeight: '500'
                      }}>
                        Slide how much you like it.
                      </div>
                      
                      {/* Custom Slider Track */}
                      <div
                        className="custom-slider-track"
                        style={{
                          width: '100%',
                          height: '48px',
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.05) 100%)',
                          borderRadius: '24px',
                          position: 'relative',
                          border: '2px solid rgba(255,255,255,0.1)',
                          cursor: 'grab',
                          overflow: 'hidden',
                          marginBottom: 'var(--space-3)'
                        }}
                        onMouseDown={(e) => {
                          if (isVoting) return;
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                          const value = Math.max(0.1, (percentage / 100) * 10);
                          setCurrentSliderValue(value);
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const newX = moveEvent.clientX - rect.left;
                            const newPercentage = Math.max(0, Math.min(100, (newX / rect.width) * 100));
                            const newValue = Math.max(0.1, (newPercentage / 100) * 10);
                            setCurrentSliderValue(newValue);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                            if (!isConnected) {
                              setError('Please connect your wallet to vote.');
                              // No longer needed - wallet connection handled at page level;
                              return;
                            }
                            handleSliderVote(currentSliderValue);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        onTouchStart={(e) => {
                          if (isVoting) return;
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const touch = e.touches[0];
                          const x = touch.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                          const value = Math.max(0.1, (percentage / 100) * 10);
                          setCurrentSliderValue(value);
                          
                          const handleTouchMove = (moveEvent: TouchEvent) => {
                            const moveTouch = moveEvent.touches[0];
                            const newX = moveTouch.clientX - rect.left;
                            const newPercentage = Math.max(0, Math.min(100, (newX / rect.width) * 100));
                            const newValue = Math.max(0.1, (newPercentage / 100) * 10);
                            setCurrentSliderValue(newValue);
                          };
                          
                          const handleTouchEnd = () => {
                            document.removeEventListener('touchmove', handleTouchMove);
                            document.removeEventListener('touchend', handleTouchEnd);
                            if (!isConnected) {
                              setError('Please connect your wallet to vote.');
                              // No longer needed - wallet connection handled at page level;
                              return;
                            }
                            handleSliderVote(currentSliderValue);
                          };
                          
                          document.addEventListener('touchmove', handleTouchMove);
                          document.addEventListener('touchend', handleTouchEnd);
                        }}
                      >


                        {/* Slider Handle with Abstract Logo */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(${Math.max(8, Math.min(92, (currentSliderValue / 10) * 100))}% - 28px)`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '56px',
                            height: '44px',
                            background: currentSliderValue > 0 ? 'var(--accent-color)' : 'var(--color-white)',
                            borderRadius: '22px',
                            border: '2px solid rgba(255,255,255,0.2)',
                            boxShadow: currentSliderValue > 0 ? '0 4px 12px rgba(0,211,149,0.3)' : '0 2px 8px rgba(255,255,255,0.1)',
                            transition: 'all 0.2s ease-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isVoting ? 'not-allowed' : 'grab',
                            userSelect: 'none'
                          }}
                        >
                          <img
                            src="/abstract-logo.png"
                            alt="Abstract"
                            style={{
                              width: '24px',
                              height: '24px',
                              objectFit: 'contain',
                              opacity: currentSliderValue > 0 ? 1 : 0.6,
                              filter: currentSliderValue > 0 ? 'brightness(0) invert(1)' : 'none',
                              transition: 'all 0.2s ease-out'
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Emoji indicators underneath */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 'var(--font-size-xl)',
                        paddingLeft: 'var(--space-6)',
                        paddingRight: 'var(--space-6)',
                        marginTop: 'var(--space-2)',
                        opacity: 0.7
                      }}>
                        <span>😐</span>
                        <span>😊</span>
                        <span>🤩</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Matchup voting interface  
                  isConnected ? (
                    <MatchupCard
                      nft1={votingSession.nft1}
                      nft2={votingSession.nft2}
                      onVote={handleVote}
                      onNoVote={async () => {
                        console.log('🚫 User voted "No" - doesn\'t like either NFT');
                        
                        // Require wallet connection for "No" votes too
                        if (!isConnected || !address) {
                          setError('Please connect your wallet to vote.');
                          // No longer needed - wallet connection handled at page level;
                          return;
                        }
                        
                        try {
                          // Create "No" vote submission - costs 1 Lick but doesn't affect Elo
                          const voteData: VoteSubmission = {
                            vote_type: votingSession.vote_type,
                            nft_a_id: votingSession.nft1.id,
                            nft_b_id: votingSession.nft2.id,
                            // No winner_id - indicates "No" vote
                            engagement_data: {
                              queueId: votingSession.queueId,
                              no_vote: true, // Special flag for "No" votes
                              user_agent: navigator.userAgent,
                              timestamp: new Date().toISOString()
                            }
                          };

                          const result = await submitVote(voteData, address, userVoteCount);
                          
                          // Check for insufficient votes
                          if (result.insufficientVotes) {
                            console.log(`💳 Insufficient votes for "No" vote: need ${result.requiredVotes || 1}`);
                            setRequiredVotes(result.requiredVotes || 1);
                            setShowPurchaseAlert(true);
                            return;
                          }
                          
                          // Update vote count
                          setUserVoteCount(result.voteCount);
                          
                          // Refresh user data to update Licks balance
                          statusBarRef.current?.refreshUserData();
                          
                          // Check for prize break
                          if (result.isPrizeBreak) {
                            console.log(`🎁 Prize break triggered after ${result.voteCount} votes!`);
                            
                            // 🔑 CHECK: Does user have session key for claiming rewards?
                            const hasSession = sessionStatus?.hasActiveSession && !sessionStatus?.isExpired;
                            
                            if (!hasSession) {
                              console.log('⚠️ Prize break triggered but no session - prompting for session creation');
                              setShowSessionPrompt({
                                isOpen: true,
                                trigger: 'first-reward',
                                pendingPrizeBreak: { voteCount: result.voteCount }
                              });
                              return; // Don't start prize break without session
                            }
                            
                            // User has session - proceed with normal prize break flow
                            await startPrizeBreak(result.voteCount);
                            
                            // Reset duplicate tracking for fresh variety after prize break
                            console.log('🎯 Resetting session for fresh NFTs after prize break...');
                            votingPreloader.resetSession();
                            
                            // Load next session now during prize break so it's ready when break ends
                            console.log('🔄 Loading next session during prize break...');
                            await loadVotingSession();
                            return;
                          }
                          
                          // Load next voting session
                          await loadVotingSession();
                          
                        } catch (error) {
                          console.error('❌ Error handling no vote:', error);
                          setError('Error processing vote');
                        }
                      }}
                      onImageFailure={async () => {
                        console.log('❌ Matchup images failed, skipping to next session...');
                        try {
                          const nextSession = await votingPreloader.skipFailedSession();
                          if (nextSession) {
                            setVotingSession(nextSession);
                            console.log(`✅ Loaded next session: ${nextSession.vote_type}`);
                          } else {
                            console.log('🚨 No valid sessions available - triggering graceful fallback');
                            await handleImageSystemFailure();
                          }
                        } catch (error) {
                          console.error('❌ Error skipping to next session:', error);
                          await handleImageSystemFailure();
                        }
                      }}
                      isVoting={isVoting}
                    />
                  ) : (
                    <div style={{
                      padding: 'var(--space-8)',
                      background: 'var(--color-white)',
                      borderRadius: 'var(--border-radius-lg)',
                      boxShadow: 'var(--shadow)',
                      textAlign: 'center',
                      maxWidth: '500px'
                    }}>
                      <h3 style={{ color: 'var(--color-grey-800)', margin: '0 0 var(--space-4) 0' }}>
                        🔗 Connect Wallet to Vote
                      </h3>
                      <p style={{ color: 'var(--color-grey-600)', margin: '0 0 var(--space-6) 0' }}>
                        Connect your wallet to start voting on NFT aesthetics and earn rewards.
                      </p>
                      
                      {/* RainbowKit Connect Button */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ConnectButton 
                          label="Connect Wallet"
                          showBalance={false}
                          chainStatus="icon"
                          accountStatus={{
                            smallScreen: 'avatar',
                            largeScreen: 'full',
                          }}
                        />
                      </div>
                    </div>
                  )
                )
              ) : (
                <div style={{
                  padding: 'var(--space-6)',
                  background: 'var(--color-white)',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow)',
                  color: 'var(--color-grey-600)',
                  textAlign: 'center'
                }}>
                  No voting session available
                </div>
              )}
            </section>

            {/* Prize Break Overlay */}
            {prizeBreakState.isActive && (
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  cursor: 'pointer'
                }}
                onClick={async (e) => {
                  // Only dismiss if clicking the overlay background, not the modal content
                  if (e.target === e.currentTarget) {
                    console.log('🎯 Dismissing prize break by clicking overlay...');
                    try {
                      const refillResult = await endPrizeBreak();
                      setFreeVotesPrizeBreak(false); // Reset free votes flag
                      clearRewardState(); // Clear reward state
                      if (refillResult) {
                        console.log(`🔄 Queue refilled during overlay dismiss: +${refillResult.added.total} matchups`);
                      }
                      await loadVotingSession();
                    } catch (error) {
                      console.error('❌ Error dismissing prize break via overlay:', error);
                      await endPrizeBreak(); // Force end on error
                      setFreeVotesPrizeBreak(false); // Reset free votes flag
                      clearRewardState(); // Clear reward state on error too
                      await loadVotingSession();
                    }
                  }
                }}
              >
                <div 
                  style={{
                    background: 'var(--color-black)',
                    border: '2px solid var(--color-green)',
                    borderRadius: 'var(--border-radius-lg)',
                    padding: 'var(--space-10)',
                    textAlign: 'center',
                    maxWidth: '800px',
                    margin: 'var(--space-4)',
                    cursor: 'default',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
                  }}
                  onClick={(e) => e.stopPropagation()} // Prevent overlay dismiss when clicking modal content
                >
                  {/* Random congratulatory phrase */}
                  <h2 style={{ 
                    color: 'var(--color-green)', 
                    margin: '0 0 var(--space-6) 0',
                    fontSize: '1rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {freeVotesPrizeBreak ? (
                      '🎁 FREE VOTES!'
                    ) : prizeBreakState.isClaimingReward ? (
                      'REWARD INCOMING'
                    ) : prizeBreakState.reward ? (
                      (() => {
                        const phrases = ['YOU WIN!', 'CONGRATS!', 'HELL YES!'];
                        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
                        return randomPhrase;
                      })()
                    ) : (
                      'YOU WIN!'
                    )}
                  </h2>

                  {/* Big reward display in the middle */}
                  <div style={{ 
                    margin: '0 0 var(--space-6) 0',
                    textAlign: 'center'
                  }}>
                    {freeVotesPrizeBreak ? (
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '900',
                        color: 'var(--color-white)',
                        textShadow: '0 0 20px var(--color-green)',
                        padding: 'var(--space-6) 0',
                        minHeight: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        +10 VOTES
                      </div>
                    ) : prizeBreakState.isClaimingReward ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--space-5)',
                        padding: 'var(--space-8) 0',
                        minHeight: '120px',
                        justifyContent: 'center'
                      }}>
                        {/* Animated loading bar */}
                        <div style={{
                          width: 'min(500px, 80vw)',
                          height: '16px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: '100px',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, var(--color-green), transparent)',
                            borderRadius: '8px',
                            position: 'absolute',
                            animation: 'loading-sweep 2s ease-in-out infinite'
                          }}></div>
                        </div>
                      </div>
                    ) : prizeBreakState.reward ? (
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '900',
                        color: 'var(--color-white)',
                        textShadow: '0 0 20px var(--color-green)',
                        lineHeight: 1.2,
                        animation: 'reward-reveal 0.8s ease-out',
                        padding: 'var(--space-6) 0',
                        minHeight: '80px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {prizeBreakState.reward.xpAmount > 0 && (
                          <div>+{prizeBreakState.reward.xpAmount} XP</div>
                        )}
                        {prizeBreakState.reward.votesAmount > 0 && (
                          <div>+{prizeBreakState.reward.votesAmount} VOTES</div>
                        )}
                        {prizeBreakState.reward.gugoAmount > 0 && (
                          <div>+{prizeBreakState.reward.gugoAmount} GUGO</div>
                        )}
                        {prizeBreakState.reward.licksAmount > 0 && (
                          <div>+{prizeBreakState.reward.licksAmount} LICKS</div>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '900',
                        color: 'var(--color-white)',
                        textShadow: '0 0 20px var(--color-green)',
                        padding: 'var(--space-6) 0',
                        minHeight: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        AWESOME!
                      </div>
                    )}
                  </div>
                  
                  {/* Manual dismiss button - only show when not loading */}
                  {!prizeBreakState.isClaimingReward && (
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <button
                      onClick={async () => {
                        console.log('🎁 Claiming reward and triggering animations...');
                        try {
                          // Trigger XP animation if XP was awarded
                          if (prizeBreakState.reward?.xpAmount && prizeBreakState.reward.xpAmount > 0) {
                            console.log(`⚡ Triggering XP animation for +${prizeBreakState.reward.xpAmount} XP`);
                            statusBarRef.current?.triggerXpAnimation(prizeBreakState.reward.xpAmount);
                          }
                          
                          // Trigger wallet glow if GUGO reward was received
                          if (prizeBreakState.reward?.gugoAmount && prizeBreakState.reward.gugoAmount > 0) {
                            console.log(`💰 Triggering wallet glow for +${prizeBreakState.reward.gugoAmount} GUGO`);
                            statusBarRef.current?.triggerWalletGlow(prizeBreakState.reward.gugoAmount);
                          }
                          
                          // Trigger Licks animation if Licks reward was received  
                          if (prizeBreakState.reward?.licksAmount && prizeBreakState.reward.licksAmount > 0) {
                            console.log(`🎁 Triggering Licks animation for +${prizeBreakState.reward.licksAmount} Licks`);
                            statusBarRef.current?.triggerLicksAnimation(prizeBreakState.reward.licksAmount);
                          }
                          
                          // Refresh user data to show updated balances
                          setTimeout(() => {
                            statusBarRef.current?.refreshUserData();
                          }, 500);
                          
                          const refillResult = await endPrizeBreak();
                          setFreeVotesPrizeBreak(false); // Reset free votes flag
                          clearRewardState(); // Clear reward state
                          if (refillResult) {
                            console.log(`🔄 Queue refilled during manual dismiss: +${refillResult.added.total} matchups`);
                          }
                          // Only load new session if we don't already have one
                          if (!votingSession) {
                            console.log('📭 No session loaded, fetching new one...');
                            await loadVotingSession();
                          } else {
                            console.log('✅ Session already loaded, keeping current one');
                          }
                        } catch (error) {
                          console.error('❌ Error manually ending prize break:', error);
                          await endPrizeBreak(); // Force end on error
                          setFreeVotesPrizeBreak(false); // Reset free votes flag
                          clearRewardState(); // Clear reward state on error too
                          if (!votingSession) {
                            await loadVotingSession();
                          }
                        }
                      }}
                      style={{
                        marginTop: 'var(--space-4)',
                        padding: 'var(--space-2) var(--space-4)',
                        background: 'var(--color-green)',
                        color: 'var(--color-black)',
                        border: '2px solid var(--color-green)',
                        borderRadius: 'var(--border-radius)',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
                        display: 'inline-block',
                        width: 'auto',
                        maxWidth: 'fit-content',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-green)';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--color-green)';
                        e.currentTarget.style.color = 'var(--color-black)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                                          >
                        Claim Reward
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
      
      {/* Bottom Left Tagline */}
      <div className="bottom-tagline-container" style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        left: 0,
        right: 0,
        zIndex: 5,
        pointerEvents: 'none'
      }}>
        <div className="bottom-tagline-wrapper" style={{
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          paddingLeft: 'var(--space-6)',
          paddingRight: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)'
        }}>
          {/* Large background title at bottom */}
          <h1 className="text-hero" style={{ 
            color: '#aca9a9',
            opacity: '0.10',
            fontSize: 'clamp(3rem, 6vw, 5rem)',
            lineHeight: '1.1',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none'
          }}>
            PROOF OF AESTHETIC<sup style={{ fontSize: '0.6em' }}>™</sup>
          </h1>
          
          {/* Chain Info - Centered */}
          <div className="chain-info" style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: '600',
            color: 'var(--color-grey-500)',
            letterSpacing: '0.05em',
            textAlign: 'center',
            userSelect: 'none',
            pointerEvents: 'auto'
          }}>
            You are viewing NFTs from the <span style={{ color: 'var(--color-green)', fontWeight: '600' }}>{currentChain}</span> blockchain
          </div>
        </div>
      </div>
      
      {/* Purchase Alert Modal */}
      {showPurchaseAlert && (
        <PurchaseAlert
          requiredVotes={requiredVotes}
          onPurchase={handlePurchaseVotes}
          onClose={handleClosePurchaseAlert}
        />
      )}
      
      {/* Session Prompt Modal */}
      <SessionPrompt
        isOpen={showSessionPrompt.isOpen}
        trigger={showSessionPrompt.trigger}
        onCreateSession={handleCreateSession}
        onSkip={handleSkipSession}
        onClose={handleCloseSessionPrompt}
        isCreatingSession={isCreatingSession}
      />
      
      {/* Welcome Popup - Shows on first visit */}
      <WelcomePopup
        isOpen={shouldShowWelcome}
        onCollectionChoice={handleCollectionChoice}
      />
    </div>
  );
}
