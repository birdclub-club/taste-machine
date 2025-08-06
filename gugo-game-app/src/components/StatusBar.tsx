"use client"

import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '../hooks/useAuth';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useSessionKey } from '../hooks/useSessionKey';
import { useCollectionPreference } from '../hooks/useCollectionPreference';
import { SessionAction } from '../../lib/session-keys';
import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { canClaimFreeVotes, claimFreeVotes } from '../../lib/auth';
import { LicksPurchaseModal } from './LicksPurchaseModal';

interface StatusBarProps {
  onConnectWallet: () => void;
}

export interface StatusBarRef {
  refreshUserData: () => void;
  triggerXpAnimation: (xpAmount: number) => void;
  triggerWalletGlow: (gugoAmount: number) => void;
  triggerLicksAnimation: (licksAmount: number) => void;
}

const StatusBar = forwardRef<StatusBarRef, StatusBarProps>(({ onConnectWallet }, ref) => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { user, loading, refreshUser } = useAuth();
  const { 
    sessionStatus, 
    createSession, 
    renewSession, 
    endSession, 
    isCreatingSession, 
    sessionError, 
    formatTimeRemaining, 
    needsRenewal,
    isSessionActive 
  } = useSessionKey();
  
  const { preference, setCollectionPreference } = useCollectionPreference();

  // Function to trigger XP animation
  const triggerXpAnimation = (xpAmount: number) => {
    setXpFloatingNotificationAmount(xpAmount);
    setShowXpFloatingNotification(true);
    
    // Hide notification after animation completes
    setTimeout(() => {
      setShowXpFloatingNotification(false);
    }, 3000);
  };

  // Function to trigger wallet glow animation
  const triggerWalletGlow = (gugoAmount: number) => {
    setWalletGlowAmount(gugoAmount);
    setShowWalletGlow(true);
    
    console.log(`💰 Triggering wallet glow animation for +${gugoAmount} GUGO`);
    
    // Refresh wallet balance after GUGO transfer (with delay for blockchain propagation)
    setTimeout(() => {
      console.log('🔄 Refreshing wallet balance after GUGO reward...');
      refreshBalance().catch(error => {
        console.error('❌ Failed to refresh balance after GUGO reward:', error);
      });
    }, 1000); // 1 second delay to ensure transaction propagation
    
    // Hide glow after animation completes
    setTimeout(() => {
      setShowWalletGlow(false);
    }, 3000);
  };

  // Function to trigger Licks floating animation
  const triggerLicksAnimation = (licksAmount: number) => {
    setFloatingNotificationAmount(licksAmount);
    setShowFloatingNotification(true);
    
    console.log(`🎁 Triggering Licks animation for +${licksAmount} Licks`);
    
    // Hide notification after animation completes
    setTimeout(() => {
      setShowFloatingNotification(false);
    }, 3000);
  };

  // Function to fetch unclaimed rewards
  const fetchUnclaimedRewards = async () => {
    if (!address) return;
    
    try {
      const response = await fetch(`/api/rewards/unclaimed?walletAddress=${address}`);
      if (response.ok) {
        const rewards = await response.json();
        setUnclaimedRewards(rewards);
        console.log('📋 Fetched unclaimed rewards:', rewards);
      } else {
        // API not implemented yet, but that's ok
        setUnclaimedRewards([]);
      }
    } catch (error) {
      // Gracefully handle when API doesn't exist
      console.log('📝 Rewards API not available yet, using empty rewards');
      setUnclaimedRewards([]);
    }
  };

  // Function to claim all rewards to blockchain
  const claimAllRewards = async () => {
    if (!address || unclaimedRewards.length === 0) return;
    
    setClaimingRewards(true);
    try {
      console.log('🔗 Claiming all rewards to blockchain...');
      
      // Here we would call the smart contract to batch claim all rewards
      // For now, just simulate the process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ All rewards claimed successfully!');
      setUnclaimedRewards([]);
      await refreshUser(); // Refresh user data
      
    } catch (error) {
      console.error('❌ Error claiming rewards:', error);
    } finally {
      setClaimingRewards(false);
    }
  };

  // Expose functions to parent components
  useImperativeHandle(ref, () => ({
    refreshUserData: refreshUser,
    triggerXpAnimation,
    triggerWalletGlow,
    triggerLicksAnimation
  }), [refreshUser]);
  const { eligibility, refreshBalance } = useTokenBalance();
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showAboutPopup, setShowAboutPopup] = useState(false);
  const [showHowPopup, setShowHowPopup] = useState(false);
  const [showWhyPopup, setShowWhyPopup] = useState(false);
  const [showCollectionsPopup, setShowCollectionsPopup] = useState(false);
  const [claimingVotes, setClaimingVotes] = useState(false);
  const [showLickPopup, setShowLickPopup] = useState(false);
  const [popupStage, setPopupStage] = useState<'initial' | 'animating' | 'result'>('initial');
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [finalVotes, setFinalVotes] = useState(0);
  const [hasClaimedToday, setHasClaimedToday] = useState(false);
  const [showFloatingNotification, setShowFloatingNotification] = useState(false);
  const [floatingNotificationAmount, setFloatingNotificationAmount] = useState(0);
  const [showXpFloatingNotification, setShowXpFloatingNotification] = useState(false);
  const [xpFloatingNotificationAmount, setXpFloatingNotificationAmount] = useState(0);
  const [congratsWord, setCongratsWord] = useState('Nice!');
  const [unclaimedRewards, setUnclaimedRewards] = useState<any[]>([]);
  const [claimingRewards, setClaimingRewards] = useState(false);
  const [showWalletGlow, setShowWalletGlow] = useState(false);
  const [walletGlowAmount, setWalletGlowAmount] = useState(0);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  
  // Debug: Watch showPurchaseModal state changes
  useEffect(() => {
    console.log('🛒 [DEBUG] showPurchaseModal state changed to:', showPurchaseModal);
  }, [showPurchaseModal]);
  const multiplierRef = useRef<HTMLSpanElement>(null);

  // Fun congratulations words to rotate through
  const congratsWords = ['Nice!', 'Ok!', 'Yep!', 'Cool', 'NBD', 'Solid', 'Yes!'];

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (balance: string | undefined) => {
    if (!balance) return '0.00';
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

  const formatLicks = (amount: number) => {
    if (amount >= 1000) {
      const k = amount / 1000;
      if (k >= 10) {
        return `${Math.floor(k)}k`; // 10k, 11k, etc.
      } else {
        return `${k.toFixed(1)}k`; // 1.0k, 1.1k, etc.
      }
    }
    return amount.toString(); // Under 1000, show as-is
  };

  // Calculate total unclaimed rewards
  const calculateUnclaimedTotals = () => {
    return unclaimedRewards.reduce((totals, reward) => {
      return {
        xp: totals.xp + (reward.reward?.xpAmount || 0),
        votes: totals.votes + (reward.reward?.votesAmount || 0),
        gugo: totals.gugo + (reward.reward?.gugoAmount || 0)
      };
    }, { xp: 0, votes: 0, gugo: 0 });
  };

  // Fetch unclaimed rewards when component mounts or address changes
  useEffect(() => {
    if (address && isConnected) {
      fetchUnclaimedRewards();
    }
  }, [address, isConnected]);

  const handleClaimFreeVotes = async () => {
    if (!user || !address) return;
    
    setClaimingVotes(true);
    try {
      const success = await claimFreeVotes(address);
      if (success) {
        await refreshUser();
        console.log('Free votes claimed successfully!');
      } else {
        console.error('Failed to claim free votes');
      }
    } catch (error) {
      console.error('Error claiming free votes:', error);
    } finally {
      setClaimingVotes(false);
    }
  };



  const canClaim = user ? canClaimFreeVotes(user) && !hasClaimedToday : false;

  // 🎭 DEMO: Reset claim state for demo purposes
  const resetForDemo = () => {
    console.log('🔄 Resetting Lick claim state for demo');
    setHasClaimedToday(false);
    setShowLickPopup(false);
    setPopupStage('initial');
    setCurrentMultiplier(1);
    setFinalVotes(0);
    setShowFloatingNotification(false);
    setFloatingNotificationAmount(0);
    setCongratsWord('Nice!');
  };

  // 🎭 DEMO: Make reset function available globally for console access
  if (typeof window !== 'undefined') {
    (window as any).resetLickDemo = resetForDemo;
  }

  // 🎭 DEMO: Reset claim state on page refresh for demo purposes
  useEffect(() => {
    console.log('🔄 StatusBar mounted - resetting Lick claim state for demo');
    setHasClaimedToday(false);
  }, []);

  // Debug: Log state changes
  useEffect(() => {
    console.log(`🐛 Debug: canClaim=${canClaim}, hasClaimedToday=${hasClaimedToday}, user=${!!user}, isConnected=${isConnected}`);
  }, [canClaim, hasClaimedToday, user, isConnected]);

  // Lick Claiming Popup Component
  const LickClaimPopup = () => (
    <div 
      className="lick-popup"
      style={{
        position: 'fixed',
        top: '68px', // Just below the status bar
        right: '320px', // Positioned directly under the Lick icon
        background: '#2a2a2a', // Dark background to match status bar
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        border: '1px solid #333333',
        borderTop: 'none', // Remove top border to connect with triangle
        zIndex: 1000,
        width: '190px', // Slightly wider for better icon spacing
        maxWidth: 'calc(100vw - 20px)', // Ensure it doesn't overflow on mobile
        textAlign: 'center',
        // Only animate on initial appearance, then stay locked
        animation: popupStage === 'initial' ? 'dropdownReveal 0.4s ease-out forwards' : 'none',
        transformOrigin: 'top center',
        // Lock transform after initial animation
        transform: popupStage !== 'initial' ? 'scaleY(1) translateY(0)' : undefined
      }}
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside popup
      >
      {/* Connection Triangle Arrow - Centered */}
      <div style={{
        position: 'absolute',
        top: '-8px',
        left: '50%',
        transform: 'translateX(-50%)', // Center the arrow
        width: '0',
        height: '0',
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderBottom: '8px solid #2a2a2a',
        zIndex: 1001
      }} />
      
      {/* Triangle Border (slightly larger, darker) - Centered */}
      <div style={{
        position: 'absolute',
        top: '-9px',
        left: '50%',
        transform: 'translateX(-50%)', // Center the border
        width: '0',
        height: '0',
        borderLeft: '9px solid transparent',
        borderRight: '9px solid transparent',
        borderBottom: '9px solid #333333',
        zIndex: 1000
      }} />
      
      {/* Close Button */}
      <button
        onClick={() => {
          console.log('🖱️ Close button clicked');
          
          // Award votes and show floating notification if we just claimed
          if (popupStage === 'result' && finalVotes > 0 && address) {
            // Award the votes now
            claimFreeVotes(address, finalVotes).then(success => {
              if (success) {
                refreshUser();
                console.log(`🎁 Claimed ${finalVotes} Licks!`);
              }
            }).catch(error => {
              console.error('Error claiming Licks:', error);
            });
            
            setFloatingNotificationAmount(finalVotes);
            setShowFloatingNotification(true);
            
            // Hide floating notification after 3 seconds
            setTimeout(() => {
              setShowFloatingNotification(false);
            }, 3000);
          }
          
          // Close popup and reset
          setShowLickPopup(false);
          setPopupStage('initial');
          setCurrentMultiplier(1);
          setFinalVotes(0);
          setCongratsWord('Nice!');
        }}
        style={{
          position: 'absolute',
          top: 'var(--space-2)',
          right: 'var(--space-2)',
          background: 'transparent',
          border: 'none',
          color: '#999',
          fontSize: '18px',
          cursor: 'pointer',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#444';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#999';
        }}
      >
        ×
      </button>
      
      {/* Popup Content - Compact Locked Layout */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between', // Even distribution
        height: popupStage === 'result' ? '130px' : '110px', // Slightly taller to accommodate bigger icon
        width: '170px', // Slightly wider for better spacing
        padding: '0', // Remove variable padding
        margin: '0' // Remove any margins
      }}>
        {/* Status Text */}
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-grey-300)',
          height: '20px', // Fixed height for consistency
          display: 'flex',
          alignItems: 'center'
        }}>
          {popupStage === 'initial' && ''}
          {popupStage === 'animating' && 'Rolling multiplier...'}
          {popupStage === 'result' && congratsWord}
        </div>
        
        {/* Main Content - Completely Locked Position */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px', // Slightly larger gap for bigger icon
          fontSize: '28px', // Fixed pixel size
          fontWeight: '800',
          color: 'var(--color-white)',
          height: '48px', // Taller to accommodate bigger icon
          width: '150px', // Slightly wider for better spacing
          lineHeight: '48px', // Match height for better alignment
          flexShrink: 0, // Never shrink
          flexGrow: 0 // Never grow
        }}>
          <span>10</span>
          <img
            src="/lick-icon.png"
            alt="Lick"
            style={{
              width: '36px', // Bigger icon size
              height: '36px', // Bigger icon size
              flexShrink: 0
            }}
          />
          {popupStage !== 'initial' && (
            <span 
              ref={multiplierRef}
              style={{
                color: 'var(--color-green)',
                textShadow: popupStage === 'result' ? '0 0 16px rgba(0, 211, 149, 1)' : '0 0 12px rgba(0, 211, 149, 0.8)',
                transform: 'scale(1.2)',
                width: '50px', // Exact fixed width instead of minWidth
                height: '48px', // Match the main container height
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0, // Never shrink
                flexGrow: 0, // Never grow
                lineHeight: '1', // Fixed line height
                animation: popupStage === 'animating' ? 'pulse 0.8s ease-in-out infinite' : 
                           popupStage === 'result' ? 'glow 2s ease-out forwards' : 'none'
              }}
            >
              ×{currentMultiplier}
            </span>
          )}
        </div>
        
        {/* Button or Result Info */}
        <div style={{
          height: '32px', // Match button height for better alignment
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {popupStage === 'initial' && (
            <button
              onClick={() => {
                setPopupStage('animating');
                
                // Start 2-second animation using DOM manipulation
                const animationDuration = 2000;
                const frameRate = 120; // Slightly faster updates for smoother effect
                const totalFrames = animationDuration / frameRate;
                let currentFrame = 0;
                let lastMultiplier = 1; // Track the last multiplier shown
                
                const animationInterval = setInterval(() => {
                  currentFrame++;
                  
                  // Slow down towards the end
                  const progress = currentFrame / totalFrames;
                  
                  // Only update if we should show a new number
                  let shouldUpdate = true;
                  if (progress > 0.7) {
                    // Slower updates in final 30%
                    shouldUpdate = currentFrame % 2 === 1;
                  }
                  
                  if (shouldUpdate) {
                    // Update DOM directly instead of React state to prevent re-renders
                    const randomMultiplier = Math.floor(Math.random() * 10) + 1;
                    lastMultiplier = randomMultiplier; // Keep track of what we're showing
                    if (multiplierRef.current) {
                      multiplierRef.current.textContent = `×${randomMultiplier}`;
                    }
                  }
                  
                  if (currentFrame >= totalFrames) {
                    clearInterval(animationInterval);
                    
                    // Use the last multiplier that was shown - don't generate a new one!
                    const finalMultiplier = lastMultiplier;
                    setCurrentMultiplier(finalMultiplier); // Store final result in state
                    const totalVotes = 10 * finalMultiplier;
                    setFinalVotes(totalVotes);
                    
                    // Don't update DOM again - it already shows the right value!
                    
                    // Pick a random congratulations word
                    const randomWord = congratsWords[Math.floor(Math.random() * congratsWords.length)];
                    setCongratsWord(randomWord);
                    
                    // Show result with glow effect
                    setPopupStage('result');
                    
                    // Don't award votes yet - wait for user to close popup
                    setHasClaimedToday(true); // Hide red dot immediately
                    console.log(`🎁 Ready to claim ${totalVotes} Licks with ${finalMultiplier}x multiplier!`);
                  }
                }, frameRate);
              }}
              style={{
                background: 'var(--color-green)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                padding: '6px 16px', // Even smaller padding
                fontSize: '14px', // Smaller font
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '60px', // Smaller button width
                height: '28px' // Fixed smaller height
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-green-dark)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-green)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Claim
            </button>
          )}
          
          {/* Result stage message */}
          {popupStage === 'result' && (
            <div style={{
              fontSize: '11px',
              color: 'var(--color-grey-400)',
              textAlign: 'center',
              lineHeight: '1.2',
              marginTop: 'var(--space-2)'
            }}>
              Come back tomorrow for more free Licks.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // About popup component
  const AboutPopup = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'var(--space-4)'
    }} onClick={() => setShowAboutPopup(false)}>
      <div style={{
        background: '#2a2a2a',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative',
        border: '1px solid #444444'
      }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowAboutPopup(false)}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            fontSize: 'var(--font-size-xl)',
            cursor: 'pointer',
            color: 'var(--color-white)'
          }}
        >
          ×
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
          <img 
            src="/Taste-Machine-Monster-Abstract-Green-150x150.png" 
            alt="Taste Machine"
            style={{ width: '80px', height: '80px', objectFit: 'contain' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ 
              fontSize: 'var(--font-size-2xl)', 
              fontWeight: '800', 
              color: 'var(--color-white)',
              marginBottom: 'var(--space-1)',
              textTransform: 'none'
            }}>
              Proof of Aesthetic<sup style={{ fontSize: '0.7em' }}>™</sup>
            </h2>
          </div>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5' }}>
            If you're like us, you could scroll NFT art all day — and you've got thoughts. So we built a way to make them count.
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5' }}>
            Taste Machine is an experiment in whether visual appeal can shape value — alongside rarity, not beneath it.
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5' }}>
            You'll get free Licks every day — enough to play and start shaping the signal.
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5' }}>
            But if you want to earn more, vote more, and unlock bigger rewards, you'll need GUGO or ETH to buy additional Licks.
          </p>
          
          <p style={{ marginBottom: 'var(--space-5)', color: '#e5e5e5' }}>
            That small stake helps keep the system clean by filtering out spam, bots, and low-effort voting.
          </p>

          {/* Whitepaper Link */}
          <a
            href="https://docs.google.com/document/d/1Lp6qZ02UjyVDDDGf16GuBdUECcop87ciVP061IcJA3U/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: '#e5e5e5',
              textDecoration: 'none',
              fontSize: 'var(--font-size-base)',
              fontWeight: '400',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-white)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#e5e5e5';
            }}
          >
            <span>White Paper Overview</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </div>
  );

  // How popup component
  const HowPopup = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'var(--space-4)'
    }} onClick={() => setShowHowPopup(false)}>
      <div style={{
        background: '#2a2a2a',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative',
        border: '1px solid #444444'
      }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowHowPopup(false)}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            fontSize: 'var(--font-size-xl)',
            cursor: 'pointer',
            color: 'var(--color-white)'
          }}
        >
          ×
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '800', 
            color: 'var(--color-white)',
            marginBottom: 'var(--space-2)',
            textTransform: 'none'
          }}>
            See two. Choose one. Earn GUGO.
          </h2>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5', fontSize: 'var(--font-size-base)', fontWeight: '500' }}>
            We call our votes Licks.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5' }}>
            You'll be shown two NFTs — just lick the one that looks better.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5' }}>
            If something really hits, smash the fire button. That's the highest compliment.
          </p>
        </div>
      </div>
    </div>
  );

  // Why popup component
  const WhyPopup = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'var(--space-4)'
    }} onClick={() => setShowWhyPopup(false)}>
      <div style={{
        background: '#2a2a2a',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative',
        border: '1px solid #444444'
      }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowWhyPopup(false)}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            fontSize: 'var(--font-size-xl)',
            cursor: 'pointer',
            color: 'var(--color-white)'
          }}
        >
          ×
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '800', 
            color: 'var(--color-white)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase'
          }}>
            Why
          </h2>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5', fontSize: 'var(--font-size-lg)', lineHeight: '1.7' }}>
            Because art deserves better than metadata.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: '#e5e5e5' }}>
            In a space obsessed with traits and rarity, we built a way to surface what actually looks good. You bring the eye — we bring the GUGO.
          </p>
        </div>
      </div>
    </div>
  );

  // Collections popup component
  const CollectionsPopup = () => {
    const handleCollectionChange = async (newPreference: 'bearish' | 'mix') => {
      console.log(`🎯 Switching collection preference from "${preference}" to "${newPreference}"`);
      console.log('🔧 Debug: Current preference before change:', preference);
      setCollectionPreference(newPreference);
      
      // Add extra debugging to track the change
      setTimeout(() => {
        console.log('🔧 Debug: Preference should now be:', newPreference);
      }, 100);
      
      console.log('✅ Collection preference updated - ready to apply changes');
    };

    const handleGoClick = () => {
      console.log('🚀 Go button clicked - closing modal and triggering soft refresh');
      setShowCollectionsPopup(false);
      console.log('🔧 Debug: Modal closed, page.tsx useEffect should be triggered...');
    };
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)'
      }} onClick={() => setShowCollectionsPopup(false)}>
        <div style={{
          background: '#2a2a2a',
          borderRadius: 'var(--border-radius-lg)',
          padding: 'var(--space-6)',
          maxWidth: '320px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          position: 'relative',
          border: '1px solid #444444'
        }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowCollectionsPopup(false)}
            style={{
              position: 'absolute',
              top: 'var(--space-4)',
              right: 'var(--space-4)',
              background: 'none',
              border: 'none',
              fontSize: 'var(--font-size-xl)',
              cursor: 'pointer',
              color: 'var(--color-white)'
            }}
          >
            ×
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ 
              fontSize: 'var(--font-size-lg)', 
              fontWeight: '600', 
              color: 'var(--color-white)',
              marginBottom: 'var(--space-1)',
              textTransform: 'none'
            }}>
              Collections
            </h2>
          </div>

          <div style={{ textAlign: 'center', lineHeight: '1.6' }}>
            <p style={{ 
              marginBottom: 'var(--space-4)', 
              color: '#cccccc', 
              fontSize: 'var(--font-size-sm)',
            }}>
              Focus on:
            </p>
            
            {/* Toggle Switch */}
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)'
            }}>
              <span style={{ 
                fontSize: 'var(--font-size-sm)',
                color: preference === 'bearish' ? '#ffffff' : '#cccccc',
                fontWeight: preference === 'bearish' ? '700' : '500',
                transition: 'all 0.3s ease',
                textShadow: preference === 'bearish' ? '0 0 8px var(--accent-color)' : 'none'
              }}>
                Bearish
              </span>
              
              {/* Toggle Switch */}
              <div 
                onClick={() => handleCollectionChange(preference === 'bearish' ? 'mix' : 'bearish')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = preference === 'bearish' 
                    ? '0 0 16px rgba(var(--accent-color-rgb), 0.6)' 
                    : '0 0 12px rgba(255,255,255,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = preference === 'bearish' 
                    ? '0 0 12px rgba(var(--accent-color-rgb), 0.4)' 
                    : '0 0 8px rgba(255,255,255,0.2)';
                }}
                style={{
                  position: 'relative',
                  width: '56px',
                  height: '28px',
                  background: preference === 'bearish' ? 'var(--accent-color)' : '#666666',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: `2px solid ${preference === 'bearish' ? 'var(--accent-color)' : '#999999'}`,
                  boxShadow: preference === 'bearish' ? '0 0 12px rgba(var(--accent-color-rgb), 0.4)' : '0 0 8px rgba(255,255,255,0.2)'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  left: preference === 'bearish' ? '3px' : '29px',
                  width: '20px',
                  height: '20px',
                  background: '#ffffff',
                  borderRadius: '50%',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                  border: '1px solid #e0e0e0'
                }} />
              </div>
              
              <span style={{ 
                fontSize: 'var(--font-size-sm)',
                color: preference === 'mix' ? '#ffffff' : '#cccccc',
                fontWeight: preference === 'mix' ? '700' : '500',
                transition: 'all 0.3s ease',
                textShadow: preference === 'mix' ? '0 0 8px var(--accent-color)' : 'none'
              }}>
                Mix it Up
              </span>
            </div>
            
            <div style={{ 
              fontSize: 'var(--font-size-sm)',
              color: '#ffffff',
              fontWeight: '600',
              padding: 'var(--space-3)',
              background: preference === 'bearish' ? 'rgba(var(--accent-color-rgb), 0.15)' : 'rgba(255, 255, 255, 0.1)',
              borderRadius: 'var(--border-radius)',
              border: `1px solid ${preference === 'bearish' ? 'var(--accent-color)' : '#666666'}`,
              textAlign: 'center',
              textShadow: preference === 'bearish' ? '0 0 8px var(--accent-color)' : 'none',
              marginBottom: 'var(--space-4)'
            }}>
              {preference === 'bearish' 
                ? '🐻 Currently showing only Bearish NFTs'
                : '🎨 Currently showing NFTs from all collections'
              }
            </div>
            
            {/* Go Button */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleGoClick}
                style={{
                  background: 'linear-gradient(135deg, var(--accent-color) 0%, #00d4aa 100%)',
                  color: '#000000',
                  border: '2px solid var(--accent-color)',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 20px rgba(var(--accent-color-rgb), 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  minWidth: '80px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(var(--accent-color-rgb), 0.7)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, #00ff88 0%, var(--accent-color) 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--accent-color-rgb), 0.5)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, #00d4aa 100%)';
                }}
              >
                Go
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{
        background: '#2a2a2a',
        borderBottom: '1px solid #333333',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(42, 42, 42, 0.95)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-6)',
          maxWidth: 'var(--max-width)',
          margin: '0 auto'
        }}>
          
          {/* LEFT SIDE: Logo + Name + About */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {/* Logo */}
            <div style={{
              width: '40px',
              height: '40px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                src="/Taste-Machine-Monster-Abstract-Green-150x150.png" 
                alt="Taste Machine Logo"
                className="status-logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              {/* Fallback TM logo */}
              <div style={{
                width: '40px',
                height: '40px',
                background: 'var(--color-black)',
                color: 'var(--color-white)',
                borderRadius: 'var(--border-radius-sm)',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: 'var(--font-size-sm)',
                letterSpacing: '-0.05em'
              }}>
                TM
              </div>
            </div>
            
            {/* Name */}
            <span style={{
              fontWeight: '800',
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-white)',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase'
            }}>
              TASTE MACHINE
            </span>
            
            {/* Navigation Links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* About */}
              <span
                onClick={() => setShowAboutPopup(true)}
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-white)';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-300)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                About
              </span>
              
              {/* How */}
              <span
                onClick={() => setShowHowPopup(true)}
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-white)';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-300)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                How
              </span>
              
              {/* Why */}
              <span
                onClick={() => setShowWhyPopup(true)}
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-white)';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-300)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Why
              </span>
              
              {/* Collections */}
              <span
                onClick={() => setShowCollectionsPopup(true)}
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-white)';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-300)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Collections
              </span>
            </div>
          </div>

          {/* RIGHT SIDE: Actions + Stats + Wallet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {isConnected && user ? (
              <>


                {/* Stats - Clean Text Style */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                  {/* XP */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)',
                    position: 'relative'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      color: '#ff9500'
                    }}>
                      ⚡
                    </span>
                    <span style={{ 
                      fontWeight: '600', 
                      color: 'var(--color-white)',
                      fontSize: 'var(--font-size-xs)'
                    }}>
                      {user.xp || 0} XP
                    </span>
                    
                    {/* XP Floating Notification */}
                    {showXpFloatingNotification && (
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: '#ff9500',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '600',
                        textShadow: '0 0 12px rgba(255, 149, 0, 0.8), 0 0 24px rgba(255, 149, 0, 0.6)',
                        animation: 'floatUpAndFade 3s ease-out forwards',
                        zIndex: 1001,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap'
                      }}>
                        +{xpFloatingNotificationAmount} XP
                      </div>
                    )}
                  </div>
                  
                  {/* Licks (Interactive) */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)',
                    position: 'relative'
                  }}>
                    <div 
                      style={{ 
                        position: 'relative',
                        cursor: canClaim ? 'pointer' : 'default'
                      }}
                      onClick={canClaim ? () => {
                        console.log('🖱️ Lick icon clicked, showing popup');
                        setShowLickPopup(true);
                        setPopupStage('initial');
                      } : undefined}
                    >
                    <img
                      src="/lick-icon.png"
                        alt="Licks"
                      style={{
                        width: '22px',
                          height: '22px',
                          transition: 'transform 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (canClaim) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      />
                      {/* Pulsing Red Dot for Daily Claims */}
                      {canClaim && !hasClaimedToday && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#ff0000',
                            borderRadius: '50%',
                            animation: 'redDotPulse 2s ease-in-out infinite',
                            boxShadow: '0 0 6px rgba(255, 0, 0, 0.8)'
                          }}
                        />
                      )}
                    </div>
                    <span style={{ 
                      fontWeight: '600',
                      color: 'var(--color-white)',
                      fontSize: 'var(--font-size-xs)'
                    }}>
                      {formatLicks(user.available_votes || 0)}
                    </span>
                    
                    {/* Floating Notification */}
                    {showFloatingNotification && (
                      <div style={{
                        position: 'absolute',
                        bottom: '10px', // Much lower, just above the Lick count
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: 'var(--color-white)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '600',
                        textShadow: '0 0 12px rgba(255, 255, 255, 0.8), 0 0 24px rgba(255, 255, 255, 0.6)',
                        animation: 'floatUpAndFade 3s ease-out forwards',
                        zIndex: 1001,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap'
                      }}>
                        +{floatingNotificationAmount}
                      </div>
                    )}
                  </div>

                  {/* Add Licks Button - Properly positioned */}
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🛒 [FINAL] Add Licks button clicked! Version 6.0');
                      
                      // Check if user has active session
                      const hasSession = sessionStatus?.hasActiveSession && !sessionStatus?.isExpired;
                      
                      if (!hasSession) {
                        console.log('🛒 No active session - creating session first via wallet');
                        try {
                          const success = await createSession();
                          if (success) {
                            console.log('✅ Session created successfully, now showing purchase modal');
                            setShowPurchaseModal(true);
                          } else {
                            console.log('❌ Session creation failed');
                          }
                        } catch (error) {
                          console.error('❌ Error creating session:', error);
                        }
                      } else {
                        console.log('✅ Session already active, showing purchase modal directly');
                        setShowPurchaseModal(true);
                      }
                    }}
                    style={{
                      marginLeft: 'var(--space-2)',
                      padding: 'var(--space-1) var(--space-2)',
                      background: 'var(--color-green)',
                      border: '2px solid var(--color-green)',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: '600',
                      color: 'var(--color-black)',
                      transition: 'all 0.2s ease',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#16a34a';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(34, 197, 94, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--color-green)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.3)';
                    }}
                    title="Purchase more Licks to continue voting"
                  >
                    Add Licks
                  </button>

                </div>

                {/* Wallet Connection */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      background: showWalletGlow ? '#1f3a1f' : '#2a2a2a', // Green tint when glowing
                      border: showWalletGlow ? '1px solid var(--color-green)' : '1px solid #444444',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '500',
                      color: 'var(--color-white)', // White text for dark theme
                      boxShadow: showWalletGlow 
                        ? '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3)' 
                        : 'none',
                      animation: showWalletGlow ? 'walletGlow 3s ease-out' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#333333';
                      e.currentTarget.style.borderColor = '#555555';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#2a2a2a';
                      e.currentTarget.style.borderColor = '#444444';
                    }}
                  >
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: isSessionActive 
                        ? (needsRenewal ? '#f59e0b' : 'var(--color-green)')
                        : '#dc2626',
                      borderRadius: '50%',
                      boxShadow: isSessionActive 
                        ? (needsRenewal ? '0 0 6px #f59e0b' : '0 0 6px var(--color-green)')
                        : '0 0 6px #dc2626'
                    }}></div>
                    {formatAddress(address || '')}
                    <span style={{ fontSize: '10px', color: 'var(--color-grey-300)' }}>▼</span>
                  </button>

                  {/* GUGO Floating Notification - positioned over wallet button */}
                  {showWalletGlow && (
                    <div style={{
                      position: 'absolute',
                      top: '-40px',
                      right: '0px',
                      color: 'var(--color-green)',
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: '700',
                      textShadow: '0 0 12px rgba(34, 197, 94, 0.8), 0 0 24px rgba(34, 197, 94, 0.6)',
                      animation: 'floatUpAndFade 3s ease-out forwards',
                      zIndex: 1002,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap'
                    }}>
                      +{walletGlowAmount} GUGO 💰
                    </div>
                  )}

                  {showWalletDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 'var(--space-2)',
                      background: '#2a2a2a', // Dark background to match theme
                      border: '1px solid #444444', // Dark border
                      borderRadius: 'var(--border-radius)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', // Darker shadow
                      minWidth: '200px',
                      zIndex: 101
                    }}>
                      <div style={{ padding: 'var(--space-3)' }}>
                        <div className="text-caption" style={{ 
                          marginBottom: 'var(--space-2)',
                          color: 'var(--color-grey-300)' // Lighter text for dark background
                        }}>
                          Connected Wallet
                        </div>
                        <div style={{ 
                          fontFamily: 'monospace',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-grey-400)', // Lighter grey for dark background
                          marginBottom: 'var(--space-3)'
                        }}>
                          {address}
                        </div>
                        
                        {/* Balances Section */}
                        <div style={{ 
                          marginBottom: 'var(--space-3)',
                          paddingBottom: 'var(--space-3)',
                          borderBottom: '1px solid #444444' // Darker border for dark theme
                        }}>
                          <div className="text-caption" style={{ 
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-grey-300)' // Lighter text for dark background
                          }}>
                            Balances
                  </div>

                  {/* FGUGO Balance */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                            gap: 'var(--space-2)',
                            marginBottom: 'var(--space-2)'
                  }}>
                    <div style={{
                              width: '18px',
                              height: '18px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--color-green-light)'
                    }}>
                      <img
                        src="/faux-gugo.jpg?v=1"
                        alt="FGUGO"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const container = target.parentElement;
                          if (container) {
                                    container.innerHTML = '<span style="font-size: 10px; font-weight: 700; color: var(--color-green);">G</span>';
                          }
                        }}
                      />
                    </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontWeight: '600',
                                color: 'var(--color-white)', // White text for dark background
                                fontSize: 'var(--font-size-sm)'
                              }}>
                                {loading ? (
                                  '⏳ Loading...'
                                ) : eligibility?.gugoBalance && !isNaN(parseFloat(eligibility.gugoBalance.formattedBalance)) ? (
                                  `${parseFloat(eligibility.gugoBalance.formattedBalance).toFixed(1)} FGUGO`
                                ) : (
                                  '0.0 FGUGO'
                                )}
                              </div>
                              <div style={{ 
                        fontSize: '9px',
                        fontWeight: '500',
                        color: '#dc2626',
                        textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                      }}>
                        Testnet
                              </div>
                    </div>
                  </div>

                  {/* ETH Balance */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)'
                          }}>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-white)', // White circle background
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px' // Small padding inside the circle
                  }}>
                    <img
                      src="/ethereum-logo.svg"
                      alt="ETH"
                      style={{
                                  width: '14px', // Slightly smaller to fit inside circle
                                  height: '14px'
                                }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontWeight: '600',
                                color: 'var(--color-white)', // White text for dark background
                                fontSize: 'var(--font-size-sm)'
                              }}>
                                {loading ? (
                                  '⏳ Loading...'
                                ) : eligibility?.ethBalance && !isNaN(parseFloat(eligibility.ethBalance.formattedBalance)) ? (
                                  `${parseFloat(eligibility.ethBalance.formattedBalance).toFixed(4)} ETH`
                                ) : (
                                  '0.0000 ETH'
                                )}
                              </div>
                              <div style={{ 
                        fontSize: '9px',
                        fontWeight: '500',
                        color: '#dc2626',
                        textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                      }}>
                        Testnet
                              </div>
                    </div>
                  </div>
                </div>

                        {/* Session Management Section */}
                        <div style={{ 
                          marginBottom: 'var(--space-3)',
                          paddingBottom: 'var(--space-3)',
                          borderBottom: '1px solid #444444'
                        }}>
                          <div className="text-caption" style={{ 
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-grey-300)'
                          }}>
                            Gaming Session
                          </div>
                          
                          {isSessionActive ? (
                            <div>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 'var(--space-2)',
                                marginBottom: 'var(--space-2)'
                              }}>
                                <div style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: needsRenewal ? '#f59e0b' : 'var(--color-green)',
                                  boxShadow: needsRenewal ? '0 0 8px #f59e0b' : '0 0 8px var(--color-green)'
                                }}></div>
                                <div style={{ 
                                  fontSize: 'var(--font-size-sm)',
                                  color: 'var(--color-white)',
                                  fontWeight: '600'
                                }}>
                                  {needsRenewal ? 'Expires Soon' : 'Active'}
                                </div>
                                <div style={{ 
                                  fontSize: 'var(--font-size-xs)',
                                  color: 'var(--color-grey-400)'
                                }}>
                                  ({formatTimeRemaining()})
                                </div>
                              </div>
                              
                              {/* Removed money amounts and emojis per user request */}
                              
                              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                {needsRenewal && (
                                  <button
                                    onClick={renewSession}
                                    disabled={isCreatingSession}
                                    style={{
                                      flex: 1,
                                      padding: 'var(--space-1) var(--space-2)',
                                      background: '#f59e0b',
                                      border: 'none',
                                      borderRadius: 'var(--border-radius-sm)',
                                      cursor: isCreatingSession ? 'not-allowed' : 'pointer',
                                      fontSize: 'var(--font-size-xs)',
                                      color: '#000',
                                      fontWeight: '600',
                                      opacity: isCreatingSession ? 0.7 : 1
                                    }}
                                  >
                                    {isCreatingSession ? 'Renewing...' : 'Renew'}
                                  </button>
                                )}
                                
                                <button
                                  onClick={endSession}
                                  style={{
                                    flex: 1,
                                    padding: 'var(--space-1) var(--space-2)',
                                    background: 'transparent',
                                    border: '1px solid #555555',
                                    borderRadius: 'var(--border-radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-grey-400)',
                                    fontWeight: '500'
                                  }}
                                >
                                  End
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 'var(--space-2)',
                                marginBottom: 'var(--space-2)'
                              }}>
                                <div style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: '#dc2626',
                                  boxShadow: '0 0 8px #dc2626'
                                }}></div>
                                <div style={{ 
                                  fontSize: 'var(--font-size-sm)',
                                  color: 'var(--color-white)',
                                  fontWeight: '600'
                                }}>
                                  No Session
                                </div>
                              </div>
                              
                              <div style={{ 
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-grey-400)',
                                marginBottom: 'var(--space-2)'
                              }}>
                                Create a secure session to play without signing every action.
                                <br />
                                <strong style={{ color: 'var(--color-green)' }}>
                                  Spend up to 500,000 {isConnected && address ? 'FGUGO' : 'GUGO'} seamlessly!
                                </strong>
                              </div>
                              
                              <button
                                onClick={createSession}
                                disabled={isCreatingSession}
                                style={{
                                  width: '100%',
                                  padding: 'var(--space-2)',
                                  background: 'var(--color-green)',
                                  border: 'none',
                                  borderRadius: 'var(--border-radius-sm)',
                                  cursor: isCreatingSession ? 'not-allowed' : 'pointer',
                                  fontSize: 'var(--font-size-sm)',
                                  color: '#000',
                                  fontWeight: '700',
                                  opacity: isCreatingSession ? 0.7 : 1,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}
                              >
                                {isCreatingSession ? 'Creating Session...' : 'Create Gaming Session'}
                              </button>
                              
                              {sessionError && (
                                <div style={{ 
                                  fontSize: 'var(--font-size-xs)',
                                  color: '#dc2626',
                                  marginTop: 'var(--space-2)',
                                  textAlign: 'center'
                                }}>
                                  {sessionError}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            disconnect();
                            setShowWalletDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: 'var(--space-2)',
                            background: '#333333', // Darker button background
                            border: '1px solid #555555', // Dark border
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-white)', // White text
                            transition: 'all var(--transition-base)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#444444';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#333333';
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ConnectButton 
                  label="Connect Wallet"
                  showBalance={false}
                  chainStatus="none"
                  accountStatus="avatar"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* About Popup */}
      {showAboutPopup && <AboutPopup />}
      
      {/* How Popup */}
      {showHowPopup && <HowPopup />}
      
      {/* Why Popup */}
      {showWhyPopup && <WhyPopup />}
      
      {/* Collections Popup */}
      {showCollectionsPopup && <CollectionsPopup />}
      
      {/* Lick Claiming Popup */}
      {showLickPopup && (
        <>
          {/* Click-outside overlay to close popup */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              background: 'transparent'
            }}
            onClick={() => {
              console.log('🖱️ Clicked outside popup, closing');
              
              // Award votes and show floating notification if we just claimed
              if (popupStage === 'result' && finalVotes > 0 && address) {
                // Award the votes now
                claimFreeVotes(address, finalVotes).then(success => {
                  if (success) {
                    refreshUser();
                    console.log(`🎁 Claimed ${finalVotes} Licks!`);
                  }
                }).catch(error => {
                  console.error('Error claiming Licks:', error);
                });
                
                setFloatingNotificationAmount(finalVotes);
                setShowFloatingNotification(true);
                
                // Hide floating notification after 3 seconds
                setTimeout(() => {
                  setShowFloatingNotification(false);
                }, 3000);
              }
              
              // Close popup and reset
              setShowLickPopup(false);
              setPopupStage('initial');
              setCurrentMultiplier(1);
              setFinalVotes(0);
              setCongratsWord('Nice!');
            }}
          />
          <LickClaimPopup />
        </>
      )}
      
      {/* Licks Purchase Modal - Independent of Lick popup */}
      {console.log('🛒 [FINAL] StatusBar rendering LicksPurchaseModal with isOpen:', showPurchaseModal, 'at timestamp:', Date.now())}
      <LicksPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => {
          console.log('🛒 Modal onClose called');
          setShowPurchaseModal(false);
        }}
        onPurchaseComplete={async (licksCount) => {
          console.log(`🎉 Purchase completed: ${licksCount} Licks`);
          // Trigger Licks animation
          triggerLicksAnimation(licksCount);
          
          // Robust retry logic for balance refresh
          const refreshWithRetry = async (attempt = 1, maxAttempts = 5) => {
            console.log(`🔄 Refreshing user data (attempt ${attempt}/${maxAttempts})...`);
            
            try {
              await refreshUser();
              console.log('✅ User data refreshed successfully');
              return true;
            } catch (error) {
              console.error(`❌ Refresh attempt ${attempt} failed:`, error);
              
              if (attempt < maxAttempts) {
                // Exponential backoff: wait longer between retries
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
                
                setTimeout(() => {
                  refreshWithRetry(attempt + 1, maxAttempts);
                }, delay);
              } else {
                console.error('❌ All refresh attempts failed. User may need to refresh the page manually.');
              }
              return false;
            }
          };
          
          // Initial delay to ensure database update completes
          console.log('⏳ Waiting for database update to complete...');
          setTimeout(() => {
            refreshWithRetry();
          }, 2000); // 2 second initial delay
        }}
      />
    </>
  );
});

StatusBar.displayName = 'StatusBar';

export default StatusBar;
