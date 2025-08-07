import React, { useState, useEffect } from 'react';
import { useFavorites } from '@/hooks/useFavorites';
import { fixImageUrl, getNextIPFSGateway } from '../../lib/ipfs-gateway-manager';

interface FavoritesGalleryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FavoritesGallery({ isOpen, onClose }: FavoritesGalleryProps) {
  const { favorites, isLoading, error, removeFromFavorites } = useFavorites();
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Load images when gallery opens
  useEffect(() => {
    if (isOpen && favorites.length > 0) {
      console.log('🖼️ Loading images for favorites:', favorites.map(f => ({ id: f.id, url: f.image_url })));
      favorites.forEach(favorite => {
        if (favorite.image_url && !loadedImages.has(favorite.id) && !imageErrors.has(favorite.id)) {
          const originalUrl = favorite.image_url;
          const fixedUrl = fixImageUrl(originalUrl);
          console.log(`📸 Starting to load image for ${favorite.id}:`, { original: originalUrl, fixed: fixedUrl });
          
          const img = new Image();
          img.onload = () => {
            console.log(`✅ Image loaded successfully for ${favorite.id}`);
            setLoadedImages(prev => new Set(prev).add(favorite.id));
          };
          img.onerror = (e) => {
            console.error(`❌ Failed to load image for ${favorite.id}:`, fixedUrl, e);
            // Try next gateway
            const nextUrl = getNextIPFSGateway(fixedUrl, originalUrl);
            if (nextUrl !== fixedUrl) {
              console.log(`🔄 Trying next gateway for ${favorite.id}:`, nextUrl);
              const retryImg = new Image();
              retryImg.onload = () => {
                console.log(`✅ Image loaded with retry for ${favorite.id}`);
                setLoadedImages(prev => new Set(prev).add(favorite.id));
              };
              retryImg.onerror = () => {
                console.error(`❌ All gateways failed for ${favorite.id}`);
                setImageErrors(prev => new Set(prev).add(favorite.id));
              };
              retryImg.src = nextUrl;
            } else {
              setImageErrors(prev => new Set(prev).add(favorite.id));
            }
          };
          img.src = fixedUrl;
        }
      });
    }
  }, [isOpen, favorites, loadedImages, imageErrors]);

  const getCollectionMagicEdenUrl = (collectionName: string) => {
    const slug = collectionName.toLowerCase().replace(/\s+/g, '-');
    return `https://magiceden.io/collections/ethereum/${slug}`;
  };

  const getTokenMagicEdenUrl = (collectionName: string, tokenId: string) => {
    const slug = collectionName.toLowerCase().replace(/\s+/g, '-');
    return `https://magiceden.io/item-details/ethereum/${slug}/${tokenId}`;
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
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
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
            <>
              {/* Stats */}
              <div style={{
                marginBottom: 'var(--space-6)',
                display: 'flex',
                gap: 'var(--space-4)',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  background: '#2a2a2a',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid #444'
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
                    Total Favorites
                  </div>
                </div>
                
                <div style={{
                  background: '#2a2a2a',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid #444'
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
                    Fire Votes
                  </div>
                </div>
                
                <div style={{
                  background: '#2a2a2a',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid #444'
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
                    Max Slider
                  </div>
                </div>
              </div>

              {/* Favorites Grid */}
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
                      {favorite.image_url ? (
                        <>
                          {!loadedImages.has(favorite.id) && !imageErrors.has(favorite.id) && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              color: 'var(--color-grey-500)',
                              textAlign: 'center'
                            }}>
                              <div style={{
                                width: '30px',
                                height: '30px',
                                border: '3px solid #333',
                                borderTop: '3px solid var(--color-green)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 8px'
                              }}></div>
                              Loading...
                            </div>
                          )}
                          
                          {imageErrors.has(favorite.id) ? (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-grey-500)',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🖼️</div>
                              <div style={{ fontSize: '12px' }}>Image unavailable</div>
                            </div>
                          ) : (
                            <img
                              src={fixImageUrl(favorite.image_url)}
                              alt={`NFT ${favorite.token_id || favorite.nft_id}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: loadedImages.has(favorite.id) ? 1 : 0,
                                transition: 'opacity 0.3s ease'
                              }}
                              onLoad={() => {
                                setLoadedImages(prev => new Set(prev).add(favorite.id));
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const currentSrc = target.src;
                                const nextSrc = getNextIPFSGateway(currentSrc, favorite.image_url || '');
                                
                                if (nextSrc !== currentSrc && !nextSrc.includes('picsum.photos')) {
                                  console.log(`🔄 Retrying image load for ${favorite.id}:`, nextSrc);
                                  target.src = nextSrc;
                                } else {
                                  console.error(`❌ Image failed to load for ${favorite.id}`);
                                  setImageErrors(prev => new Set(prev).add(favorite.id));
                                }
                              }}
                            />
                          )}
                        </>
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
                        {favorite.vote_type === 'fire' ? '🔥 FIRE' : '💯 MAX'}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: 'var(--space-4)' }}>
                      {/* Token ID - Prominent and Clickable */}
                      <div 
                        style={{
                          fontSize: 'var(--font-size-xl)',
                          fontWeight: '900',
                          color: 'var(--color-white)',
                          marginBottom: 'var(--space-2)',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          transition: 'color var(--transition-base)'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (favorite.collection_name && favorite.token_id) {
                            window.open(getTokenMagicEdenUrl(favorite.collection_name, favorite.token_id), '_blank');
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-green)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-white)';
                        }}
                      >
                        #{favorite.token_id || 'Unknown'}
                      </div>
                      
                      {/* Collection - Clickable */}
                      {favorite.collection_name && (
                        <div 
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-green)',
                            fontWeight: '600',
                            marginBottom: 'var(--space-2)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            transition: 'opacity var(--transition-base)'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(getCollectionMagicEdenUrl(favorite.collection_name), '_blank');
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          {favorite.collection_name}
                        </div>
                      )}
                      
                      {/* Date */}
                      <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-grey-400)',
                        marginBottom: 'var(--space-3)'
                      }}>
                        Added {new Date(favorite.created_at).toLocaleDateString()}
                      </div>
                      
                      {/* Remove Button - Smaller */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFavorite(favorite.nft_id);
                        }}
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          background: 'transparent',
                          border: '1px solid #dc2626',
                          borderRadius: 'var(--border-radius-sm)',
                          color: '#dc2626',
                          fontSize: '10px',
                          cursor: 'pointer',
                          transition: 'all var(--transition-base)',
                          alignSelf: 'flex-start'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dc2626';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#dc2626';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}