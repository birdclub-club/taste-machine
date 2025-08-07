"use client"

import React, { useEffect, useState, useRef } from 'react';
import MatchupCard from '@/components/MatchupCard';
import StatusBar, { StatusBarRef } from '@/components/StatusBar';
import PurchaseAlert from '@/components/PurchaseAlert';
import NetworkStatus from '@/components/NetworkStatus';
import { SessionPrompt } from '@/components/SessionPrompt';
import WelcomePopup from '@/components/WelcomePopup';
import Confetti from '@/components/Confetti';
import CircularMarquee from '@/components/CircularMarquee';
import { useVote } from '@/hooks/useVote';
import { usePrizeBreak } from '@/hooks/usePrizeBreak';
import { useSessionKey } from '@/hooks/useSessionKey';
import { useBatchedVoting } from '@/hooks/useBatchedVoting';
import { useCollectionPreference, getCollectionFilter, CollectionPreference } from '@/hooks/useCollectionPreference';
import { fetchVotingSession } from '@lib/matchup';
import { votingPreloader } from '@lib/preloader';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { VotingSession, VoteSubmission, SliderVote } from '@/types/voting';
import { fixImageUrl, getNextIPFSGateway, ipfsGatewayManager } from '@lib/ipfs-gateway-manager';
import { supabase } from '@lib/supabase';
import { useActivityCounter } from '@/hooks/useActivityCounter';
import { useFavorites } from '@/hooks/useFavorites';

// 🎯 Circular marquee phrases for different prize types
const GUGO_PHRASES = [
  "Let it burn!",
  "Burn. Burn. Burn. Burn.",
  "Oh hell yeah!",
  "Yessssssssssssssssss",
  "Been waiting for this one.",
  "Not a bad day at the Taste Machine",
  "Cha ching!",
  "Should probably tell some people about this.",
  "Winner",
  "Thanks for giving your opinions.",
  "Look at art. Get GUGO",
  "Hope that fire's hot."
];

const NON_GUGO_PHRASES = [
  "This should come in handy.",
  "alright alright alright",
  "Here, put this in your bag.",
  "Not bad at all.",
  "Ok",
  "Gib",
  "For the love of art.",
  "Damn. I like this place.",
  "You could be looking at art and not winning stuff.",
  "sweet sweet rewards"
];

// Random messages for prize break claiming state
const PRIZE_BREAK_MESSAGES = [
  "It's happening again",
  "Prize incoming",
  "This could be good", 
  "Reward chance",
  "?????"
];

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

