"use client"

import React, { useEffect, useState, useRef } from 'react';
import MatchupCard from '@/components/MatchupCard';
import StatusBar, { StatusBarRef } from '@/components/StatusBar';
import PurchaseAlert from '@/components/PurchaseAlert';
import { SimplifiedInsufficientVotesAlert } from '@/components/SimplifiedInsufficientVotesAlert';
import NetworkStatus from '@/components/NetworkStatus';
import { SessionPrompt } from '@/components/SessionPrompt';

import Confetti from '@/components/Confetti';
import CircularMarquee from '@/components/CircularMarquee';
import PrizeTrailingImages from '@/components/PrizeTrailingImages';
import { useVote } from '@/hooks/useVote';
import { usePrizeBreak } from '@/hooks/usePrizeBreak';
import { useSessionKey } from '@/hooks/useSessionKey';
import { useBatchedVoting } from '@/hooks/useBatchedVoting';
import { useCollectionPreference, getCollectionFilter, CollectionPreference } from '@/hooks/useCollectionPreference';
import { fetchVotingSession } from '@lib/matchup';
import { votingPreloader } from '@lib/preloader';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useMusic } from '@/contexts/MusicContext';
import AudioControls from '@/components/AudioControls';
import type { VotingSession, VoteSubmission, SliderVote, MatchupPair } from '@/types/voting';
import { fixImageUrl, getNextIPFSGateway, ipfsGatewayManager } from '@lib/ipfs-gateway-manager';
import { supabase } from '@lib/supabase';
import { useActivityCounter } from '@/hooks/useActivityCounter';
import { useFavorites } from '@/hooks/useFavorites';
import OnboardingTour from '@/components/OnboardingTour';

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
  const router = useRouter();
  const [votingSession, setVotingSession] = useState<VotingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  
  const [shouldRedirectToLanding, setShouldRedirectToLanding] = useState(false);
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);
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
  const [sliderVoteAnimation, setSliderVoteAnimation] = useState<{
    isAnimating: boolean;
    isFireVote: boolean;
  }>({ isAnimating: false, isFireVote: false });
  const [showPurchaseAlert, setShowPurchaseAlert] = useState(false);
  const [sliderFireGlow, setSliderFireGlow] = useState(false);
  const [requiredVotes, setRequiredVotes] = useState(5);
  const [imageFailureCount, setImageFailureCount] = useState(0);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [freeVotesPrizeBreak, setFreeVotesPrizeBreak] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showDelayedPrize, setShowDelayedPrize] = useState(false);
  const [showMarquee, setShowMarquee] = useState(false);
  // Removed showBurningGugo and showArtDuck - images now embedded in prize modal
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
    setCollectionPreference,
    shouldShowTour,
    markTourAsSeen
  } = useCollectionPreference();
  const statusBarRef = useRef<StatusBarRef>(null);
  const { licksToday, isLoading: isLoadingActivity } = useActivityCounter();
  const { addToFavorites } = useFavorites();
  const { user } = useAuth(); // Get user data for XP
  const { startMusicOnFirstVote } = useMusic(); // Background music system
  const [showContent, setShowContent] = useState(false);
  
  // Current blockchain - can be made dynamic in the future
  const currentChain = "Abstract";

  // 🎨 Check for redirect on client side only
  useEffect(() => {
    const hasVisitedLanding = sessionStorage.getItem('visited-landing');
    if (!hasVisitedLanding) {
      console.log('🎨 Redirecting to landing page for color palette selection...');
      setShouldRedirectToLanding(true);
      router.push('/landing');
      return;
    }
    
    console.log('✅ User came from landing page, continuing to main app...');
    setIsCheckingRedirect(false);

    // Clear the session storage flag only on page unload (refresh, close, navigate away)
    // This ensures users always see the landing page on fresh visits
    const clearLandingFlag = () => {
      sessionStorage.removeItem('visited-landing');
      console.log('🎨 Cleared landing flag - next visit will show landing page');
    };

    // Only clear flag on actual page unload, not component unmount
    window.addEventListener('beforeunload', clearLandingFlag);

    return () => {
      window.removeEventListener('beforeunload', clearLandingFlag);
      // Don't clear the flag on component unmount - only on page unload
    };
  }, [router]);

  // 🎬 Handle main page entrance animation
  useEffect(() => {
    const hasVisitedLanding = sessionStorage.getItem('visited-landing');
    if (hasVisitedLanding) {
      // Start showing content immediately
      setShowContent(true);
      
      // Trigger animations manually after a brief delay
      setTimeout(() => {
        // All main elements slide in together from right
        const elementsToSlide = [
          '.proof-of-element',
          '.aest-hetic-element', 
          '.powered-by-element',
          '.loading-popup-element'
        ];

        elementsToSlide.forEach(selector => {
          const element = document.querySelector(selector) as HTMLElement;
          if (element) {
            element.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            element.style.transform = 'translateX(0)';
          }
        });

        // Status bar slides down after main elements with a longer delay and slower easing
        setTimeout(() => {
          const statusElement = document.querySelector('.status-bar-element') as HTMLElement;
          if (statusElement) {
            statusElement.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            statusElement.style.transform = 'translateY(0)';
          }
        }, 2000); // Even longer delay for status bar to ease down gracefully

      }, 50); // Minimal delay to ensure elements are rendered
    }
  }, []);

  // 🎉 Trigger confetti for GUGO prizes - DEMO MODE: AGGRESSIVE CONFETTI!
  useEffect(() => {
    console.log('🎊 Confetti effect check:', {
      isActive: prizeBreakState.isActive,
      hasReward: !!prizeBreakState.reward,
      gugoAmount: prizeBreakState.reward?.gugoAmount || 0,
      xpAmount: prizeBreakState.reward?.xpAmount || 0,
      licksAmount: prizeBreakState.reward?.licksAmount || 0,
      votesAmount: prizeBreakState.reward?.votesAmount || 0,
      isClaimingReward: prizeBreakState.isClaimingReward,
      shouldTrigger: prizeBreakState.isActive && 
                     prizeBreakState.reward && 
                     prizeBreakState.reward.gugoAmount > 0,
      statusBarRefExists: !!statusBarRef.current
    });
    
    // Handle prize notifications - can have multiple reward types!
    if (prizeBreakState.isActive && prizeBreakState.reward) {
      console.log('🎁 Prize break reward detected:', {
        gugoAmount: prizeBreakState.reward.gugoAmount,
        xpAmount: prizeBreakState.reward.xpAmount,
        licksAmount: prizeBreakState.reward.licksAmount,
        votesAmount: prizeBreakState.reward.votesAmount
      });

      const cleanupFunctions: (() => void)[] = [];

      // 💰 Handle GUGO rewards (confetti + wallet glow)
      if (prizeBreakState.reward.gugoAmount > 0) {
        console.log('🎉 GUGO prize detected! Starting confetti countdown...');
        
        const confettiTimer = setTimeout(() => {
          console.log('🎊 🎊 🎊 DEMO CONFETTI FOR GUGO PRIZE:', prizeBreakState.reward!.gugoAmount, 'GUGO 🎊 🎊 🎊');
          setShowConfetti(true);
          
          // 💰 Trigger wallet glow animation for GUGO wins
          console.log('💰 Triggering wallet glow animation for', prizeBreakState.reward!.gugoAmount, 'GUGO');
          statusBarRef.current?.triggerWalletGlow(prizeBreakState.reward!.gugoAmount);
        }, 500);

        cleanupFunctions.push(() => clearTimeout(confettiTimer));
      }

      // ⚡ Handle XP and Licks rewards (floating animations)
      if (prizeBreakState.reward.xpAmount > 0 || prizeBreakState.reward.licksAmount > 0 || prizeBreakState.reward.votesAmount > 0) {
        console.log('🎨 XP/Licks prize detected - setting up animations:', {
          xpAmount: prizeBreakState.reward.xpAmount,
          licksAmount: prizeBreakState.reward.licksAmount,
          votesAmount: prizeBreakState.reward.votesAmount
        });
        
        const animationTimer = setTimeout(() => {
          // ⚡ Trigger XP animation if XP reward
          if (prizeBreakState.reward!.xpAmount > 0) {
            console.log('⚡ Triggering XP animation for', prizeBreakState.reward!.xpAmount, 'XP');
            statusBarRef.current?.triggerXpAnimation(prizeBreakState.reward!.xpAmount);
          }
          
          // 🎫 Trigger Licks animation if Licks/votes reward
          if (prizeBreakState.reward!.licksAmount > 0) {
            console.log('🎫 Triggering Licks animation for', prizeBreakState.reward!.licksAmount, 'Licks');
            statusBarRef.current?.triggerLicksAnimation(prizeBreakState.reward!.licksAmount);
          } else if (prizeBreakState.reward!.votesAmount > 0) {
            console.log('🎫 Triggering Licks animation for', prizeBreakState.reward!.votesAmount, 'Votes');
            statusBarRef.current?.triggerLicksAnimation(prizeBreakState.reward!.votesAmount);
          }
        }, 300); // Slight delay for visual effect

        cleanupFunctions.push(() => clearTimeout(animationTimer));
      }

      // Return cleanup function that clears all timers
      return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
      };
      // Note: Duck images now embedded in prize modal instead of separate popups
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
      
      // 🚀 INSTANT: No delay needed with preloaded sessions (17 ready)
      // Removed 500ms delay for instant transitions
      
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

  // 🚀 Start preloader with safety checks for instant sessions
  useEffect(() => {
    const startEarlyPreloader = async () => {
      try {
        console.log('🚀 Starting early preloader for instant sessions...');
        
        // Initialize recent pairs service
        const { recentPairsService } = await import('../lib/recent-pairs-service');
        const stats = recentPairsService.getStats();
        console.log(`🔒 Recent pairs service initialized early: ${stats.trackedPairs}/${stats.maxPairs} pairs`);
        
        // Preloader initializes automatically when getInstance() is called
        
        // Start conservative preloading for instant access (reduced to avoid early errors)
        console.log('⚡ Starting conservative preload for instant access...');
        votingPreloader.preloadSessionsForCollection(3, 'BEARISH'); // Reduced sessions to avoid overload
        votingPreloader.preloadSessionsForCollection(2, undefined); // Reduced mixed collections
        
        setPreloaderReady(true);
        console.log('🎯 Early preloader ready - sessions loading in background!');
      } catch (error) {
        console.warn('⚠️ Early preloader initialization failed, will retry later:', error);
        // Don't fail completely - let the main preloader handle it
        setTimeout(() => {
          console.log('🔄 Retrying preloader initialization...');
          setPreloaderReady(true); // Allow main flow to continue
        }, 2000);
      }
    };
    
    startEarlyPreloader();
  }, []);

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

  // 🔄 Setup ongoing preloader maintenance (after background loads)
  useEffect(() => {
    if (!backgroundLoaded || !preloaderReady) return; // Wait for background and early preloader
    
    const maintainPreloader = async () => {
      console.log('🔄 Setting up preloader maintenance...');
      
      updatePreloaderStatus();
      
      // Mark matchups as ready for background loading
      setMatchupsReady(true);
      console.log('✅ Preloader maintenance ready!');
    };
    
    maintainPreloader();
    
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
  }, [backgroundLoaded, preloaderReady]);

  // 🎯 Load voting session when ready
  useEffect(() => {
    if (preloaderReady && matchupsReady && !votingSession) {
      console.log('🎯 Loading voting session in background...');
      loadVotingSession();
    }
  }, [preloaderReady, matchupsReady]); // Removed address and loadVotingSession dependencies

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
    setSliderVoteAnimation({ isAnimating: false, isFireVote: false });
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
        voteData.slider_value = Math.round(parseFloat(winnerId)); // Convert and round slider value to integer
      } else {
        // For matchup votes
        voteData.nft_a_id = votingSession.nft1.id;
        voteData.nft_b_id = votingSession.nft2.id;
        voteData.winner_id = winnerId;
      }

      // 🎵 Start background music on first vote (if not already started)
      startMusicOnFirstVote();

      const result = await submitVote(voteData, address, userVoteCount, user?.xp || 0);
      
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
        console.log('🎬 Starting prize break UI modal...');
        
        // Always show the prize break modal - button text will handle session creation
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

  // 🚫 Handle NO votes - cast losing votes for both NFTs and proceed to next matchup  
  const handleNoVote = async () => {
    if (!votingSession || votingSession.vote_type === 'slider') return;
    
    // Require wallet connection
    if (!isConnected || !address) {
      setError('Please connect your wallet to vote.');
      return;
    }
    
    try {
      console.log('🚫 Processing NO vote - both NFTs receive negative aesthetic feedback');
      
      // Cast to MatchupPair since we know it's not a slider
      const matchupSession = votingSession as MatchupPair;
      
      // Create NO vote submission data
      const voteData: VoteSubmission = {
        vote_type: matchupSession.vote_type, // Use the actual vote type (same_coll or cross_coll)
        nft_a_id: matchupSession.nft1.id,
        nft_b_id: matchupSession.nft2.id,
        super_vote: false,
        engagement_data: {
          queueId: matchupSession.queueId,
          super_vote: false,
          no_vote: true, // Mark as NO vote
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      // 🎵 Start background music on first vote (if not already started)
      startMusicOnFirstVote();

      const result = await submitVote(voteData, address, userVoteCount, user?.xp || 0);
      
      // Check for insufficient votes
      if (result.insufficientVotes) {
        console.log(`💳 Insufficient votes for NO vote: need ${result.requiredVotes || 1}`);
        setRequiredVotes(result.requiredVotes || 1);
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
        console.log('🎬 Starting prize break UI modal...');
        
        // Always show the prize break modal - button text will handle session creation
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
        }, 3000); // 3 second minimum display time
        
        return; // Exit early for prize break
      }
      
      // For regular NO votes, move to next matchup immediately
      console.log('🔄 NO vote successful, loading next matchup...');
      await loadVotingSession();
      
    } catch (error) {
      console.error('❌ NO vote failed:', error);
      if (typeof error === 'string' && error.includes('wallet')) {
        setError('Please connect your wallet to vote.');
      } else {
        setError('NO vote failed. Please try again.');
      }
    }
  };

  const handleSliderVote = async (sliderValue: number, superVote: boolean = false) => {
    // 1. Instant glow feedback (white for regular, fire for super votes)
    setSliderVoteAnimation({ isAnimating: true, isFireVote: superVote });
    
    // 🌟 Track maximum slider votes for favorites (10 = max love, slider range is 0.1-10)
    if (sliderValue === 10 && votingSession?.vote_type === 'slider') {
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
    
    // 2. Call the vote function
    await handleVote(sliderValue.toString(), superVote);
    
    // 3. Animation will be cleared when new session loads
  };

  // Removed handleConnectWallet - now using direct RainbowKit integration

  // 💳 Handle vote purchase - open the Licks purchase modal
  const handlePurchaseVotes = () => {
    console.log('💳 Opening Licks purchase modal...');
    setShowPurchaseAlert(false);
    // Open the purchase modal via StatusBar ref
    statusBarRef.current?.openPurchaseModal();
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

  // 🚫 Prevent flash by not rendering if redirecting to landing or still checking
  if (shouldRedirectToLanding || isCheckingRedirect) {
    return null;
  }

  // Always show the normal dark gaming interface
  // Wallet connection is handled in StatusBar with RainbowKit

  const renderVotingContent = () => {
    if (!backgroundLoaded) {
  return (
                <div className="slide-up" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-6)',
          background: 'var(--dynamic-bg-color)',
          border: '1px solid var(--dynamic-text-color)',
                  borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow)',
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
      );
    }

    if (!matchupsReady) {
      return (
                <div className="loading-popup-element" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-6)',
          background: 'var(--dynamic-bg-color)',
          border: '1px solid var(--dynamic-text-color)',
                  borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow)',
          color: 'var(--dynamic-text-color)',
          transform: showContent ? 'translateX(100vw)' : 'translateX(0)',
          transition: 'none'
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
      );
    }

    if (maintenanceMode) {
      return (
                <div className="slide-up" style={{
                  padding: 'var(--space-8)',
          background: 'var(--dynamic-bg-color)',
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
                    We&apos;re currently performing routine maintenance to improve your experience.
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
      );
    }

    if (error) {
      return (
                <div className="slide-up" style={{
                  padding: 'var(--space-6)',
          background: 'var(--dynamic-bg-color)',
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
      );
    }

    if (!votingSession) {
      return (
                <div className="slide-up" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-6)',
          background: 'var(--dynamic-bg-color)',
          border: '1px solid var(--dynamic-text-color)',
                  borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow)',
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
      );
    }

    if (!isConnected) {
      return (
                <div className="slide-up" style={{
                  padding: 'var(--space-8)',
          background: 'var(--dynamic-bg-color)',
                  borderRadius: 'var(--border-radius-lg)',
                  boxShadow: 'var(--shadow)',
                  textAlign: 'center',
                  maxWidth: '500px'
                }}>
                  <div className="text-caption" style={{ marginBottom: 'var(--space-6)', fontSize: 'var(--font-size-lg)', color: 'var(--color-black)' }}>
                    Connect your wallet to start voting, earning, and burning.
                  </div>
                  
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
      );
    }

    // Voting session content
    if (votingSession.vote_type === 'slider') {
      const sliderSession = votingSession as SliderVote;
      const nft = sliderSession.nft;
      
                  return (
        <>
          {/* Full-Screen Mouse Tracking Overlay */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 5,
              cursor: 'crosshair',
              pointerEvents: isVoting ? 'none' : 'auto'
            }}
            onMouseMove={(e) => {
              if (isVoting) return;
              
              // Find the NFT image element to get its bounds
              const nftImage = document.querySelector('.slider-nft-card img') as HTMLElement;
              if (!nftImage) return;
              
              const imageRect = nftImage.getBoundingClientRect();
              const mouseY = e.clientY;
              
              // Calculate rating based on image position
              let rating: number;
              
              if (mouseY <= imageRect.top) {
                // Above image = 10
                rating = 10;
              } else if (mouseY >= imageRect.bottom) {
                // Below image = 0
                rating = 0;
              } else {
                // Within image bounds = 1-9 based on position
                const relativeY = mouseY - imageRect.top;
                const imageHeight = imageRect.height;
                const percentage = Math.max(0, Math.min(1, 1 - (relativeY / imageHeight)));
                rating = Math.round(percentage * 10);
                
                // Ensure we don't get 0 within the image (minimum 1)
                if (rating === 0) rating = 1;
              }
              
              setCurrentSliderValue(rating);
            }}
            onClick={(e) => {
              if (isVoting) return;
              e.preventDefault();
              handleSliderVote(currentSliderValue, currentSliderValue === 10);
            }}
          />
          
                  <div className="slide-up" style={{
                    display: 'flex',
                    alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-8)',
                    width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
            position: 'relative',
            zIndex: 10,
            pointerEvents: 'none',
            transform: 'translateX(30px)'
        }}>
          {/* Single NFT Card - Exact Matchup Style */}
          <div className="slider-nft-card nft-card" style={{
            flex: 1,
            maxWidth: '500px',
            position: 'relative',
              opacity: 1,
              pointerEvents: 'none'
          }}>
                    <div style={{
                      background: 'var(--color-white)',
                border: sliderVoteAnimation.isAnimating && sliderVoteAnimation.isFireVote
                ? '4px solid #ff6b35' 
                  : sliderVoteAnimation.isAnimating && !sliderVoteAnimation.isFireVote
                  ? '4px solid white'
                  : currentSliderValue === 10 
                  ? '4px solid #ff6b35' 
                  : `2px solid var(--color-grey-200)`,
                      borderRadius: 'var(--border-radius-lg)',
                      overflow: 'hidden',
                boxShadow: sliderVoteAnimation.isAnimating && sliderVoteAnimation.isFireVote
                  ? '0 0 40px rgba(255, 107, 53, 0.9), 0 0 80px rgba(255, 140, 0, 0.6), 0 0 120px rgba(255, 165, 0, 0.4)'
                  : sliderVoteAnimation.isAnimating && !sliderVoteAnimation.isFireVote
                  ? '0 0 40px rgba(255, 255, 255, 0.9), 0 0 80px rgba(255, 255, 255, 0.6), 0 0 120px rgba(255, 255, 255, 0.4)'
                  : currentSliderValue === 10 
                ? '0 0 20px rgba(255, 107, 53, 0.6), 0 0 40px rgba(255, 107, 53, 0.4)' 
                  : `0 8px 24px rgba(0,0,0,0.12)`,
              position: 'relative',
              zIndex: 10,
                transition: 'all 0.2s ease-out',
                transform: sliderVoteAnimation.isAnimating ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)'
            }}>
                                      {/* Image Container - Exact Matchup Style */}
              <div 
                style={{
                        aspectRatio: '1',
                        position: 'relative',
                        overflow: 'hidden',
                    background: 'var(--color-grey-100)'
                }}
              >
                <img 
                  src={fixImageUrl(nft.image)}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                    objectFit: 'cover',
                    transition: 'transform 0.2s ease-out',
                      transform: currentSliderValue === 10 ? 'scale(1.05)' : 'scale(1)'
                          }}
                  alt={`NFT ${nft.id}`}
                  onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            
                            // Clear loading timeout if any
                            if (target.dataset.loadTimeout) {
                              clearTimeout(parseInt(target.dataset.loadTimeout));
                              delete target.dataset.loadTimeout;
                            }
                            
                            const retryCount = parseInt(target.dataset.retryCount || '0');
                            
                            // Prevent infinite loops - only try fallbacks 2 times per image
                            if (retryCount >= 2) {
                              console.log(`❌ All gateways failed for slider NFT ${nft.id} after ${retryCount} attempts, skipping to next session...`);
                              
                              // Skip to next session like matchup cards do
                              if (handleImageSystemFailure) {
                                handleImageSystemFailure();
                              }
                              return;
                            }
                            
                            console.log(`❌ Failed attempt ${retryCount + 1} for slider NFT ${nft.id.substring(0,8)}...`);
                            
                            // Increment retry count
                            target.dataset.retryCount = (retryCount + 1).toString();
                            
                            // Try next IPFS gateway
                            const nextSrc = getNextIPFSGateway(target.src, nft.image);
                            console.log(`🔄 Trying gateway ${retryCount + 2} for slider NFT...`);
                            target.src = nextSrc;
                  }}
                />
                
                  {/* Fire Icon - Only at 10 */}
                  {currentSliderValue === 10 && (
                          <button
                            style={{
                      position: 'absolute',
                      top: 'var(--space-3)',
                      left: 'var(--space-3)',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.8)',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '24px',
                      transition: 'all 0.2s ease',
                        zIndex: 20,
                        pointerEvents: 'auto'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                        handleSliderVote(10, true);
                            }}
                            onMouseEnter={(e) => {
                              const target = e.target as HTMLElement;
                      target.style.background = 'rgba(255, 107, 53, 0.9)';
                              target.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              const target = e.target as HTMLElement;
                      target.style.background = 'rgba(0, 0, 0, 0.8)';
                              target.style.transform = 'scale(1)';
                            }}
                          >
                            🔥
                          </button>
                )}
                        </div>
                        
                {/* White Address Info Section - Exact Matchup Style */}
              <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--color-white)',
                  borderTop: '1px solid var(--color-grey-200)',
                  cursor: 'default',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end'
                }}>
                  <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-grey-600)',
                    justifyContent: 'flex-start',
                    flex: '1'
              }}>
                    {/* Token ID - Exact Matchup Style */}
                    {nft.token_id && (
                          <button
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
                          transition: 'opacity 0.2s ease, color 0.2s ease',
                          pointerEvents: 'auto'
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
                  title="Copy NFT address"
                >
                  #{nft.token_id}
                          </button>
                    )}
                  </div>
                      </div>
                      </div>
                    </div>

            {/* Narrow Vertical Meter */}
                    <div style={{ 
              width: '60px',
              height: '440px', // Extended by 30px
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              transform: 'translateY(-40px)' // Move up 10px + 30px for number repositioning
          }}>
              {/* Rating Number */}
                      <div style={{
              fontSize: '32px',
              fontWeight: '900',
                color: currentSliderValue === 10 ? '#ff6b35' : 'var(--dynamic-text-color)',
                        textAlign: 'center',
              marginBottom: 'var(--space-2)',
              transition: 'all 0.1s ease',
                textShadow: currentSliderValue === 10 ? '0 0 10px rgba(255, 107, 53, 0.5)' : 'none'
            }}>
              {currentSliderValue}
                      </div>
                      
              {/* Narrow Meter Track */}
            <div 
                        style={{
                  width: '20px',
                  height: '330px', // Extended by 30px
                background: 'transparent',
                  borderRadius: '10px',
                          position: 'relative',
                  border: `2px solid var(--dynamic-text-color)`,
                          overflow: 'hidden',
                flex: 1
                }}
              >
              {/* Dynamic Fill */}
              <div style={{
                            position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                height: `${(currentSliderValue / 10) * 100}%`,
                  background: currentSliderValue === 10 
                    ? '#ff6b35' 
                    : 'var(--dynamic-text-color)',
                  borderRadius: '8px',
                  transition: 'height 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease-out, box-shadow 0.15s ease-out',
                  boxShadow: currentSliderValue === 10 
                    ? '0 0 20px rgba(255, 107, 53, 0.6)' 
                  : 'none'
              }} />
                        </div>
                      </div>
                      
            {/* Instructions - Centered under NFT image, 10px left */}
                      <div style={{
            position: 'absolute',
            bottom: '-80px',
            left: '50%',
              transform: 'translateX(-50%) translateX(-40px)', // Offset container's 30px + additional 10px left
            textAlign: 'center',
            color: 'var(--dynamic-text-color)',
            fontSize: 'var(--font-size-sm)',
            opacity: 0.8,
              maxWidth: '600px',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              <div>Move the cursor up and down to rate. Click anywhere to lock in.</div>
                      </div>
                    </div>
        </>
      );
    }

                  // Matchup voting interface  
    if (isConnected) {
      return (
                    <MatchupCard
                      key={`${votingSession.nft1.id}-${votingSession.nft2.id}`}
                      nft1={votingSession.nft1}
                      nft2={votingSession.nft2}
                      onVote={handleVote}
                      onNoVote={handleNoVote}
                      onImageFailure={async () => {
            // Image failure handler logic here
                      }}
                      isVoting={isVoting}
                    />
      );
    }

    return null;
  };

  return (
                <div style={{
      minHeight: '100vh',
      position: 'relative',
      width: '100%'
    }}>
      

      {/* Network Status Alert */}
      <NetworkStatus />
      
      {/* Status Bar */}
              <div className="status-bar-element" style={{
                transform: showContent ? 'translateY(-100px)' : 'translateY(0)',
                transition: 'none'
              }}>
                <StatusBar 
                  ref={statusBarRef} 
                  onConnectWallet={() => {}} // No longer needed - StatusBar has direct RainbowKit
                  userVoteCount={userVoteCount}
                />
              </div>
        
        {/* Main Content */}
      <main className="main-content-spaced" style={{ 
        padding: 'calc(var(--space-4) + 40px) var(--space-6) var(--space-4) var(--space-6)',
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
            
            {/* Colossal Text Container - Below Status Bar */}
            <div className="colossal-text-container" style={{
              position: 'fixed',
              top: '45px',
              left: 0,
              width: '100vw',
              height: 'calc(100vh - 45px)',
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'hidden'
            }}>
              {/* PROOF OF - Top Left Corner */}
              <div className="proof-of-element" style={{
                position: 'absolute',
                top: '2vh',
                left: '5vw',
                fontFamily: 'var(--font-family-primary)',
                fontWeight: '300',
                fontSize: 'clamp(2rem, 12vw, 10rem)',
                lineHeight: '0.8',
                letterSpacing: '-0.02em',
                color: 'var(--dynamic-text-color)',
                textTransform: 'uppercase',
                opacity: '1',
                userSelect: 'none',
                transform: showContent ? 'translateX(100vw)' : 'translateX(0)',
                transition: 'none'
              }}>
                <div>PROOF</div>
                <div>OF</div>
              </div>

              {/* AEST HETIC™ - Bottom Right Corner */}
              <div className="aest-hetic-element" style={{
                position: 'absolute',
                bottom: '5vh',
                right: '5vw',
                fontFamily: 'var(--font-family-primary)',
                fontWeight: '300',
                fontSize: 'clamp(2rem, 12vw, 10rem)',
                lineHeight: '0.8',
                letterSpacing: '-0.02em',
                color: 'var(--dynamic-text-color)',
                textTransform: 'uppercase',
                opacity: '1',
                userSelect: 'none',
                textAlign: 'right',
                transform: showContent ? 'translateX(100vw)' : 'translateX(0)',
                transition: 'none'
              }}>
                <div>AES</div>
                <div style={{ position: 'relative' }}>
                  THETIC
                  <sup style={{ 
                    fontSize: '0.4em', 
                    position: 'absolute',
                    top: '0',
                    right: '-0.8em',
                    lineHeight: '1'
                  }}>™</sup>
                </div>
              </div>

              {/* Bottom Center Info - Within colossal container */}
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--dynamic-text-color)',
                opacity: '1.0',
                fontWeight: '300',
                zIndex: 10,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>NFTs from the <span style={{ color: '#22c55e' }}>{currentChain}</span> blockchain</span>
                <span>&nbsp;&nbsp;</span>
                <span>Taste Activity Today: {isLoadingActivity ? 'Loading...' : licksToday}</span>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  marginLeft: '4px',
                  backgroundColor: 'var(--dynamic-text-color)',
                  WebkitMask: 'url(/lick-icon.png) center/contain no-repeat',
                  mask: 'url(/lick-icon.png) center/contain no-repeat'
                }} />
              </div>

              {/* Voting Section - Centered within colossal container */}
              <section style={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
                overflow: 'visible',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-8)',
                paddingTop: 'var(--space-2)',
                paddingBottom: 'var(--space-8)'
              }}>
                {renderVotingContent()}
              </section>
            </div>
            {/* End of main composition container */}

            {/* Duck images now embedded in prize break modal below */}
            {false && (
              <div 
                                      style={{ 
                  position: 'fixed',
                  top: '30%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 500
                }}
              >
                <div>Duck images placeholder</div>
                                  </div>
                                )}

            {/* Art Duck moved to prize modal */}
            {false && (
              <div 
                      style={{
                  position: 'fixed',
                  top: '40%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 500
                }}
              >
                <div>Art Duck placeholder</div>
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
                  zIndex: 1000,
                  background: 'rgba(0, 0, 0, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  padding: 'var(--space-4)'
                }}
              >
                {/* Prize Trailing Images - Client Side Only */}
                {typeof window !== 'undefined' && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100, pointerEvents: 'none' }}>
                    <PrizeTrailingImages
                      rewardType={(prizeBreakState.reward?.gugoAmount ?? 0) > 0 ? 'gugo' : 'xp-votes'}
                      isActive={prizeBreakState.isActive}
                    />
                  </div>
                )}

                {/* Card Flip Container */}
                <div style={{
                  perspective: '1000px',
                  maxWidth: '600px',
                  width: '100%',
                  minHeight: '500px',
                  margin: 'var(--space-4)'
                }}>
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    minHeight: '500px',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)',
                    transform: showDelayedPrize ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}>
                    
                    {/* Back of Card - Loading State */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      background: 'var(--dynamic-bg-color)',
                      border: '2px solid var(--dynamic-text-color)',
                      borderRadius: 'var(--border-radius-lg)',
                      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                      padding: 'var(--space-12)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      zIndex: 50
                    }}>
                      <div style={{
                        fontSize: 'var(--font-size-3xl)',
                        fontWeight: '700',
                        color: 'var(--dynamic-text-color)',
                        marginBottom: 'var(--space-8)',
                        animation: 'gentle-pulse 2s ease-in-out infinite'
                      }}>
                        Reward incoming...
                      </div>
                      
                      {/* Loading spinner */}
                      <div style={{
                        width: '60px',
                        height: '60px',
                        border: `4px solid rgba(var(--dynamic-text-color-rgb), 0.3)`,
                        borderTop: `4px solid var(--dynamic-text-color)`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    </div>

                    {/* Front of Card - Prize Content */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      background: 'var(--dynamic-bg-color)',
                      border: '2px solid var(--dynamic-text-color)',
                      borderRadius: 'var(--border-radius-lg)',
                      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                      padding: 'var(--space-8)',
                      paddingBottom: 'var(--space-8)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      textAlign: 'center',
                      color: 'var(--dynamic-text-color)',
                      zIndex: 50,
                      overflowY: 'auto'
                    }}>
                  
                  {/* You Won! Title */}
                  <div style={{
                    fontSize: 'var(--font-size-3xl)',
                    fontWeight: '800',
                    marginBottom: 'var(--space-1)',
                    color: 'var(--dynamic-text-color)',
                    textAlign: 'center'
                  }}>
                    You Won!
                  </div>

                  {/* Claiming State */}
                  {prizeBreakState.isClaimingReward && (
                    <div style={{
                      fontSize: 'var(--font-size-2xl)',
                      fontWeight: '600',
                      marginBottom: 'var(--space-6)',
                      opacity: 0.8,
                      animation: 'pulse 1.5s infinite',
                      color: 'var(--dynamic-text-color)'
                    }}>
                      {prizeBreakMessage}
                    </div>
                  )}

                  {/* Duck Image */}
                  {prizeBreakState.reward && showDelayedPrize && prizeBreakState.selectedDuckImage && (
                    <div style={{
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={prizeBreakState.selectedDuckImage.src}
                        alt={prizeBreakState.selectedDuckImage.alt}
                        style={{
                          width: '120px',
                          height: '120px',
                          objectFit: 'contain',
                          filter: prizeBreakState.selectedDuckImage.filter
                        }}
                      />
                    </div>
                  )}

                  {/* Stacked Prize Display */}
                  {prizeBreakState.reward && showDelayedPrize && (() => {
                    const reward = prizeBreakState.reward;
                    const prizes = [];
                    
                    // Build array of individual prizes
                    if (reward.gugoAmount > 0) {
                      prizes.push({ type: 'GUGO', amount: reward.gugoAmount, unit: 'GUGO' });
                    }
                    if (reward.xpAmount > 0) {
                      prizes.push({ type: 'XP', amount: reward.xpAmount, unit: 'XP' });
                    }
                    if (reward.votesAmount > 0) {
                      prizes.push({ type: 'VOTES', amount: reward.votesAmount, unit: 'lick-icon' });
                    }
                    if (reward.licksAmount > 0) {
                      prizes.push({ type: 'LICKS', amount: reward.licksAmount, unit: 'Licks' });
                    }
                    
                    return (
                      <div style={{
                        marginBottom: 'var(--space-3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0'
                      }}>
                        {prizes.map((prize, index) => (
                          <div
                            key={`${prize.type}-${index}`}
                            style={{
                              fontSize: 'var(--font-size-5xl)',
                              fontWeight: '800',
                              textAlign: 'center',
                              background: 'linear-gradient(90deg, var(--dynamic-text-color) 0%, rgba(255,255,255,0.9) 50%, var(--dynamic-text-color) 100%)',
                              backgroundSize: '200% 100%',
                              backgroundClip: 'text',
                              WebkitBackgroundClip: 'text',
                              color: 'transparent',
                              animation: 'shine 2s ease-in-out infinite, slow-pulse 3s ease-in-out infinite',
                              lineHeight: '1.0',
                              marginTop: index > 0 ? '-2px' : '0'
                            }}
                          >
                            {prize.unit === 'lick-icon' ? (
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                +{prize.amount}
                                <div
                                  style={{
                                    width: '60px',
                                    height: '60px',
                                    background: 'linear-gradient(90deg, var(--dynamic-text-color) 0%, rgba(255,255,255,0.9) 50%, var(--dynamic-text-color) 100%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'shine 2s ease-in-out infinite',
                                    WebkitMask: `url("/lick-icon.png") no-repeat center/contain`,
                                    mask: `url("/lick-icon.png") no-repeat center/contain`,
                                    transform: 'translateY(4px)'
                                  }}
                                />
                              </span>
                            ) : (
                              `+${prize.amount} ${prize.unit}`
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Linear Marquee - Between Prize and Button */}
                  {showDelayedPrize && prizeBreakState.reward && (
                    <div style={{
                      marginTop: 'var(--space-4)',
                      marginBottom: 'var(--space-3)',
                      width: '100%',
                      overflow: 'hidden',
                      zIndex: 1000
                    }}>
                      <CircularMarquee
                        phrases={prizeBreakState.reward.gugoAmount > 0 ? GUGO_PHRASES : NON_GUGO_PHRASES}
                        prizeText=""
                        isVisible={true}
                        fontSize="16px"
                        color="var(--dynamic-text-color)"
                        duration={20}
                        type="linear"
                        width={800}
                        contained={true}
                      />
                    </div>
                  )}

                  {/* Claim Button with Dynamic Styling */}
                  {prizeBreakState.reward && showDelayedPrize && (() => {
                    const tierColors = getTierColors(prizeBreakState.reward.rewardType);
                    const hasSession = sessionStatus?.hasActiveSession && !sessionStatus?.isExpired;
                    const buttonText = hasSession ? 'Accept Reward' : 'Start a Session to Claim Rewards';
                    
                    return (
                      <button
                        onClick={async () => {
                          if (hasSession) {
                            console.log('🎁 Accepting reward and ending prize break...');
                            
                            // 🎬 Trigger animations when reward is actually accepted (after modal closes)
                            if (prizeBreakState.reward) {
                              setTimeout(() => {
                                if (prizeBreakState.reward!.gugoAmount > 0) {
                                  console.log('💰 Triggering wallet glow animation for', prizeBreakState.reward!.gugoAmount, 'GUGO (after modal close)');
                                  statusBarRef.current?.triggerWalletGlow(prizeBreakState.reward!.gugoAmount);
                                } else {
                                  // Non-GUGO prizes: trigger XP and Licks animations
                                  if (prizeBreakState.reward!.xpAmount > 0) {
                                    console.log('⚡ Triggering XP animation for', prizeBreakState.reward!.xpAmount, 'XP (after modal close)');
                                    statusBarRef.current?.triggerXpAnimation(prizeBreakState.reward!.xpAmount);
                                  }
                                  
                                  if (prizeBreakState.reward!.licksAmount > 0) {
                                    console.log('🎫 Triggering Licks animation for', prizeBreakState.reward!.licksAmount, 'Licks (after modal close)');
                                    statusBarRef.current?.triggerLicksAnimation(prizeBreakState.reward!.licksAmount);
                                  } else if (prizeBreakState.reward!.votesAmount > 0) {
                                    console.log('🎫 Triggering Licks animation for', prizeBreakState.reward!.votesAmount, 'Votes (after modal close)');
                                    statusBarRef.current?.triggerLicksAnimation(prizeBreakState.reward!.votesAmount);
                                  }
                                }
                              }, 800); // 800ms delay to let prize break modal close
                            }
                            
                            endPrizeBreak();
                          } else {
                            console.log('🔑 Creating session to claim reward...');
                            try {
                              const success = await createSession();
                              if (success) {
                                console.log('✅ Session created successfully! Green indicator should now be visible.');
                                // Small delay to ensure state propagation before claiming reward
                                await new Promise(resolve => setTimeout(resolve, 100));
                                endPrizeBreak();
                              } else {
                                console.log('❌ Session creation failed or was cancelled');
                              }
                            } catch (error) {
                              console.error('❌ Error creating session:', error);
                            }
                          }
                        }}
                        disabled={isCreatingSession}
                        style={{
                          marginTop: 'var(--space-2)',
                          padding: 'var(--space-3) var(--space-4)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '600',
                          background: isCreatingSession ? 'rgba(var(--dynamic-text-color-rgb), 0.7)' : 'var(--dynamic-text-color)',
                          color: 'var(--dynamic-bg-color)',
                          border: `1px solid var(--dynamic-text-color)`,
                          borderRadius: 'var(--border-radius-md)',
                          cursor: isCreatingSession ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: 'none',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          opacity: isCreatingSession ? 0.8 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!isCreatingSession) {
                            const target = e.target as HTMLElement;
                            target.style.transform = 'translateY(-1px)';
                            target.style.opacity = '0.8';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCreatingSession) {
                            const target = e.target as HTMLElement;
                            target.style.transform = 'translateY(0)';
                            target.style.opacity = '1';
                          }
                        }}
                      >
                        {isCreatingSession ? 'Creating Session...' : buttonText}
                      </button>
                    );
                  })()}
                </div>

                {/* CSS Animations */}
                <style jsx global>{`
                  @keyframes gentle-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                  }
                  
                  @keyframes shine {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                  }
                  
                  @keyframes slow-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                  }
                  
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                    </div>
                  </div>
          </div>
            )}
      
      {/* Simplified Purchase Alert Modal */}
      <SimplifiedInsufficientVotesAlert
        isOpen={showPurchaseAlert}
        requiredVotes={requiredVotes}
        onClose={handleClosePurchaseAlert}
        onPurchaseComplete={(licksCount) => {
          console.log(`🎉 Purchased ${licksCount} Licks from insufficient votes alert`);
          // Refresh user data to update vote count
          statusBarRef.current?.refreshUserData();
        }}
      />
      
      {/* Session Prompt Modal - Only for vote purchase now */}
      {showSessionPrompt.trigger === 'vote-purchase' && (
      <SessionPrompt
        isOpen={showSessionPrompt.isOpen}
        trigger={showSessionPrompt.trigger}
        onCreateSession={handleCreateSession}
        onSkip={handleSkipSession}
        onClose={handleCloseSessionPrompt}
        isCreatingSession={isCreatingSession}
      />
      )}
      


            {/* Confetti Effect */}
      {showConfetti && (
        <Confetti
          onComplete={() => {
            setShowConfetti(false);
          }}
        />
      )}

      {/* Audio Controls */}
      <AudioControls />

      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={shouldShowTour && isConnected && !loading}
        onComplete={() => {
          console.log('🎉 Onboarding tour completed');
          markTourAsSeen();
        }}
        onSkip={() => {
          console.log('⏭️ Onboarding tour skipped');
          markTourAsSeen();
        }}
      />
      


          </div>
        </div>
      </main>
    </div>
  );
}


