"use client"

import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '../hooks/useAuth';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useSessionKey } from '../hooks/useSessionKey';
import { useCollectionPreference } from '../hooks/useCollectionPreference';
import { SessionAction } from '../../lib/session-keys';
import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import FavoritesGallery from './FavoritesGallery';
import { canClaimFreeVotes, claimFreeVotes } from '../../lib/auth';
import { LicksPurchaseModal } from './LicksPurchaseModal';
import { DailyLicksModal } from './DailyLicksModal';
import { QuickLicksButton } from './QuickLicksButton';
import { MobileMenu } from './MobileMenu';
import Leaderboard from './Leaderboard';
import PrizeProgressBar from './PrizeProgressBar';

interface StatusBarProps {
  onConnectWallet: () => void;
  userVoteCount?: number; // Current user vote count for progress bar
}

export interface StatusBarRef {
  refreshUserData: () => void;
  triggerXpAnimation: (xpAmount: number) => void;
  triggerWalletGlow: (gugoAmount: number) => void;
  triggerLicksAnimation: (licksAmount: number) => void;
  openPurchaseModal: () => void;
}

const StatusBar = forwardRef<StatusBarRef, StatusBarProps>(({ onConnectWallet, userVoteCount = 0 }, ref) => {
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
    triggerLicksAnimation,
    openPurchaseModal: () => setShowPurchaseModal(true)
  }), [refreshUser]);
  const { eligibility, refreshBalance } = useTokenBalance();
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showAboutPopup, setShowAboutPopup] = useState(false);
  const [showHowPopup, setShowHowPopup] = useState(false);
  const [showWhyPopup, setShowWhyPopup] = useState(false);

  const [claimingVotes, setClaimingVotes] = useState(false);
  const [showLickPopup, setShowLickPopup] = useState(false);

  const [hasClaimedToday, setHasClaimedToday] = useState(false);
  const [showFloatingNotification, setShowFloatingNotification] = useState(false);
  const [floatingNotificationAmount, setFloatingNotificationAmount] = useState(0);
  const [showXpFloatingNotification, setShowXpFloatingNotification] = useState(false);
  const [xpFloatingNotificationAmount, setXpFloatingNotificationAmount] = useState(0);
  const [showFavoritesGallery, setShowFavoritesGallery] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [unclaimedRewards, setUnclaimedRewards] = useState<any[]>([]);
  const [claimingRewards, setClaimingRewards] = useState(false);
  const [showWalletGlow, setShowWalletGlow] = useState(false);
  const [walletGlowAmount, setWalletGlowAmount] = useState(0);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  


  const walletDropdownRef = useRef<HTMLDivElement>(null);


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
    setShowFloatingNotification(false);
    setFloatingNotificationAmount(0);
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

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Click outside handler for wallet dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target as Node)) {
        setShowWalletDropdown(false);
      }
    };

    if (showWalletDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWalletDropdown]);



  // About popup component
  const AboutPopup = () => createPortal(
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
      zIndex: 999999,
      padding: 'var(--space-4)',
      paddingTop: '80px',
      isolation: 'isolate'
    }} onClick={() => setShowAboutPopup(false)}>
      <div style={{
        background: 'var(--dynamic-bg-color)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative',
        border: '1px solid var(--dynamic-text-color, #444444)'
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
            color: 'var(--dynamic-text-color, var(--color-white))'
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
              color: 'var(--dynamic-text-color, var(--color-white))',
              marginBottom: 'var(--space-1)',
              textTransform: 'none'
            }}>
              Proof of Aesthetic<sup style={{ fontSize: '0.7em' }}>™</sup>
            </h2>
          </div>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            We're building on-chain aesthetic scores for NFTs.
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            Not just to reward what's rare — but to help great art get seen.
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            You'll get free Licks (votes) every day — enough to play and start shaping the signal.
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            To go deeper, earn more, and unlock bigger rewards, you can spend GUGO or ETH to buy more Licks (about $0.02 each).
          </p>
          
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            That small stake helps keep the system clean by filtering out bots, spam, and low-effort noise.
          </p>
          


          {/* Whitepaper Link */}
          <div style={{ paddingTop: 'var(--space-4)' }}>
          <a
            href="https://docs.google.com/document/d/1Lp6qZ02UjyVDDDGf16GuBdUECcop87ciVP061IcJA3U/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--dynamic-text-color, #e5e5e5)',
              textDecoration: 'none',
                fontSize: 'var(--font-size-sm)',
              fontWeight: '400',
                transition: 'color 0.2s ease',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid rgba(229, 229, 229, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-white))';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#e5e5e5';
                e.currentTarget.style.borderColor = 'rgba(229, 229, 229, 0.2)';
            }}
          >
            <span>White Paper Overview</span>
            <span>↗</span>
          </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // How popup component
  const HowPopup = () => createPortal(
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
      zIndex: 999999,
      padding: 'var(--space-4)',
      paddingTop: '80px',
      isolation: 'isolate'
    }} onClick={() => setShowHowPopup(false)}>
      <div style={{
        background: 'var(--dynamic-bg-color)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative',
        border: '1px solid var(--dynamic-text-color, #444444)'
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
            color: 'var(--dynamic-text-color, var(--color-white))'
          }}
        >
          ×
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '800', 
                            color: 'var(--dynamic-text-color, var(--color-white))',
            marginBottom: 'var(--space-2)',
            textTransform: 'none'
          }}>
            Share your taste.
          </h2>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            You'll be shown two NFTs — choose the one that hits harder.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            If something really slaps, hit the 🔥.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            We call votes Licks, and you can always get more.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );

  // Why popup component
  const WhyPopup = () => createPortal(
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
      zIndex: 999999,
      padding: 'var(--space-4)',
      paddingTop: '80px',
      isolation: 'isolate'
    }} onClick={() => setShowWhyPopup(false)}>
      <div style={{
        background: 'var(--dynamic-bg-color)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative',
        border: '1px solid var(--dynamic-text-color, #444444)'
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
            color: 'var(--dynamic-text-color, var(--color-white))'
          }}
        >
          ×
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '800', 
                            color: 'var(--dynamic-text-color, var(--color-white))',
            marginBottom: 'var(--space-2)',
            textTransform: 'none'
          }}>
            We love art.
          </h2>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            In a space obsessed with rarity, we built a way to measure what actually looks good.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--dynamic-text-color, #e5e5e5)' }}>
            Soon, you'll be able to factor aesthetic scores into how NFTs are valued.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );



  return (
    <>
      {/* CSS for gold shimmer animation */}
      <style>{`
        @keyframes goldShimmer {
          0% {
            left: -100%;
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          25% {
            left: 100%;
            opacity: 1;
          }
          33% {
            opacity: 0;
          }
          100% {
            left: 100%;
            opacity: 0;
          }
        }
      `}</style>
      
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(8px)',
        backgroundColor: 'var(--dynamic-bg-color-dark, rgba(30, 30, 30, 0.95))'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: 'var(--space-1) 5vw',
          maxWidth: 'none',
          margin: '0'
        }}>
          
          {/* MOBILE: Hamburger + Logo + Wallet */}
          {isMobile ? (
            <>
              {/* Mobile Left: Hamburger Menu */}
              <button
                onClick={() => setShowMobileMenu(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dynamic-text-color, #e5e5e5)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--dynamic-button-hover-bg, rgba(255,255,255,0.1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Open menu"
              >
                ☰
              </button>

              {/* Mobile Center: Logo + Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
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
                  <div style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'var(--dynamic-text-color, var(--color-black))',
                    WebkitMask: 'url(/Taste-Machine-Monster-Abstract-Green-150x150.png) no-repeat center/contain',
                    mask: 'url(/Taste-Machine-Monster-Abstract-Green-150x150.png) no-repeat center/contain',
                    display: 'none'
                  }} />
                </div>
                <span style={{
                  fontFamily: 'var(--font-family-primary)',
                  fontSize: '16px',
                  fontWeight: '700',
                  color: 'var(--dynamic-text-color, var(--color-white))',
                  letterSpacing: '-0.02em'
                }}>
                  TASTE MACHINE
                </span>
              </div>

              {/* Mobile Right: Wallet Connection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {isConnected && user ? (
                  <div ref={walletDropdownRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: 'var(--space-1) var(--space-2)',
                        background: 'var(--dynamic-bg-color-light, rgba(255, 255, 255, 0.1))',
                        border: `1px solid var(--dynamic-text-color, var(--color-white))`,
                        borderRadius: 'var(--border-radius)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--dynamic-text-color, var(--color-white))',
                        fontWeight: '600',
                        fontFamily: 'var(--font-family-mono)',
                        transition: 'all var(--transition-base)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-green)',
                        boxShadow: '0 0 6px var(--color-green)'
                      }}></div>
                      {formatAddress(address || '')}
                      <span style={{ fontSize: '8px', color: 'var(--dynamic-text-color)' }}>▼</span>
                    </button>
                    
                    {/* Mobile wallet dropdown (same as desktop) */}
                    {showWalletDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 'var(--space-2)',
                        background: 'var(--dynamic-bg-color)',
                        border: '1px solid var(--dynamic-text-color, #444444)',
                        borderRadius: 'var(--border-radius)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                        minWidth: '200px',
                        zIndex: 101
                      }}>
                        <div style={{ padding: 'var(--space-2)' }}>
                          <div style={{ 
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--dynamic-text-color-secondary, #888888)',
                            marginBottom: 'var(--space-1)'
                          }}>
                            Connected Wallet
                          </div>
                          <div style={{ 
                            fontFamily: 'monospace',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--dynamic-text-color, #e5e5e5)',
                            marginBottom: 'var(--space-2)',
                            wordBreak: 'break-all'
                          }}>
                            {address}
                          </div>
                          <button
                            onClick={() => {
                              disconnect();
                              setShowWalletDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: 'var(--space-1)',
                              background: 'var(--dynamic-button-bg, #333333)',
                              border: '1px solid var(--dynamic-border-color, #555555)',
                              borderRadius: 'var(--border-radius-sm)',
                              cursor: 'pointer',
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--dynamic-text-color, var(--color-white))',
                              transition: 'all var(--transition-base)'
                            }}
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <ConnectButton 
                    label="Connect"
                    showBalance={false}
                    chainStatus="none"
                    accountStatus="avatar"
                  />
                )}
              </div>
            </>
          ) : (
            <>
              {/* DESKTOP: Original Layout */}
              {/* LEFT SIDE: Logo + Name + About */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: '10px' }}>
            {/* Logo */}
            <div style={{
              width: '32px',
              height: '32px',
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
                width: '32px',
                height: '32px',
                background: 'var(--color-black)',
                color: 'var(--dynamic-text-color, var(--color-white))',
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
              fontFamily: 'var(--font-family-primary)',
              fontWeight: '300',
              fontSize: 'var(--font-size-2xl)',
              color: 'var(--dynamic-text-color, var(--color-white))',
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
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-white))';
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
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-white))';
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
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-white))';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-300)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Why
              </span>
              
              {/* Leaderboard */}
              <span
                data-tour="leaderboard"
                onClick={() => setShowLeaderboard(true)}
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-white))';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-300)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Leaderboard
              </span>
              
              {/* Fire List */}
              <span
                data-tour="fire-list"
                onClick={() => {
                  console.log('🔥 Opening Fire List...');
                  setShowFavoritesGallery(true);
                }}
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  color: 'var(--color-grey-300)',
                  transition: 'all var(--transition-base)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-white))';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-grey-300)';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Fire List
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
                  <div 
                    data-tour="xp-area"
                    style={{ 
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
                      color: 'var(--dynamic-text-color, var(--color-white))',
                      fontSize: 'var(--font-size-sm)'
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
                  
                  {/* Prize Progress Bar */}
                  <PrizeProgressBar 
                    currentVotes={userVoteCount}
                    userXP={user.xp || 0}
                  />
                  
                  {/* Licks (Interactive) */}
                  <div 
                    data-tour="licks-area"
                    style={{ 
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
                        console.log('🖱️ Lick icon clicked, showing modal');
                        setShowLickPopup(true);
                      } : undefined}
                    >
                    <img
                      src="/lick-icon.png"
                        alt="Licks"
                      style={{
                        width: '33px',
                          height: '33px',
                          transition: 'transform 0.2s ease',
                          marginTop: '5px'
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
                            top: '3px', // Moved down 5px from -2px
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
                      color: '#ffffff',
                      fontSize: 'var(--font-size-sm)'
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
                        color: 'var(--dynamic-text-color, var(--color-white))',
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

                  {/* Simplified Add Licks Button */}
                  <QuickLicksButton
                    variant="primary"
                    label="Add Licks"
                    onPurchaseComplete={(licksCount) => {
                      console.log(`🎉 Purchased ${licksCount} Licks from StatusBar`);
                      // Trigger refresh
                      refreshUser();
                    }}
                    style={{
                      marginLeft: 'var(--space-2)',
                      fontSize: 'var(--font-size-xs)',
                      padding: 'var(--space-1) var(--space-2)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  />

                </div>

                {/* Wallet Connection */}
                <div ref={walletDropdownRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-1) var(--space-2)',
                      background: showWalletGlow ? '#1f3a1f' : 'var(--dynamic-bg-color)', // Use dynamic background color as background
                      border: '1px solid var(--dynamic-text-color)', // Add border with dynamic text color
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '500',
                      color: 'var(--dynamic-text-color)', // Use dynamic text color as text color
                      boxShadow: showWalletGlow 
                        ? '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3)' 
                        : 'none',
                      animation: showWalletGlow ? 'walletGlow 3s ease-out' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!showWalletGlow) {
                        e.currentTarget.style.opacity = '0.8';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
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
                    <span style={{ fontSize: '10px', color: 'var(--dynamic-text-color)' }}>▼</span>
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
                      background: 'var(--dynamic-bg-color)', // Dark background to match theme
                      border: '1px solid var(--dynamic-text-color, #444444)', // Dark border
                      borderRadius: 'var(--border-radius)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', // Darker shadow
                      minWidth: '200px',
                      zIndex: 101
                    }}>
                      <div style={{ padding: 'var(--space-3)' }}>
                        <div className="text-caption" style={{ 
                          marginBottom: 'var(--space-2)',
                          color: 'var(--dynamic-text-color-secondary, #888888)'
                        }}>
                          Connected Wallet
                        </div>
                        <div style={{ 
                          fontFamily: 'monospace',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--dynamic-text-color, #e5e5e5)',
                          marginBottom: 'var(--space-3)'
                        }}>
                          {address}
                        </div>
                        
                        {/* Balances Section */}
                        <div style={{ 
                          marginBottom: 'var(--space-3)',
                          paddingBottom: 'var(--space-3)',
                          borderBottom: '1px solid var(--dynamic-border-color, #444444)'
                        }}>
                          <div className="text-caption" style={{ 
                            marginBottom: 'var(--space-2)',
                            color: 'var(--dynamic-text-color-secondary, #888888)'
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
                                color: 'var(--dynamic-text-color, var(--color-white))', // White text for dark background
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
                        color: 'var(--dynamic-accent-color, #dc2626)',
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
                                color: 'var(--dynamic-text-color, var(--color-white))', // White text for dark background
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
                        color: 'var(--dynamic-accent-color, #dc2626)',
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
                          borderBottom: '1px solid var(--dynamic-border-color, #444444)'
                        }}>
                          <div className="text-caption" style={{ 
                            marginBottom: 'var(--space-2)',
                            color: 'var(--dynamic-text-color-secondary, #888888)'
                          }}>
                            Secure Session
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
                                  color: 'var(--dynamic-text-color, var(--color-white))',
                                  fontWeight: '600'
                                }}>
                                  {needsRenewal ? 'Expires Soon' : 'Active'}
                                </div>
                                <div style={{ 
                                  fontSize: 'var(--font-size-xs)',
                                  color: 'var(--dynamic-text-color-secondary, #888888)'
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
                                    border: '1px solid var(--dynamic-border-color, #555555)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--dynamic-text-color-secondary, #888888)',
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
                                  color: 'var(--dynamic-text-color, var(--color-white))',
                                  fontWeight: '600'
                                }}>
                                  No Session
                                </div>
                              </div>
                              
                              <div style={{ 
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--dynamic-text-color-secondary, #888888)',
                                marginBottom: 'var(--space-2)'
                              }}>
                                Start a secure session so you don't have to sign every time you vote, buy, or win.
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
                                {isCreatingSession ? 'Creating Session...' : 'CREATE SESSION'}
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
                            background: 'var(--dynamic-button-bg, #333333)',
                            border: '1px solid var(--dynamic-border-color, #555555)',
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--dynamic-text-color, var(--color-white))',
                            transition: 'all var(--transition-base)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--dynamic-button-hover-bg, #444444)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--dynamic-button-bg, #333333)';
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
            </>
          )}
        </div>
      </div>



      {/* About Popup */}
      {showAboutPopup && <AboutPopup />}
      
      {/* How Popup */}
      {showHowPopup && <HowPopup />}
      
      {/* Why Popup */}
      {showWhyPopup && <WhyPopup />}
      

      
      {/* Daily Licks Modal */}
      <DailyLicksModal
        isOpen={showLickPopup}
        onClose={() => setShowLickPopup(false)}
        address={address}
        onSuccess={(licksAmount) => {
          refreshUser();
          setFloatingNotificationAmount(licksAmount);
          setShowFloatingNotification(true);
          
          // Hide floating notification after 3 seconds
          setTimeout(() => {
            setShowFloatingNotification(false);
          }, 3000);
        }}
      />
      
      {/* Licks Purchase Modal - Independent of Lick popup */}
      <LicksPurchaseModal
        isOpen={showPurchaseModal}
        onClose={useCallback(() => {
          console.log('🛒 Modal onClose called');
          setShowPurchaseModal(false);
        }, [])}
        onPurchaseComplete={useCallback(async (licksCount: number) => {
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
        }, [triggerLicksAnimation, refreshUser])}
      />

      {/* Favorites Gallery Modal */}
      <FavoritesGallery
        isOpen={showFavoritesGallery}
        onClose={useCallback(() => setShowFavoritesGallery(false), [])}
      />

      {/* Leaderboard Modal */}
      <Leaderboard
        isOpen={showLeaderboard}
        onClose={useCallback(() => setShowLeaderboard(false), [])}
      />

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        user={user}
        userVoteCount={userVoteCount}
        canClaim={canClaim}
        onShowAboutPopup={() => {
          setShowMobileMenu(false);
          setShowAboutPopup(true);
        }}
        onShowHowPopup={() => {
          setShowMobileMenu(false);
          setShowHowPopup(true);
        }}
        onShowWhyPopup={() => {
          setShowMobileMenu(false);
          setShowWhyPopup(true);
        }}
        onShowFavoritesGallery={() => {
          setShowMobileMenu(false);
          setShowFavoritesGallery(true);
        }}
        onShowLeaderboard={() => {
          setShowMobileMenu(false);
          setShowLeaderboard(true);
        }}
        onShowPurchaseModal={() => {
          setShowMobileMenu(false);
          setShowPurchaseModal(true);
        }}
        onClaimFreeVotes={async () => {
          setShowMobileMenu(false);
          if (address) {
            setClaimingVotes(true);
            try {
              const success = await claimFreeVotes(address, 10);
              if (success) {
                refreshUser();
                console.log('🎁 Claimed 10 free Licks!');
              }
            } catch (error) {
              console.error('Error claiming free votes:', error);
            } finally {
              setClaimingVotes(false);
            }
          }
        }}
        onDisconnect={() => {
          setShowMobileMenu(false);
          disconnect();
        }}
        isSessionActive={isSessionActive}
        sessionStatus={sessionStatus.toString()}
        formatTimeRemaining={formatTimeRemaining}
      />
    </>
  );
});

StatusBar.displayName = 'StatusBar';

export default StatusBar;