// 🔢 Format numbers with commas for thousands
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// 🎲 Get random prize break message
const getRandomPrizeMessage = (): string => {
  return PRIZE_BREAK_MESSAGES[Math.floor(Math.random() * PRIZE_BREAK_MESSAGES.length)];
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

// Helper function to get tier colors
const getTierColors = (rewardType: any) => {
  switch (rewardType) {
    case 0: // BASE_XP
      return { primary: '#8B5CF6', glow: '#8B5CF6' }; // Purple
    case 1: // BIG_XP
      return { primary: '#3B82F6', glow: '#3B82F6' }; // Blue
    case 2: // XP_VOTES_10
      return { primary: '#06B6D4', glow: '#06B6D4' }; // Cyan
    case 3: // XP_VOTES_5
      return { primary: '#10B981', glow: '#10B981' }; // Emerald
    case 4: // VOTE_BONUS
      return { primary: '#F59E0B', glow: '#F59E0B' }; // Amber
    case 5: // GUGO_TIER_1
      return { primary: '#EF4444', glow: '#EF4444' }; // Red
    case 6: // GUGO_TIER_2
      return { primary: '#F97316', glow: '#F97316' }; // Orange
    case 7: // GUGO_TIER_3
      return { primary: '#FFD700', glow: '#FFD700' }; // Gold
    case 14: // WELCOME_LICKS
      return { primary: '#EC4899', glow: '#EC4899' }; // Pink
    default:
      return { primary: 'var(--color-green)', glow: 'var(--color-green)' }; // Default green
  }
};

export default function Page() {
  const [votingSession, setVotingSession] = useState<VotingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [matchupsReady, setMatchupsReady] = useState(false);
  const [isSwitchingCollection, setIsSwitchingCollection] = useState(false);
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
  const [totalNftCount, setTotalNftCount] = useState<number | null>(null);
  const [currentSliderValue, setCurrentSliderValue] = useState(0);
  const [showPurchaseAlert, setShowPurchaseAlert] = useState(false);
  const [sliderFireGlow, setSliderFireGlow] = useState(false);
  const [requiredVotes, setRequiredVotes] = useState(5);
  const [imageFailureCount, setImageFailureCount] = useState(0);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [freeVotesPrizeBreak, setFreeVotesPrizeBreak] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showDelayedPrize, setShowDelayedPrize] = useState(false);
  const [showMarquee, setShowMarquee] = useState(false);
  const [showBurningGugo, setShowBurningGugo] = useState(false);
  const [showArtDuck, setShowArtDuck] = useState(false);
  const [prizeBreakMessage, setPrizeBreakMessage] = useState<string>('');
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
  const { processPendingVotes, getBatchStats } = useBatchedVoting();
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
  const { licksToday, isLoading: isLoadingActivity } = useActivityCounter();
  const { addToFavorites } = useFavorites();
  
  // Current blockchain - can be made dynamic in the future
  const currentChain = "Abstract";

  // 🎉 Trigger confetti for GUGO prizes - DEMO MODE: AGGRESSIVE CONFETTI!
  useEffect(() => {
    console.log('🎊 Confetti effect check:', {
      isActive: prizeBreakState.isActive,
      hasReward: !!prizeBreakState.reward,
      gugoAmount: prizeBreakState.reward?.gugoAmount || 0,
      isClaimingReward: prizeBreakState.isClaimingReward,
      shouldTrigger: prizeBreakState.isActive && 
                     prizeBreakState.reward && 
                     prizeBreakState.reward.gugoAmount > 0
    });
    
    // Handle prize notifications based on GUGO amount
    if (prizeBreakState.isActive && prizeBreakState.reward) {
      if (prizeBreakState.reward.gugoAmount > 0) {
        // GUGO prizes: confetti + burning duck
        console.log('🎉 GUGO prize detected! Starting confetti countdown...');
        
        // Immediate confetti for maximum excitement in demo!
        const confettiTimer = setTimeout(() => {
          console.log('🎊 🎊 🎊 DEMO CONFETTI FOR GUGO PRIZE:', prizeBreakState.reward!.gugoAmount, 'GUGO 🎊 🎊 🎊');
          setShowConfetti(true);
        }, 500); // Reduced delay to 0.5 seconds

        // Also trigger the burning GUGO notification - appears behind modal
        console.log('🔥 GUGO burning notification triggered!');
        setShowBurningGugo(true);

        return () => clearTimeout(confettiTimer);
      } else {
        // Non-GUGO prizes: art duck
        console.log('🎨 Non-GUGO prize detected! Triggering art duck notification...');
        setShowArtDuck(true);
      }
    }
  }, [prizeBreakState.isActive, prizeBreakState.reward]);

  // 🎲 Set random prize break message when prize break starts
  useEffect(() => {
    if (prizeBreakState.isActive && prizeBreakState.isClaimingReward) {
      const randomMessage = getRandomPrizeMessage();
      console.log('🎲 Selected random prize message:', randomMessage);
      setPrizeBreakMessage(randomMessage);
    }
  }, [prizeBreakState.isActive, prizeBreakState.isClaimingReward]);

  // 🎯 Handle delayed prize display and circular marquee
  useEffect(() => {
    if (prizeBreakState.isActive && prizeBreakState.reward) {
      // Reset states first
      setShowDelayedPrize(false);
      setShowMarquee(false);
      
      // Show delayed prize after 1 second
      const prizeTimer = setTimeout(() => {
        setShowDelayedPrize(true);
        
        // Show marquee shortly after prize
        const marqueeTimer = setTimeout(() => {
          setShowMarquee(true);
        }, 300);
        
        return () => clearTimeout(marqueeTimer);
      }, 1000);

      return () => clearTimeout(prizeTimer);
    } else {
      // Reset when prize break ends
      setShowDelayedPrize(false);
      setShowMarquee(false);
    }
  }, [prizeBreakState.isActive, prizeBreakState.reward]);

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

  // ⚡ Ultra-fast session loading with dual-queue preloader  
  const loadVotingSession = React.useCallback(async (overridePreference?: CollectionPreference) => {
    try {
      setError(null);
      
      // 🚫 Prevent rapid session changes - add small delay
      if (votingSession) {
        console.log('⏸️  Preventing rapid session change - waiting 500ms...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Use override preference if provided, otherwise use current preference
      const currentPreference = overridePreference !== undefined ? overridePreference : preference;
      
      // Get collection filter based on user preference
      const collectionFilter = getCollectionFilter(currentPreference);
      console.log(`🎯 Collection filter: ${collectionFilter || 'none (show all)'} (preference: ${currentPreference})`);
      
      // Try to get from collection-aware preloader first (instant)
      const preloadedSession = votingPreloader.getNextSession(collectionFilter || undefined);
      updatePreloaderStatus(); // Update status after getting session
      
      if (preloadedSession) {
        setLoading(false);
        setIsSwitchingCollection(false); // Clear collection switching flag
        const session = preloadedSession;
        
        // 🚫 Enhanced debugging for duplicate detection
        const sessionId = session.vote_type === 'slider' 
          ? `${session.vote_type}:${session.nft?.id}` 
          : `${session.vote_type}:${session.nft1?.id}-${session.nft2?.id}`;
        console.log(`⚡ Loading session ${sessionId} from preloader (${collectionFilter || 'mixed'})`);
        
        setVotingSession(session);
        
        // Debug: Log which collections we got
        if (session.vote_type === 'slider') {
          console.log(`⚡ Instant ${session.vote_type} session from preloader (${collectionFilter || 'mixed'}) - Collection: ${session.nft?.collection_name}`);
        } else if (session.vote_type === 'same_coll' || session.vote_type === 'cross_coll') {
          console.log(`⚡ Instant ${session.vote_type} session from preloader (${collectionFilter || 'mixed'}) - Collections: ${session.nft1?.collection_name} vs ${session.nft2?.collection_name}`);
        }
        return;
      }
      
      // Fallback to database if preloader queue empty for this collection
      console.log(`📦 Preloader empty for ${collectionFilter || 'mixed'}, falling back to database...`);
      setLoading(true);
      
      const session = await fetchVotingSession(address, collectionFilter || undefined);
      setVotingSession(session);
      setIsSwitchingCollection(false); // Clear collection switching flag
      
      console.log(`🎯 Loaded ${session.vote_type} voting session from database`);
    } catch (err) {
      console.error('Failed to fetch voting session:', err);
      setError('Failed to load voting session. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [address, preference]);

  // 🎨 Show background immediately on mount
  useEffect(() => {
    console.log('🎨 Loading background and basic UI...');
    // Show background immediately
    setBackgroundLoaded(true);
    setLoading(false); // Stop the initial loading state
    
    // Fetch total NFT count for display
    fetchTotalNftCount();
  }, []);

  const fetchTotalNftCount = async () => {
    try {
      const response = await fetch('/api/check-nft-count');
      const data = await response.json();
      if (data.success) {
        setTotalNftCount(data.nftCount);
      }
    } catch (error) {
      console.error('Failed to fetch total NFT count:', error);
    }
  };

  // 🔥 Initialize preloader on mount (after background is shown)
  useEffect(() => {
    if (!backgroundLoaded) return; // Wait for background to load first
    
    const initializePreloader = async () => {
      console.log('🔥 Initializing collection-aware voting preloader...');
      await votingPreloader.initialize();
      
      // 🚫👻 Check if we need to clear old cached sessions  
      const currentStats = votingPreloader.getSessionStats();
      if (currentStats.stackSize > 0) {
        console.log('🔄 Clearing existing sessions to apply unrevealed NFT filters...');
        await votingPreloader.forceFullReset();
      } else {
        console.log('✅ No existing sessions to clear, proceeding with fresh preload...');
      }
      
      // Start preloading for common collections (reduced amounts for faster initial load)
      console.log('🎯 Starting preload for BEARISH collection...');
      votingPreloader.preloadSessionsForCollection(5, 'BEARISH'); // Reduced from 10 to 5
      
      console.log('🎯 Starting preload for mixed collections...');
      votingPreloader.preloadSessionsForCollection(3, undefined); // Reduced from 5 to 3
      
      setPreloaderReady(true);
      updatePreloaderStatus();
      console.log('✅ Collection-aware preloader ready!');
      
      // Mark matchups as ready for background loading
      setMatchupsReady(true);
    };
    
    initializePreloader();
    
    // Update status every 30 seconds and maintain both queues (less aggressive)
    const statusInterval = setInterval(async () => {
      updatePreloaderStatus();
      
      // Only refill if we have no current session to avoid interrupting user
      if (!votingSession) {
        // 🔄 Check and maintain minimum queue for current collection filter
        const collectionFilter = getCollectionFilter(preference);
        
        if (typeof votingPreloader.ensureMinimumQueue === 'function') {
          votingPreloader.ensureMinimumQueue();
        } else {
          votingPreloader.preloadSessions(3);
        }
      }
    }, 30000); // Reduced frequency from 5s to 30s
    
    return () => clearInterval(statusInterval);
  }, [backgroundLoaded]);

  // 🎯 Load voting session only after welcome popup is handled (or if not needed)
  useEffect(() => {
    if (preloaderReady && matchupsReady && !shouldShowWelcome && !votingSession) {
      console.log('🎯 Loading voting session in background (welcome not needed)...');
      loadVotingSession();
    }
  }, [preloaderReady, matchupsReady, shouldShowWelcome]); // Removed address and loadVotingSession dependencies

  // 🔄 React to collection preference changes with improved switching
  useEffect(() => {
    if (preloaderReady) {
      console.log(`🎯 Collection preference changed to: ${preference || 'null'} - Loading new session...`);
      
      // 🚀 IMPROVED SWITCH: Load session directly with new preference
      console.log(`⚡ Loading session for ${preference} preference...`);
      loadVotingSession(preference);
      
      updatePreloaderStatus();
    }
  }, [preference, preloaderReady]);

  // Clear slider fire glow when new session loads
  useEffect(() => {
    setSliderFireGlow(false);
  }, [votingSession]);



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
      
      // 🌟 Track FIRE votes for favorites
      if (superVote) {
        const favoriteNft = votingSession.vote_type === 'slider' 
          ? votingSession.nft 
          : (winnerId === votingSession.nft1.id ? votingSession.nft1 : votingSession.nft2);
        
        console.log('🔥 Adding FIRE vote to favorites:', favoriteNft.id);
        addToFavorites(
          favoriteNft.id,
          'fire',
          favoriteNft.token_id,
          favoriteNft.collection_name,
          favoriteNft.image,
          favoriteNft.collection_address
        );
      }
      
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
        
        // 📦 SPEED OPTIMIZATION: Process batched votes during prize break
        console.log('📦 Processing batched votes during prize break...');
        processPendingVotes(); // Don't await - let it process in background
        
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
      
      // 🚀 SPEED OPTIMIZATION: Load next session immediately (for batched votes) 
      // For matchup votes, we can start loading the next session right away since vote is batched
      if (result.hash === 'batched-for-processing') {
        console.log('⚡ Starting next session load immediately for batched vote...');
        loadVotingSession(); // Don't await - load in background while animation plays
      } else {
        // For slider votes (immediate processing), wait for completion
        await loadVotingSession();
      }
      
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
    // 🌟 Track maximum slider votes for favorites (100 = max love)
    if (sliderValue === 100 && votingSession?.vote_type === 'slider') {
      const sliderSession = votingSession as SliderVote;
      console.log('💯 Adding max slider vote to favorites:', sliderSession.nft.id);
      addToFavorites(
        sliderSession.nft.id,
        'slider_max',
        sliderSession.nft.token_id,
        sliderSession.nft.collection_name,
        sliderSession.nft.image,
        sliderSession.nft.collection_address
      );
    }
    
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

  // 🎯 Handle welcome acceptance
  const handleWelcomeAccept = async () => {
    console.log('🚀 User accepted welcome - setting up for mixed collections...');
    setCollectionPreference(); // This now just marks welcome as seen
    
    // Load a new session immediately
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
      position: 'relative',
      width: '100%'
    }}>
      
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
                whiteSpace: 'nowrap',
                position: 'relative',
                zIndex: 1
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
              {!backgroundLoaded ? (
                /* Initial background loading - show minimal UI */
                <div className="slide-up" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-6)',
                  background: '#2a2a2a',
                  border: '1px solid #444444',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  color: 'var(--color-white)'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--color-green)',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Loading...</span>
                </div>
              ) : !matchupsReady && !shouldShowWelcome ? (
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
                  <span>Loading matchups from {totalNftCount ? totalNftCount.toLocaleString() : '...'} NFTs</span>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-6)',
                  background: '#2a2a2a',
                  border: '1px solid #444444',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  color: 'var(--color-white)'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--color-green)',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Loading matchups...</span>
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
                  <div className="text-caption" style={{ marginBottom: 'var(--space-6)', fontSize: 'var(--font-size-lg)', color: 'var(--color-black)' }}>
                    Connect your wallet to start voting, earning, and burning.
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
                      border: sliderFireGlow ? '4px solid #ff6b35' : '2px solid var(--color-grey-200)',
                      borderRadius: 'var(--border-radius-lg)',
                      overflow: 'hidden',
                      boxShadow: sliderFireGlow ? 
                        '0 0 40px rgba(255, 107, 53, 0.9), 0 0 80px rgba(255, 140, 0, 0.6), 0 0 120px rgba(255, 165, 0, 0.4)' :
                        '0 8px 24px rgba(0,0,0,0.12)',
                      transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out, border 0.3s ease-out',
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
                              
                              // Trigger fire glow effect
                              setSliderFireGlow(true);
                              
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

            {/* Burning GUGO Notification - appears behind modal, above VS sign */}
            {showBurningGugo && (
              <div 
                style={{
                  position: 'fixed',
                  top: '30%', // Moved up more
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 500, // Behind modal (1000) but above content
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)', // Increased gap for two-line text
                  animation: 'slide-up 0.6s ease-out'
                }}
              >
                {/* Close X button - moved outside the content area */}
                <button
                  onClick={() => setShowBurningGugo(false)}
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '32px',
                    height: '32px',
                    background: 'var(--color-black)',
                    color: 'var(--color-white)',
                    border: 'none',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-grey-700)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-black)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  ×
                </button>

                {/* Text above image - two lines */}
                <div style={{
                  color: 'var(--color-white)',
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: '700',
                  textAlign: 'center',
                  textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 15px rgba(255, 107, 53, 0.4)',
                  letterSpacing: '0.02em',
                  animation: 'text-glow-subtle 3s ease-in-out infinite',
                  lineHeight: '1.3'
                }}>
                  We're burning<br />GUGO fam!
                </div>

                {/* Duck image with toned down fiery glow */}
                <div style={{
                  position: 'relative',
                  filter: 'drop-shadow(0 0 20px rgba(255, 107, 53, 0.6)) drop-shadow(0 0 40px rgba(255, 140, 0, 0.4)) drop-shadow(0 0 60px rgba(255, 165, 0, 0.2))',
                  animation: 'fire-pulse-subtle 3s ease-in-out infinite'
                }}>
                  <img
                    src="/GUGO-Duck-Burning-Bags.png"
                    alt="Burning GUGO Duck"
                    style={{
                      width: '160px', // Made a bit bigger
                      height: 'auto',
                      maxWidth: '70vw' // Increased mobile size slightly
                    }}
                  />
                </div>
              </div>
            )}

            {/* Art Duck Notification - for non-GUGO prizes */}
            {showArtDuck && (
              <div 
                style={{
                  position: 'fixed',
                  top: '30%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 500, // Behind modal (1000) but above content
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  animation: 'slide-up 0.6s ease-out'
                }}
              >
                {/* Close X button - moved outside the content area */}
                <button
                  onClick={() => setShowArtDuck(false)}
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '32px',
                    height: '32px',
                    background: 'var(--color-black)',
                    color: 'var(--color-white)',
                    border: 'none',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-grey-700)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-black)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  ×
                </button>

                {/* Text above image - two lines */}
                <div style={{
                  color: 'var(--color-white)',
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: '700',
                  textAlign: 'center',
                  textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 15px rgba(255, 255, 255, 0.4)',
                  letterSpacing: '0.02em',
                  animation: 'text-glow-white 3s ease-in-out infinite',
                  lineHeight: '1.3'
                }}>
                  I'm here for the art.
                </div>

                {/* Duck image with white glow */}
                <div style={{
                  position: 'relative',
                  filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 60px rgba(255, 255, 255, 0.2))',
                  animation: 'white-pulse 3s ease-in-out infinite'
                }}>
                  <img
                    src="/GUGO-Duck-Holding-NFTs.png"
                    alt="Art Duck with NFTs"
                    style={{
                      width: '160px',
                      height: 'auto',
                      maxWidth: '70vw'
                    }}
                  />
                </div>
              </div>
            )}

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
                  cursor: 'pointer',
                  overflow: 'visible'
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
                    border: `2px solid ${
                      freeVotesPrizeBreak 
                        ? 'var(--color-green)' 
                        : prizeBreakState.reward 
                          ? getTierColors(prizeBreakState.reward.rewardType).primary
                          : 'var(--color-green)'
                    }`,
                    borderRadius: 'var(--border-radius-lg)',
                    padding: 'var(--space-12)',
                    textAlign: 'center',
                    maxWidth: '1000px',
                    width: '90vw',
                    margin: 'var(--space-4)',
                    cursor: 'default',
                    boxShadow: `0 30px 60px rgba(0, 0, 0, 0.9), 0 0 40px ${
                      freeVotesPrizeBreak 
                        ? 'rgba(0, 255, 0, 0.2)' 
                        : prizeBreakState.reward 
                          ? `${getTierColors(prizeBreakState.reward.rewardType).glow}40`
                          : 'rgba(0, 255, 0, 0.2)'
                    }`,
                    backdropFilter: 'blur(10px)',
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'visible',
                    position: 'relative'
                  }}
                  onClick={(e) => e.stopPropagation()} // Prevent overlay dismiss when clicking modal content
                >
                  {/* Duck shadow on left side */}
                  <img 
                    src="/Duck-Face-Shadows-1.png" 
                    alt="Duck Shadow" 
                    style={{
                      position: 'absolute',
                      left: '25%',
                      top: 'calc(50% + 120px)',
                      transform: 'translate(-50%, -50%)',
                      width: '100px',
                      height: 'auto',
                      opacity: 0.5,
                      zIndex: -1,
                      pointerEvents: 'none'
                    }}
                  />
                  
                  {/* Duck king shadow on right side */}
                  <img 
                    src="/Duck-head-king-shadow.png" 
                    alt="Duck King Shadow" 
                    style={{
                      position: 'absolute',
                      right: '25%',
                      top: 'calc(50% + 110px)', // Moved up 10px more
                      transform: 'translate(50%, -50%)',
                      width: '120px',
                      height: 'auto',
                      opacity: 0.5,
                      zIndex: -1,
                      pointerEvents: 'none'
                    }}
                  />
                  
                  {/* Full-width Linear Marquee */}
                  {prizeBreakState.reward && (
                    <CircularMarquee
                      phrases={prizeBreakState.reward.gugoAmount > 0 ? GUGO_PHRASES : NON_GUGO_PHRASES}
                      isVisible={showMarquee}
                      type="linear"
                      fontSize="0.9rem"
                      color="var(--color-grey-400)"
                      duration={20}
                    />
                  )}
                  
                  {/* Top Section - Header */}
                  <div style={{ flex: '0 0 auto', overflow: 'visible' }}>
                    {/* GUGO Duck Branding Image */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: 'var(--space-4)'
                    }}>
                      <img 
                        src="/GUGO-Duck-with-bag.png" 
                        alt="GUGO Duck with Bag" 
                        style={{
                          width: '140px',
                          height: 'auto',
                          filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.4))'
                        }}
                      />
                    </div>

                    {/* Main title - context-aware with circular marquee */}
                    <div style={{ position: 'relative', margin: '0 0 var(--space-2) 0', overflow: 'visible' }}>
                      <h1 style={{ 
                        color: 'var(--color-green)', 
                        margin: '0',
                        fontSize: '2rem',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        textShadow: '0 0 20px var(--color-green)'
                      }}>
                        {freeVotesPrizeBreak ? (
                          'Congrats!'
                        ) : prizeBreakState.isClaimingReward ? (
                          prizeBreakMessage || 'It\'s Happening'
                        ) : (
                          // Show "YOU WON!" only for GUGO awards, "Congrats!" for others
                          (prizeBreakState.reward?.gugoAmount || 0) > 0 ? 'YOU WON!' : 'Congrats!'
                        )}
                      </h1>
                      
                    </div>


                  </div>

                  {/* Middle Section - Main Content */}
                  <div style={{ 
                    flex: '1 1 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minHeight: '200px'
                  }}>
                    {freeVotesPrizeBreak ? (
                      <div style={{
                        fontSize: '3rem',
                        fontWeight: '900',
                        color: 'var(--color-white)',
                        textShadow: '0 0 20px var(--color-green)',
                        padding: 'var(--space-6) 0',
                        minHeight: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span>+10</span>
                          <img 
                            src="/lick-icon.png" 
                            alt="Licks" 
                            style={{ 
                              width: '90px', // 1.5x from 60px
                              height: '90px', // 1.5x from 60px
                              filter: 'brightness(0) saturate(100%) invert(64%) sepia(85%) saturate(2298%) hue-rotate(90deg) brightness(119%) contrast(91%) drop-shadow(0 0 20px var(--color-green))',
                              marginTop: '10px'
                            }} 
                          />
                        </div>
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
                        {/* GUGO Duck Stealing Art Image */}
                        <div style={{
                          marginBottom: 'var(--space-4)'
                        }}>
                          <img 
                            src="/GUGO-Duck-Stealing-Art.png" 
                            alt="GUGO Duck Stealing Art" 
                            style={{
                              width: '100px',
                              height: 'auto',
                              filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.4))',
                              animation: 'pulse 2s ease-in-out infinite'
                            }}
                          />
                        </div>
                        
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
                      (() => {
                        const tierColors = getTierColors(prizeBreakState.reward.rewardType);
                        return (
                          <div style={{
                            fontSize: '3rem',
                            fontWeight: '900',
                            color: tierColors.primary,
                            textShadow: `0 0 30px ${tierColors.glow}`,
                            lineHeight: 1.2,
                            animation: showDelayedPrize ? 'reward-reveal 0.8s ease-out' : 'none',
                            padding: 'var(--space-6) 0',
                            minHeight: '80px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--space-2)',
                            opacity: showDelayedPrize ? 1 : 0,
                            transform: showDelayedPrize ? 'translateY(0)' : 'translateY(20px)',
                            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
                          }}>
                            {showDelayedPrize && (
                              <>
                                {prizeBreakState.reward.xpAmount > 0 && (
                                  <div>+{formatNumber(prizeBreakState.reward.xpAmount)} XP</div>
                                )}
                                {prizeBreakState.reward.votesAmount > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <span>+{formatNumber(prizeBreakState.reward.votesAmount)}</span>
                                    <img 
                                      src="/lick-icon.png" 
                                      alt="Licks" 
                                      style={{ 
                                        width: '60px', // 1.5x from 40px
                                        height: '60px', // 1.5x from 40px
                                        filter: (() => {
                                          // Convert tier color to hue-rotate value
                                          const getHueRotateForColor = (colorVar: string) => {
                                            // Handle hex colors and CSS color names
                                            if (colorVar.includes('green') || colorVar === '#10B981') return 'hue-rotate(90deg)'; // Green/Emerald
                                            if (colorVar.includes('orange') || colorVar.includes('yellow') || colorVar === '#F59E0B' || colorVar === '#F97316' || colorVar === '#FFD700') return 'hue-rotate(45deg)'; // Orange/Amber/Gold
                                            if (colorVar.includes('blue') || colorVar.includes('cyan') || colorVar === '#3B82F6' || colorVar === '#06B6D4') return 'hue-rotate(180deg)'; // Blue/Cyan
                                            if (colorVar.includes('purple') || colorVar.includes('magenta') || colorVar === '#8B5CF6' || colorVar === '#EC4899') return 'hue-rotate(270deg)'; // Purple/Pink
                                            if (colorVar.includes('red') || colorVar === '#EF4444') return 'hue-rotate(0deg)'; // Red
                                            return 'hue-rotate(45deg)'; // Default to orange for Licks
                                          };
                                          const hueRotate = getHueRotateForColor(tierColors.primary);
                                          return `brightness(0) saturate(100%) invert(64%) sepia(85%) saturate(2298%) ${hueRotate} brightness(119%) contrast(91%) drop-shadow(0 0 15px ${tierColors.glow})`;
                                        })(),
                                        marginTop: '10px'
                                      }} 
                                    />
                                  </div>
                                )}
                                {prizeBreakState.reward.gugoAmount > 0 && (
                                  <div>+{formatNumber(prizeBreakState.reward.gugoAmount)} GUGO</div>
                                )}
                                {prizeBreakState.reward.licksAmount > 0 && (
                                  <div>+{formatNumber(prizeBreakState.reward.licksAmount)} LICKS</div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()
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
                  
                  {/* Exit Button - "See more art" */}
                  <div style={{ 
                    flex: '0 0 auto',
                    display: 'flex',
                    justifyContent: 'center',
                    paddingTop: 'var(--space-4)'
                  }}>
                    <button
                      onClick={async () => {
                        console.log('🎨 User wants to see more art - exiting prize break...');
                        try {
                          // Trigger animations if rewards were received
                          if (prizeBreakState.reward?.xpAmount && prizeBreakState.reward.xpAmount > 0) {
                            console.log(`⚡ Triggering XP animation for +${prizeBreakState.reward.xpAmount} XP`);
                            statusBarRef.current?.triggerXpAnimation(prizeBreakState.reward.xpAmount);
                          }
                          
                          if (prizeBreakState.reward?.gugoAmount && prizeBreakState.reward.gugoAmount > 0) {
                            console.log(`💰 Triggering wallet glow for +${prizeBreakState.reward.gugoAmount} GUGO`);
                            statusBarRef.current?.triggerWalletGlow(prizeBreakState.reward.gugoAmount);
                          }
                          
                          if (prizeBreakState.reward?.licksAmount && prizeBreakState.reward.licksAmount > 0) {
                            console.log(`🎁 Triggering Licks animation for +${prizeBreakState.reward.licksAmount} Licks`);
                            statusBarRef.current?.triggerLicksAnimation(prizeBreakState.reward.licksAmount);
                          }
                          
                          // Refresh user data
                          setTimeout(() => {
                            statusBarRef.current?.refreshUserData();
                          }, 500);
                          
                          const refillResult = await endPrizeBreak();
                          setFreeVotesPrizeBreak(false);
                          clearRewardState();
                          if (refillResult) {
                            console.log(`🔄 Queue refilled: +${refillResult.added.total} matchups`);
                          }
                          
                          // Load new session
                          if (!votingSession) {
                            console.log('📭 Loading new voting session...');
                            await loadVotingSession();
                          } else {
                            console.log('✅ Session already loaded');
                          }
                        } catch (error) {
                          console.error('❌ Error exiting prize break:', error);
                          await endPrizeBreak();
                          setFreeVotesPrizeBreak(false);
                          clearRewardState();
                          if (!votingSession) {
                            await loadVotingSession();
                          }
                        }
                      }}
                      style={{
                        padding: 'var(--space-3) var(--space-6)',
                        background: 'var(--color-grey-300)',
                        color: 'var(--color-black)',
                        border: '2px solid var(--color-grey-300)',
                        borderRadius: 'var(--border-radius)',
                        fontSize: 'var(--font-size-base)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        boxShadow: '0 4px 12px rgba(156, 163, 175, 0.3)',
                        minWidth: '160px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-grey-300)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(156, 163, 175, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--color-grey-300)';
                        e.currentTarget.style.color = 'var(--color-black)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(156, 163, 175, 0.3)';
                      }}
                    >
                      See more art
                    </button>
                  </div>

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
        zIndex: 1,
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
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-4)',
            flexWrap: 'wrap'
          }}>
            <span>You are viewing NFTs from the <span style={{ color: 'var(--color-green)', fontWeight: '600' }}>{currentChain}</span> blockchain</span>
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--space-2)',
              opacity: 0.8 
            }}>
              Taste Activity Today: 
              <span style={{ 
                color: 'var(--color-green)', 
                fontWeight: '600'
              }}>
                {isLoadingActivity ? '...' : licksToday.toLocaleString()}
              </span>
              <img 
                src="/lick-icon.png" 
                alt="Licks" 
                style={{ 
                  width: '30px', 
                  height: '30px',
                  flexShrink: 0,
                  filter: 'brightness(0) saturate(100%) invert(50%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(75%) contrast(100%)',
                  opacity: 0.8,
                  marginTop: '6px'
                }} 
              />
            </span>
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
        onAccept={handleWelcomeAccept}
      />

      {/* 🎉 Confetti for GUGO Prizes */}
      {showConfetti && (
        <Confetti
          onComplete={() => {
            console.log('🎊 Confetti animation completed, cleaning up...');
            setShowConfetti(false);
          }}
        />
      )}


    </div>
  );
}