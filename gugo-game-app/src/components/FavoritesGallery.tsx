import React, { useState, useEffect } from 'react';
import { useFavorites } from '@/hooks/useFavorites';
import { fixImageUrl, getNextIPFSGateway, ipfsGatewayManager } from '@lib/ipfs-gateway-manager';

interface FavoritesGalleryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FavoritesGallery({ isOpen, onClose }: FavoritesGalleryProps) {
  const { favorites, isLoading, error, removeFromFavorites } = useFavorites();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [showPrices, setShowPrices] = useState(false);
  const [prices, setPrices] = useState<Record<string, { price: number | null; currency: string } | null>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  // Debug: Log favorites data when modal opens (remove after testing)
  React.useEffect(() => {
    if (isOpen && favorites.length > 0) {
      console.log('🖼️ FavoritesGallery opened with favorites:', favorites.length, 'items');
    }
  }, [isOpen, favorites]);

  const getCollectionMagicEdenUrl = (contractAddress: string) => {
    return `https://magiceden.us/collections/abstract/${contractAddress}`;
  };

  const getTokenMagicEdenUrl = (contractAddress: string, tokenId: string) => {
    return `https://magiceden.us/item-details/abstract/${contractAddress}/${tokenId}`;
  };

  // Fetch prices for all favorites
  const fetchPrices = async () => {
    if (!showPrices || favorites.length === 0) return;
    
    const eligibleFavorites = favorites.filter(fav => fav.collection_address && fav.token_id);
    console.log(`💰 Starting price fetch for ${eligibleFavorites.length}/${favorites.length} favorites`);
    console.log('💰 Favorites data:', favorites.map(f => ({ 
      nft_id: f.nft_id, 
      collection_address: f.collection_address, 
      token_id: f.token_id 
    })));
    
    if (eligibleFavorites.length === 0) {
      console.warn('💰 No favorites have collection_address and token_id - skipping price fetch');
      setLoadingPrices(false);
      return;
    }
    
    setLoadingPrices(true);
    const newPrices: Record<string, { price: number | null; currency: string } | null> = {};
    
    try {
      // Fetch prices for each favorite that has collection_address and token_id
      const pricePromises = eligibleFavorites.map(async (favorite) => {
          const startTime = Date.now();
          console.log(`💰 Starting price fetch for ${favorite.nft_id} (${favorite.collection_address}:${favorite.token_id})`);
          
          try {
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(`/api/nft-price?collection=${favorite.collection_address}&token=${favorite.token_id}`, {
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const elapsed = Date.now() - startTime;
            console.log(`💰 Price API response for ${favorite.nft_id}: ${response.status} (${elapsed}ms)`);
            
            if (!response.ok) {
              console.warn(`Price API error for ${favorite.nft_id}: ${response.status}`);
              newPrices[favorite.nft_id] = null;
              return;
            }

            const text = await response.text();
            if (!text.trim()) {
              console.warn(`Empty response for ${favorite.nft_id}`);
              newPrices[favorite.nft_id] = null;
              return;
            }

            const data = JSON.parse(text);
            console.log(`💰 Price data for ${favorite.nft_id}:`, data);
            
            newPrices[favorite.nft_id] = {
              price: data.price,
              currency: data.currency || 'ETH'
            };
            
            console.log(`✅ Price fetch completed for ${favorite.nft_id}: ${data.price ? `${data.price} ${data.currency}` : 'unlisted'}`);
          } catch (error) {
            const elapsed = Date.now() - startTime;
            console.error(`❌ Failed to fetch price for ${favorite.nft_id} after ${elapsed}ms:`, error);
            newPrices[favorite.nft_id] = null;
          }
        });
      
      await Promise.all(pricePromises);
      setPrices(newPrices);
      
      const successCount = Object.values(newPrices).filter(p => p !== null).length;
      console.log(`💰 Price fetch completed: ${successCount}/${eligibleFavorites.length} successful`);
    } catch (error) {
      console.error('💰 Error in fetchPrices:', error);
      // Set all prices to null on error to prevent UI issues
      const errorPrices: Record<string, null> = {};
      eligibleFavorites.forEach(fav => {
        errorPrices[fav.nft_id] = null;
      });
      setPrices(errorPrices);
    } finally {
      setLoadingPrices(false);
    }
  };

  // Fetch prices when showPrices is enabled
  useEffect(() => {
    if (showPrices) {
      fetchPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPrices, favorites]);

  const handleTogglePrices = () => {
    setShowPrices(!showPrices);
    if (!showPrices) {
      // Clear existing prices when disabling
      setPrices({});
    }
  };

  if (!isOpen) return null;

  const handleRemoveFavorite = async (nftId: string) => {
    if (confirm('Remove this NFT from your favorites?')) {
      await removeFromFavorites(nftId);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 'var(--space-4)'
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid var(--color-grey-600)',
        borderRadius: 'var(--border-radius-lg)',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid #333'
        }}>
          {/* Top Row: Title and Close Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)'
          }}>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: 'var(--font-size-2xl)',
                fontWeight: '900',
                color: 'var(--color-white)'
              }}>
                Favorites Gallery
              </h2>
              <p style={{
                margin: 'var(--space-2) 0 0 0',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-grey-400)'
              }}>
                Your collection of FIRE votes and maximum slider votes
              </p>
            </div>
            
            <button
              onClick={onClose}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid #444',
                background: '#2a2a2a',
                color: 'var(--color-white)',
                fontSize: 'var(--font-size-lg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-base)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-green)';
                e.currentTarget.style.color = 'var(--color-green)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#444';
                e.currentTarget.style.color = 'var(--color-white)';
              }}
            >
              ✕
            </button>
          </div>

          {/* Bottom Row: Stats and Show Prices Toggle */}
          {favorites.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {/* Stats */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-4)',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  background: '#2a2a2a',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid #444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  <div style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '700',
                    color: 'var(--color-green)'
                  }}>
                    {favorites.length}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-grey-400)',
                    textTransform: 'uppercase'
                  }}>
                    Total
                  </div>
                </div>
                
                <div style={{
                  background: '#2a2a2a',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid #444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  <div style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '700',
                    color: '#ff6b35'
                  }}>
                    {favorites.filter(f => f.vote_type === 'fire').length}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-grey-400)',
                    textTransform: 'uppercase'
                  }}>
                    Fire
                  </div>
                </div>
                
                <div style={{
                  background: '#2a2a2a',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid #444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  <div style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '700',
                    color: '#3b82f6'
                  }}>
                    {favorites.filter(f => f.vote_type === 'slider_max').length}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-grey-400)',
                    textTransform: 'uppercase'
                  }}>
                    Slides
                  </div>
                </div>
              </div>

              {/* Show Prices Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <button
                  onClick={handleTogglePrices}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: showPrices ? 'var(--color-grey-400)' : 'transparent',
                    border: '1px solid var(--color-grey-400)',
                    borderRadius: 'var(--border-radius)',
                    color: showPrices ? 'black' : 'var(--color-grey-400)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    if (!showPrices) {
                      e.currentTarget.style.background = 'var(--color-grey-400)';
                      e.currentTarget.style.color = 'black';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showPrices) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--color-grey-400)';
                    }
                  }}
                >
                  {showPrices ? 'HIDE PRICES' : 'SHOW PRICES'}
                </button>
                
                {loadingPrices && (
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-grey-400)'
                  }}>
                    Loading...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-6)'
        }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              color: 'var(--color-grey-400)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #333',
                borderTop: '3px solid var(--color-green)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginRight: 'var(--space-3)'
              }}></div>
              Loading your favorites...
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              color: '#dc2626',
              padding: 'var(--space-8)'
            }}>
              <p>❌ Error loading favorites: {error}</p>
            </div>
          ) : favorites.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: 'var(--color-grey-400)',
              padding: 'var(--space-8)'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>🔥</div>
              <h3 style={{ 
                color: 'var(--color-white)', 
                marginBottom: 'var(--space-2)' 
              }}>
                No Favorites Yet
              </h3>
              <p>
                Give NFTs FIRE votes (🔥) or max slider votes (💯) to add them to your favorites gallery!
              </p>
            </div>
          ) : (
            /* Favorites Grid */
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 'var(--space-4)'
              }}>
                {favorites.map((favorite) => (
                  <div
                    key={favorite.id}
                    style={{
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: 'var(--border-radius-lg)',
                      overflow: 'hidden',
                      transition: 'all var(--transition-base)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-green)';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#444';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Image */}
                    <div style={{
                      aspectRatio: '1',
                      background: '#1a1a1a',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {favorite.image_url && !imageErrors.has(favorite.id) ? (
                        <img
                          src={fixImageUrl(favorite.image_url)}
                          alt={`NFT ${favorite.token_id || favorite.nft_id}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onLoad={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Track gateway success
                            const currentGateway = target.src.split('/ipfs/')[0] + '/ipfs/';
                            ipfsGatewayManager.recordSuccess(currentGateway);
                            console.log(`✅ Image loaded successfully for favorite ${favorite.id}:`, favorite.image_url);
                          }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const retryCount = parseInt(target.dataset.retryCount || '0');
                            
                            // Prevent infinite loops - only try 2 gateway attempts
                            if (retryCount >= 2) {
                              console.log(`❌ All gateways failed for favorite ${favorite.id}, showing placeholder`);
                              setImageErrors(prev => new Set(prev).add(favorite.id));
                              return;
                            }
                            
                            console.log(`❌ Image failed attempt ${retryCount + 1} for favorite ${favorite.id}:`, favorite.image_url);
                            target.dataset.retryCount = (retryCount + 1).toString();
                            
                            // Try next IPFS gateway
                            const nextSrc = getNextIPFSGateway(target.src, favorite.image_url || '');
                            console.log(`🔄 Trying next gateway for favorite:`, nextSrc);
                            target.src = nextSrc;
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-grey-500)',
                          fontSize: '3rem'
                        }}>
                          🖼️
                        </div>
                      )}
                      
                      {/* Vote Type Badge */}
                      <div style={{
                        position: 'absolute',
                        top: 'var(--space-2)',
                        right: 'var(--space-2)',
                        background: favorite.vote_type === 'fire' ? '#ff6b35' : '#3b82f6',
                        color: 'white',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                      }}>
                        {favorite.vote_type === 'fire' ? 'FIRE' : 'MAX'}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ 
                      padding: 'var(--space-3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      position: 'relative'
                    }}>
                      {/* Left column - Collection and Remove button */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 'var(--space-1)'
                      }}>
                        {/* Collection Name */}
                        {favorite.collection_name ? (
                          <div 
                            style={{
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--color-grey-400)',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'color var(--transition-base)',
                              lineHeight: 1
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (favorite.collection_address) {
                                window.open(getCollectionMagicEdenUrl(favorite.collection_address), '_blank');
                              }
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-green)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-grey-400)';
                            }}
                          >
                            {favorite.collection_name}
                          </div>
                        ) : (
                          <div></div>
                        )}
                        
                        {/* Price Display - When enabled */}
                        {showPrices && (
                          <div style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-grey-300)',
                            fontWeight: '500',
                            marginBottom: 'var(--space-1)'
                          }}>
                            {loadingPrices ? (
                              'Loading...'
                            ) : prices[favorite.nft_id] ? (
                              prices[favorite.nft_id]?.price ? (
                                `${prices[favorite.nft_id]!.price} ${prices[favorite.nft_id]!.currency}`
                              ) : (
                                'Unlisted'
                              )
                            ) : favorite.collection_address && favorite.token_id ? (
                              'Price unavailable'
                            ) : (
                              'No contract data'
                            )}
                          </div>
                        )}
                        
                        {/* Remove Button - Directly under collection/price */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFavorite(favorite.nft_id);
                          }}
                          style={{
                            padding: 'var(--space-1) var(--space-2)',
                            background: 'transparent',
                            border: '1px solid var(--color-grey-400)',
                            borderRadius: 'var(--border-radius-sm)',
                            color: 'var(--color-grey-400)',
                            fontSize: '10px',
                            cursor: 'pointer',
                            transition: 'all var(--transition-base)',
                            alignSelf: 'flex-start'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#dc2626';
                            e.currentTarget.style.borderColor = '#dc2626';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--color-grey-400)';
                            e.currentTarget.style.color = 'var(--color-grey-400)';
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      
                      {/* Token ID - Right side */}
                      <div 
                        style={{
                          fontSize: '2.5rem',
                          fontWeight: '900',
                          color: 'var(--color-white)',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          transition: 'color var(--transition-base)',
                          opacity: 0.8,
                          lineHeight: 1
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (favorite.collection_address && favorite.token_id) {
                            window.open(getTokenMagicEdenUrl(favorite.collection_address, favorite.token_id), '_blank');
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-green)';
                          e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-white)';
                          e.currentTarget.style.opacity = '0.8';
                        }}
                      >
                        #{favorite.token_id || 'Unknown'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}