"use client"

import { useAccount, useDisconnect } from 'wagmi';
import { useAuth } from '../hooks/useAuth';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useState } from 'react';
import { canClaimFreeVotes, claimFreeVotes } from '../../lib/auth';

interface StatusBarProps {
  onConnectWallet: () => void;
}

export default function StatusBar({ onConnectWallet }: StatusBarProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { user, loading, refreshUser } = useAuth();
  const { eligibility } = useTokenBalance();
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showAboutPopup, setShowAboutPopup] = useState(false);
  const [showHowPopup, setShowHowPopup] = useState(false);
  const [showWhyPopup, setShowWhyPopup] = useState(false);
  const [claimingVotes, setClaimingVotes] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (balance: string | undefined) => {
    if (!balance) return '0.00';
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

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

  const canClaim = user ? canClaimFreeVotes(user) : false;

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
        background: 'var(--color-white)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative'
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
            color: 'var(--color-grey-500)'
          }}
        >
          ×
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <img 
            src="/Taste-Machine-Monster-Abstract-Green-150x150.png" 
            alt="Taste Machine"
            style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: 'var(--space-4)' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <h2 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '800', 
            color: 'var(--color-black)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase'
          }}>
            Taste Machine
          </h2>
          <p style={{ color: 'var(--color-grey-600)', fontSize: 'var(--font-size-lg)' }}>
            Proof of Aesthetic
          </p>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-grey-700)' }}>
            An NFT aesthetic voting game on Abstract Chain where users vote on the visual appeal of NFTs, 
            earn XP and rewards, and participate in a gamified blockchain experience.
          </p>
          
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontWeight: '600', marginBottom: 'var(--space-2)', color: 'var(--color-black)' }}>
              How it works:
            </h3>
            <ul style={{ paddingLeft: 'var(--space-4)', color: 'var(--color-grey-600)' }}>
              <li>Vote on random NFT matchups based on aesthetic appeal</li>
              <li>Earn XP and participate in prize breaks every 10 votes</li>
                                    <li>Win FGUGO tokens through weighted lottery system</li>
              <li>Influence Elo ratings that determine NFT rankings</li>
            </ul>
          </div>

          <div style={{ 
            background: 'var(--color-grey-100)', 
            padding: 'var(--space-4)', 
            borderRadius: 'var(--border-radius)',
            marginBottom: 'var(--space-4)'
          }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-600)', margin: 0 }}>
              <strong>Contract:</strong> 0xF714af6b79143b3A412eBe421BFbaC4f7D4e4B13<br/>
              <strong>Network:</strong> Abstract Sepolia Testnet<br/>
              <strong>NFTs:</strong> 39,608 across 7 collections
            </p>
          </div>
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
        background: 'var(--color-white)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative'
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
            color: 'var(--color-grey-500)'
          }}
        >
          ×
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '800', 
            color: 'var(--color-black)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase'
          }}>
            How It Works
          </h2>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-grey-700)' }}>
            <strong>Placeholder content - you can update this later.</strong>
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-grey-700)' }}>
            This is where you'll explain how the voting system works, how users earn rewards, 
            and the mechanics of the aesthetic judging process.
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
        background: 'var(--color-white)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative'
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
            color: 'var(--color-grey-500)'
          }}
        >
          ×
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '800', 
            color: 'var(--color-black)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase'
          }}>
            Why This Matters
          </h2>
        </div>

        <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-grey-700)' }}>
            <strong>Placeholder content - you can update this later.</strong>
          </p>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-grey-700)' }}>
            This is where you'll explain the vision behind aesthetic voting, the importance of 
            community-driven curation, and the broader impact on the NFT ecosystem.
          </p>
        </div>
      </div>
    </div>
  );

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
            </div>
          </div>

          {/* RIGHT SIDE: Actions + Stats + Wallet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {isConnected && user ? (
              <>
                {/* Claim Daily Votes Text */}
                <span
                  onClick={canClaim ? handleClaimFreeVotes : undefined}
                  style={{
                    color: canClaim ? 'var(--color-green)' : 'var(--color-grey-500)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600',
                    cursor: canClaim ? 'pointer' : 'default',
                    transition: 'all var(--transition-base)',
                    textShadow: canClaim ? '0 0 10px rgba(0, 211, 149, 0.3)' : 'none',
                    animation: canClaim ? 'pulse 2s infinite' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (canClaim) {
                      e.currentTarget.style.textDecoration = 'underline';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  {claimingVotes ? '⏳' : canClaim ? '✨ Claim Daily Votes' : '🔒 Claimed'}
                </span>

                {/* Stats - Clean Text Style */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                  {/* XP */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)'
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
                  </div>
                  
                  {/* Votes */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)'
                  }}>
                    <img
                      src="/lick-icon.png"
                      alt="Votes"
                      style={{
                        width: '22px',
                        height: '22px'
                      }}
                    />
                    <span style={{ 
                      fontWeight: '600',
                      color: 'var(--color-white)',
                      fontSize: 'var(--font-size-xs)'
                    }}>
                      {user.total_votes || 0}
                    </span>
                  </div>

                  {/* FGUGO Balance */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)'
                  }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
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
                          console.log('FGUGO image failed to load:', e);
                          const target = e.target as HTMLImageElement;
                          console.log('Image src:', target.src);
                          target.style.display = 'none';
                          const container = target.parentElement;
                          if (container) {
                            container.innerHTML = '<span style="font-size: 12px; font-weight: 700; color: var(--color-green);">G</span>';
                          }
                        }}
                        onLoad={() => {
                          console.log('FGUGO image loaded successfully!');
                        }}
                      />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span className="testnet-label" style={{ 
                        position: 'absolute',
                        top: '-12px',
                        left: '0',
                        fontSize: '9px',
                        fontWeight: '500',
                        color: '#dc2626',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap'
                      }}>
                        Testnet
                      </span>
                      <span style={{ 
                        fontWeight: '600',
                        color: 'var(--color-white)',
                        fontSize: 'var(--font-size-xs)',
                        lineHeight: '1.2'
                      }}>
                        {eligibility?.gugoBalance && !isNaN(parseFloat(eligibility.gugoBalance)) ? parseFloat(eligibility.gugoBalance).toFixed(1) : '0.0'} FGUGO
                      </span>
                    </div>
                  </div>

                  {/* ETH Balance */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)'
                  }}>
                    <img
                      src="/ethereum-logo.svg"
                      alt="ETH"
                      style={{
                        width: '22px',
                        height: '22px'
                      }}
                    />
                    <div style={{ position: 'relative' }}>
                      <span className="testnet-label" style={{ 
                        position: 'absolute',
                        top: '-12px',
                        left: '0',
                        fontSize: '9px',
                        fontWeight: '500',
                        color: '#dc2626',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap'
                      }}>
                        Testnet
                      </span>
                      <span style={{ 
                        fontWeight: '600',
                        color: 'var(--color-white)',
                        fontSize: 'var(--font-size-xs)',
                        lineHeight: '1.2'
                      }}>
                        {eligibility?.ethBalance && !isNaN(parseFloat(eligibility.ethBalance)) ? parseFloat(eligibility.ethBalance).toFixed(4) : '0.0000'}
                      </span>
                    </div>
                  </div>
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
                      background: 'var(--color-grey-100)',
                      border: '1px solid var(--color-grey-300)',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '500'
                    }}
                  >
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: 'var(--color-green)',
                      borderRadius: '50%'
                    }}></div>
                    {formatAddress(address || '')}
                    <span style={{ fontSize: '10px', color: 'var(--color-grey-500)' }}>▼</span>
                  </button>

                  {showWalletDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 'var(--space-2)',
                      background: 'var(--color-white)',
                      border: '1px solid var(--color-grey-200)',
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: '200px',
                      zIndex: 101
                    }}>
                      <div style={{ padding: 'var(--space-3)' }}>
                        <div className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
                          Connected Wallet
                        </div>
                        <div style={{ 
                          fontFamily: 'monospace',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-grey-600)',
                          marginBottom: 'var(--space-3)'
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
                            padding: 'var(--space-2)',
                            background: 'var(--color-grey-100)',
                            border: 'none',
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            transition: 'all var(--transition-base)'
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
              <button
                onClick={onConnectWallet}
                className="btn-accent"
                style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--space-3) var(--space-6)' }}
              >
                Connect Wallet
              </button>
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
    </>
  );
}