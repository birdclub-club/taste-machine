import React, { useState, useEffect } from 'react';
import { fixImageUrl, getNextIPFSGateway, ipfsGatewayManager } from '@lib/ipfs-gateway-manager';

interface NFTData {
  id: string;
  image: string;
  name?: string;
  collection_address?: string;
  token_address?: string;
  token_id?: string;
}

interface MatchupCardProps {
  nft1: NFTData;
  nft2: NFTData;
  onVote: (winnerId: string, superVote: boolean) => void;
  onNoVote?: () => void; // Callback when user votes "No" (doesn't like either)
  onImageFailure?: () => void; // Callback when all image loading fails
  isVoting?: boolean;
}

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



function MatchupCard({ nft1, nft2, onVote, onNoVote, onImageFailure, isVoting = false }: MatchupCardProps) {
  const [hoveredNft, setHoveredNft] = useState<string | null>(null);
  const [copiedAddresses, setCopiedAddresses] = useState<{[key: string]: string | null}>({});
  const [sliderPosition, setSliderPosition] = useState(50); // 50 = center, 0 = left/top NFT, 100 = right/bottom NFT
  const [isDragging, setIsDragging] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [showNoButton, setShowNoButton] = useState(false);

  // Show "No" button after 5 seconds - reset timer for each new matchup
  useEffect(() => {
    // Reset button visibility when new matchup loads
    setShowNoButton(false);
    
    const timer = setTimeout(() => {
      setShowNoButton(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [nft1.id, nft2.id]); // Reset timer when NFTs change

  const handleCopyAddress = async (address: string, type: 'collection' | 'nft', nftId: string) => {
    try {
      await navigator.clipboard.writeText(address);
      const key = `${nftId}-${type}`;
      setCopiedAddresses(prev => ({ ...prev, [key]: 'Address copied' }));
      
      // Clear the "Address copied" text after 2 seconds
      setTimeout(() => {
        setCopiedAddresses(prev => ({ ...prev, [key]: null }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // Handle slider/swipe voting
  const handleSliderStart = (clientX: number, clientY: number) => {
    if (isVoting) return;
    setIsDragging(true);
    setStartPosition({ x: clientX, y: clientY });
  };

  const handleSliderMove = (clientX: number, clientY: number, isTouch = false) => {
    if (!isDragging || isVoting) return;
    
    // For mobile (touch), use vertical movement; for desktop, use horizontal
    if (isTouch && window.innerWidth <= 768) {
      // Mobile: vertical swipe (up for top NFT, down for bottom NFT)
      const deltaY = clientY - startPosition.y;
      const newPosition = Math.max(0, Math.min(100, 50 + (deltaY / 2))); // Sensitivity adjustment
      setSliderPosition(newPosition);
    } else {
      // Desktop: horizontal slide (left for left NFT, right for right NFT)
      const deltaX = clientX - startPosition.x;
      const newPosition = Math.max(0, Math.min(100, 50 + (deltaX / 3))); // Sensitivity adjustment
      setSliderPosition(newPosition);
    }
  };

  const handleSliderEnd = () => {
    if (!isDragging || isVoting) return;
    setIsDragging(false);
    
    // Trigger vote if slider moved significantly
    if (sliderPosition < 30) {
      onVote(nft1.id, false); // Left/Top NFT
    } else if (sliderPosition > 70) {
      onVote(nft2.id, false); // Right/Bottom NFT
    }
    
    // Reset slider to center
    setTimeout(() => setSliderPosition(50), 100);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    handleSliderStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleSliderMove(e.clientX, e.clientY, false);
  };

  const handleMouseUp = () => {
    handleSliderEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleSliderStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleSliderMove(touch.clientX, touch.clientY, true);
  };

  const handleTouchEnd = () => {
    handleSliderEnd();
  };

  // Global event listeners for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleSliderMove(e.clientX, e.clientY, false);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleSliderEnd();
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        e.preventDefault(); // Prevent scrolling while dragging
        const touch = e.touches[0];
        handleSliderMove(touch.clientX, touch.clientY, true);
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDragging) {
        handleSliderEnd();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging]);

  const NFTCard = ({ nft, position }: { nft: NFTData; position: 'left' | 'right' }) => (
    <div 
      className="nft-card"
      style={{
        flex: 1,
        maxWidth: '500px',
        position: 'relative',
        opacity: 1,
        animation: 'none'
      }}
    >
      {/* Subtle radial gradient lighting behind each NFT */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '300%',
        height: '300%',
        background: 'radial-gradient(circle, rgba(50, 50, 50, 0.6) 0%, rgba(35, 35, 35, 0.4) 40%, rgba(25, 25, 25, 0.3) 70%, transparent 100%)',
        zIndex: -1,
        pointerEvents: 'none'
      }} />
      <div style={{
        background: 'var(--color-white)',
        border: hoveredNft === nft.id ? '3px solid var(--color-black)' : '2px solid var(--color-grey-200)',
        borderRadius: 'var(--border-radius-lg)',
        overflow: 'hidden',
        transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out, border 0.2s ease-out',
        transform: hoveredNft === nft.id ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hoveredNft === nft.id ? '0 20px 40px rgba(0,0,0,0.2)' : '0 8px 24px rgba(0,0,0,0.12)',
        opacity: isVoting ? 0.7 : 1,
        position: 'relative',
        zIndex: 10
      }}>
        {/* Image Container - Clickable area */}
        <div 
          style={{
            aspectRatio: '1',
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--color-grey-100)',
            cursor: isVoting ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={() => !isVoting && setHoveredNft(nft.id)}
          onMouseLeave={() => setHoveredNft(null)}
          onClick={() => !isVoting && onVote(nft.id, false)}
        >
          <img 
            src={fixImageUrl(nft.image)} 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform var(--transition-slow)',
              transform: hoveredNft === nft.id ? 'scale(1.05)' : 'scale(1)'
            }}
            alt={`NFT ${nft.id}`}
            onLoadStart={(e) => {
              const target = e.target as HTMLImageElement;
              // Set 5-second timeout for image loading
              const timeoutId = setTimeout(() => {
                console.log(`⏰ Image loading timeout for NFT ${nft.id}, trying next gateway...`);
                target.dispatchEvent(new Event('error'));
              }, 5000);
              target.dataset.loadTimeout = timeoutId.toString();
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              
              // Clear loading timeout
              if (target.dataset.loadTimeout) {
                clearTimeout(parseInt(target.dataset.loadTimeout));
                delete target.dataset.loadTimeout;
              }
              
              const retryCount = parseInt(target.dataset.retryCount || '0');
              
              // Prevent infinite loops - only try fallbacks 3 times per image
              if (retryCount >= 3) {
                console.log(`❌ All gateways failed for NFT ${nft.id} after ${retryCount} attempts, triggering session skip...`);
                
                // Always skip to next session - NEVER show placeholder images to users
                if (onImageFailure) {
                  onImageFailure();
                } else {
                  console.log(`❌ No failure callback provided, forcibly skipping session for NFT ${nft.id}`);
                  // Force skip to next session by triggering a window reload as last resort
                  window.location.reload();
                }
                return;
              }
              
              console.log(`❌ Image failed to load for NFT ${nft.id} (attempt ${retryCount + 1}):`, target.src);
              
              // Increment retry count
              target.dataset.retryCount = (retryCount + 1).toString();
              
              // Try next IPFS gateway before giving up
              const nextSrc = getNextIPFSGateway(target.src, nft.image);
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
              
              console.log(`✅ Image loaded successfully for NFT ${nft.id}:`, nft.image);
            }}
          />
          
          {/* Overlay on hover */}
          {hoveredNft === nft.id && !isVoting && (
            <div style={{
              position: 'absolute',
              top: 'var(--space-4)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              opacity: 1,
              transition: 'opacity 0.2s ease-out'
            }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.8)',
                color: 'var(--color-white)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--border-radius-sm)',
                fontWeight: '600',
                fontSize: 'var(--font-size-sm)',
                transform: 'scale(1)',
                transition: 'transform 0.2s ease-out',
                whiteSpace: 'nowrap'
              }}>
                <img src="/lick-icon.png" alt="Choose" style={{ width: '20px', height: '20px' }} />
              </div>
            </div>
          )}
        </div>
        
        {/* Address Info - Non-clickable area */}
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-white)',
          borderTop: '1px solid var(--color-grey-200)',
          cursor: 'default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end'
        }}>
          {/* Left side content - varies based on position */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-grey-600)',
            justifyContent: 'flex-start',
            flex: '1'
          }}>
            {position === 'left' ? (
              // Left card: Token ID first, then Collection button (if available)
              <>
                {/* Token ID for left card - left-justified */}
                {nft.token_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (nft.token_address) {
                        handleCopyAddress(nft.token_address, 'nft', nft.id);
                      }
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
                      transition: 'opacity 0.2s ease, color 0.2s ease',
                      marginRight: nft.collection_address ? 'var(--space-4)' : '0'
                    }}
                    title="Copy NFT address"
                  >
                    #{nft.token_id}
                  </button>
                )}
                
                {/* NFT Address Copied Confirmation - Next to Token ID */}
                {copiedAddresses[`${nft.id}-nft`] && (
                  <span style={{ 
                    color: 'var(--color-green)', 
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginRight: 'var(--space-2)'
                  }}>
                    Address copied
                  </span>
                )}


              </>
            ) : (
              // Right card: Fire button first
              <>
                {/* Super Vote Fire Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onVote) {
                      console.log('🔥 Super vote triggered for NFT:', nft.id);
                      onVote(nft.id, true); // true = super vote
                    }
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
                <div></div> {/* Empty div to maintain flex layout */}
              </>
            )}
          </div>
          
          {/* Right side content - varies based on position */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            {position === 'left' ? (
              // Left card: Fire button only on the right (Token ID moved to left side)
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onVote) {
                    console.log('🔥 Super vote triggered for NFT:', nft.id);
                    onVote(nft.id, true); // true = super vote
                  }
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
                  justifyContent: 'center'
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
            ) : (
              // Right card: Token ID on the right (original layout)
              nft.token_id && (
                <>
                  {/* NFT Address Copied Confirmation - To the left of token ID */}
                  {copiedAddresses[`${nft.id}-nft`] && (
                    <span style={{ 
                      color: 'var(--color-green)', 
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: '500',
                      whiteSpace: 'nowrap'
                    }}>
                      Address copied
                    </span>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (nft.token_address) {
                        handleCopyAddress(nft.token_address, 'nft', nft.id);
                      }
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
                    title="Copy NFT address"
                  >
                    #{nft.token_id}
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      gap: 'var(--space-8)',
      alignItems: 'center',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative',
      zIndex: 5,
      overflow: 'visible'
    }}>
      {/* Desktop: Side by Side, Mobile: Stacked */}
      <div 
        className="matchup-container"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 'var(--space-8)',
          alignItems: 'center',
          width: '100%',
          overflow: 'visible'
        }}
      >
        <NFTCard nft={nft1} position="left" />
        
        {/* VS indicator - Swiss minimal style */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          margin: '0 var(--space-8)',
          zIndex: 15
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'var(--color-black)',
            color: 'var(--color-white)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            fontSize: 'var(--font-size-xl)',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 16,
            letterSpacing: '-0.02em'
          }}>
            VS.
          </div>
          
          {/* "No" Button - Fades in after 5 seconds */}
          {!isVoting && onNoVote && (
            <button
              onClick={() => {
                // Hide the button immediately
                setShowNoButton(false);
                // Call the no vote function
                onNoVote();
                // Reset button to appear again after 5 seconds
                setTimeout(() => {
                  setShowNoButton(true);
                }, 5000);
              }}
              style={{
                position: 'absolute',
                top: '100px', // Position below the VS circle
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80px',
                height: '80px',
                background: 'var(--color-black)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: '50%',
                fontSize: 'var(--font-size-xs)',
                fontWeight: '900',
                cursor: showNoButton ? 'pointer' : 'default',
                boxShadow: showNoButton ? '0 8px 32px rgba(0,0,0,0.2)' : 'none',
                zIndex: 17,
                opacity: showNoButton ? 1 : 0,
                visibility: showNoButton ? 'visible' : 'hidden',
                transition: 'opacity 0.8s ease-in-out, visibility 0.8s ease-in-out, transform 0.2s ease, box-shadow 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                pointerEvents: showNoButton ? 'auto' : 'none'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLElement;
                target.style.transform = 'translateX(-50%) scale(1.05)';
                target.style.background = 'var(--color-grey-800)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLElement;
                target.style.transform = 'translateX(-50%) scale(1)';
                target.style.background = 'var(--color-black)';
              }}
              title="Don't like either option"
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '2px' }}>💀</div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '900' }}>NO</div>
            </button>
          )}
        </div>
        
        <NFTCard nft={nft2} position="right" />
      </div>
      
      {/* Swipe to Vote Slider */}
      {!isVoting && (
        <div style={{
          width: '100%',
          maxWidth: '400px',
          margin: 'var(--space-6) auto 0 auto',
          position: 'relative'
        }}>
          {/* Instruction Text */}
          <div style={{
            textAlign: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-grey-500)',
            marginBottom: 'var(--space-3)',
            fontWeight: '500'
          }}>
            <span className="desktop-instruction">
              Tap or swipe to vote
            </span>
            <span className="mobile-instruction" style={{ display: 'none' }}>
              Tap or swipe to vote
            </span>
          </div>

          {/* Slider Track */}
          <div
            style={{
              width: '100%',
              height: '60px',
              background: 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.05) 100%)',
              borderRadius: '30px',
              position: 'relative',
              border: '2px solid var(--color-grey-500)',
              cursor: isDragging ? 'grabbing' : 'grab',
              overflow: 'hidden'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Vote Direction Indicators */}
            <div style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: sliderPosition < 40 ? 'var(--color-green)' : 'var(--color-grey-500)',
              transition: 'color 0.2s ease-out',
              pointerEvents: 'none'
            }}>
              ←
            </div>
            
            <div style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: sliderPosition > 60 ? 'var(--color-green)' : 'var(--color-grey-500)',
              transition: 'color 0.2s ease-out',
              pointerEvents: 'none'
            }}>
              →
            </div>

            {/* Slider Handle */}
            <div
              style={{
                position: 'absolute',
                left: `calc(${sliderPosition}% - 28px)`,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '56px',
                height: '48px',
                background: isDragging ? 'var(--color-green)' : 'var(--color-white)',
                borderRadius: '24px',
                border: '2px solid var(--color-grey-300)',
                boxShadow: isDragging ? '0 4px 12px rgba(0,211,149,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                transition: isDragging ? 'none' : 'left 0.3s ease-out, background 0.2s ease-out, box-shadow 0.2s ease-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--font-size-lg)',
                color: isDragging ? 'white' : 'var(--color-grey-600)',
                cursor: isDragging ? 'grabbing' : 'grab',
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
                  opacity: 1
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>

            {/* Vote Preview */}
            {(sliderPosition < 30 || sliderPosition > 70) && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: sliderPosition < 30 ? '20%' : '80%',
                transform: 'translateY(-50%)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: '600',
                color: 'var(--color-green)',
                pointerEvents: 'none',
                opacity: isDragging ? 1 : 0.7,
                transition: 'opacity 0.2s ease-out'
              }}>
                <img src="/lick-icon.png" alt="Choose" style={{ width: '20px', height: '20px' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voting Status */}
      {isVoting && (
        <div className="slide-up" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-6)',
          background: 'var(--color-grey-100)',
          borderRadius: 'var(--border-radius)',
          color: 'var(--color-grey-600)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: '500'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid var(--color-green)',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Processing vote...
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders when props haven't changed
export default React.memo(MatchupCard);