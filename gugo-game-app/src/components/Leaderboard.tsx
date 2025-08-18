"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface LeaderboardEntry {
  id: string;
  name: string;
  image: string;
  collection_name: string;
  contract_address?: string;
  token_id?: string;
  total_votes: number;
  wins: number;
  current_elo: number;
  fire_votes: number;
  poa_score: number;
  confidence_score: number;
  leaderboard_position: number;
}

interface UserLeaderboardEntry {
  id: string;
  wallet_address: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  xp: number;
  total_votes: number;
  available_votes: number;
  created_at: string;
  position: number;
  taste_level: {
    level: number;
    name: string;
    minXP: number;
    maxXP: number;
    progress: number;
  };
  voting_streak: number;
  days_since_joining: number;
  votes_per_day: number;
  xp_per_vote: number;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'nfts' | 'users'>('nfts');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userLeaderboard, setUserLeaderboard] = useState<UserLeaderboardEntry[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [showPrices, setShowPrices] = useState(false);
  const [prices, setPrices] = useState<Record<string, { price: number | null; currency: string } | null>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'nfts') {
      fetchLeaderboard();
      } else {
        fetchUserLeaderboard();
      }
    }
  }, [isOpen, activeTab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/leaderboard');
      const data = await response.json();
      
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
        setMetadata(data.metadata || {});
      } else {
        setError(data.error || 'Failed to fetch leaderboard data');
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setError('Failed to fetch leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLeaderboard = async () => {
    setUserLoading(true);
    setUserError(null);
    
    try {
      const response = await fetch('/api/user-leaderboard');
      const data = await response.json();
      
      if (data.success) {
        // Debug first user
        if (data.leaderboard && data.leaderboard.length > 0) {
          console.log('🎯 Frontend first user debug:', {
            user: data.leaderboard[0],
            tasteLevel: data.leaderboard[0].taste_level
          });
        }
        setUserLeaderboard(data.leaderboard || []);
        setUserMetadata(data.metadata || {});
      } else {
        setUserError(data.error || 'Failed to fetch user leaderboard data');
      }
    } catch (err) {
      console.error('User leaderboard fetch error:', err);
      setUserError('Failed to fetch user leaderboard data');
    } finally {
      setUserLoading(false);
    }
  };

  // Helper functions for Magic Eden URLs
  const getCollectionMagicEdenUrl = (contractAddress: string) => {
    return `https://magiceden.us/collections/abstract/${contractAddress}`;
  };

  const getTokenMagicEdenUrl = (contractAddress: string, tokenId: string) => {
    return `https://magiceden.us/item-details/abstract/${contractAddress}/${tokenId}`;
  };

  // Known contract addresses for collections that might not have them in the database
  const COLLECTION_CONTRACTS: Record<string, string> = {
    'BEARISH': '0x516dc288e26b34557f68ea1c1ff13576eff8a168',
    'DreamilioMaker': '0x30072084ff8724098cbb65e07f7639ed31af5f66',
    'Kabu': '0x7e3059b08e981a369f99db26487ab4cbffdfef29', // Common Abstract testnet contract
    'Pengztracted': '0xa6c46c07f7f1966d772e29049175ebba26262513', // Common Abstract testnet contract
    'BEEISH': '0x66f7b491691eb85b17e15a8ebf3ced2adbec1996', // Common Abstract testnet contract
    'Canna Sapiens': '0xc2d1370017d8171a31bce6bc5206f86c4322362e' // Common Abstract testnet contract
  };

  // Fetch prices for all leaderboard items
  const fetchPrices = async () => {
    if (!showPrices || leaderboard.length === 0) return;
    
    console.log('🔍 DEBUGGING: Raw leaderboard data:', leaderboard.slice(0, 3));
    console.log('🔍 DEBUGGING: Available fields:', Object.keys(leaderboard[0] || {}));
    
    // Map leaderboard items to use collection_address (like favorites) - EXACT COPY approach
    const mappedItems = leaderboard.map(item => ({
      ...item,
      collection_address: item.contract_address || COLLECTION_CONTRACTS[item.collection_name] || null, // Use known contract or fallback
      nft_id: item.id // Map id to nft_id for consistency with favorites
    }));
    
    console.log('🔍 DEBUGGING: Mapped items:', mappedItems.slice(0, 3));
    console.log('🔍 DEBUGGING: Contract addresses:', mappedItems.map(item => ({
      name: item.name,
      original_contract_address: item.contract_address,
      mapped_collection_address: item.collection_address,
      token_id: item.token_id,
      hasContract: !!item.contract_address,
      hasCollection: !!item.collection_address,
      hasToken: !!item.token_id
    })).slice(0, 5));
    
    const eligibleItems = mappedItems.filter(item => item.collection_address && item.token_id);
    console.log(`💰 Starting price fetch for ${eligibleItems.length}/${leaderboard.length} leaderboard items`);
    console.log('💰 Leaderboard data:', mappedItems.map(f => ({ 
      nft_id: f.nft_id, 
      collection_address: f.collection_address, 
      token_id: f.token_id 
    })));
    
    if (eligibleItems.length === 0) {
      console.warn('💰 No leaderboard items have collection_address and token_id - skipping price fetch');
      setLoadingPrices(false);
      return;
    }
    
    setLoadingPrices(true);
    const newPrices: Record<string, { price: number | null; currency: string } | null> = {};
    
    try {
      // Fetch prices for each item that has collection_address and token_id - EXACT COPY from FavoritesGallery
      const pricePromises = eligibleItems.map(async (item) => {
        const startTime = Date.now();
          console.log(`💰 Starting price fetch for ${item.nft_id} (${item.collection_address}:${item.token_id})`);
        
        try {
            // Add timeout to prevent hanging
          const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
          
            const response = await fetch(`/api/nft-price?collection=${item.collection_address}&token=${item.token_id}`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
            console.log(`💰 Price API response for ${item.nft_id}: ${response.status} (${elapsed}ms)`);
          
          if (!response.ok) {
              console.warn(`Price API error for ${item.nft_id}: ${response.status}`);
              newPrices[item.nft_id] = null;
            return;
          }

          const text = await response.text();
          if (!text.trim()) {
              console.warn(`Empty response for ${item.nft_id}`);
              newPrices[item.nft_id] = null;
            return;
          }

          const data = JSON.parse(text);
            console.log(`💰 Price data for ${item.nft_id}:`, data);
          
            newPrices[item.nft_id] = {
            price: data.price,
            currency: data.currency || 'ETH'
          };
          
            console.log(`✅ Price fetch completed for ${item.nft_id}: ${data.price ? `${data.price} ${data.currency}` : 'unlisted'}`);
        } catch (error) {
          const elapsed = Date.now() - startTime;
            console.error(`❌ Failed to fetch price for ${item.nft_id} after ${elapsed}ms:`, error);
            newPrices[item.nft_id] = null;
        }
      });

      await Promise.all(pricePromises);
      setPrices(newPrices);
      console.log(`💰 Price fetch completed for ${Object.keys(newPrices).length} items`);
    } catch (error) {
      console.error('❌ Error during price fetching:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleTogglePrices = () => {
    const newShowPrices = !showPrices;
    setShowPrices(newShowPrices);
    
    if (newShowPrices) {
      fetchPrices();
    }
  };

  if (!isOpen) return null;

  const getPositionIcon = (position: number) => {
    return `${position}`;
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: 'var(--space-4)',
      paddingTop: '80px',
      isolation: 'isolate'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--dynamic-bg-color, var(--color-grey-800))',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-6)',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '85vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '1px solid var(--dynamic-text-color, var(--color-grey-600))',
        position: 'relative',
        margin: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--dynamic-text-color, var(--color-grey-600))',
          paddingBottom: 'var(--space-4)'
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: '600',
              color: 'var(--dynamic-text-color, var(--color-white))',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              TASTE LEADERBOARD
            </h2>
            <p style={{
              margin: 'var(--space-1) 0 var(--space-3) 0',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--dynamic-text-color, var(--color-grey-300))',
              opacity: 0.7
            }}>
              {activeTab === 'nfts' 
                ? 'Top 20 NFTs by aesthetic score on Abstract Chain'
                : 'Top users by XP and voting activity'
              }
            </p>
            
            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: 'var(--space-1)',
              marginBottom: 'var(--space-2)'
            }}>
              <button
                onClick={() => setActiveTab('nfts')}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: activeTab === 'nfts' ? 'var(--dynamic-text-color, var(--color-grey-400))' : 'transparent',
                  border: '1px solid var(--dynamic-text-color, var(--color-grey-400))',
                  borderRadius: 'var(--border-radius)',
                  color: activeTab === 'nfts' ? 'var(--dynamic-bg-color, black)' : 'var(--dynamic-text-color, var(--color-grey-400))',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all var(--transition-base)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'nfts') {
                    e.currentTarget.style.background = 'var(--dynamic-text-color, var(--color-grey-400))';
                    e.currentTarget.style.color = 'var(--dynamic-bg-color, black)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'nfts') {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-grey-400))';
                  }
                }}
              >
                NFTs
              </button>
              <button
                onClick={() => setActiveTab('users')}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: activeTab === 'users' ? 'var(--dynamic-text-color, var(--color-grey-400))' : 'transparent',
                  border: '1px solid var(--dynamic-text-color, var(--color-grey-400))',
                  borderRadius: 'var(--border-radius)',
                  color: activeTab === 'users' ? 'var(--dynamic-bg-color, black)' : 'var(--dynamic-text-color, var(--color-grey-400))',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all var(--transition-base)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'users') {
                    e.currentTarget.style.background = 'var(--dynamic-text-color, var(--color-grey-400))';
                    e.currentTarget.style.color = 'var(--dynamic-bg-color, black)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'users') {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-grey-400))';
                  }
                }}
              >
                Users
              </button>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}>
            {/* Show Prices Toggle - Only for NFTs tab */}
            {activeTab === 'nfts' && leaderboard.length > 0 && (
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
                    background: showPrices ? 'var(--dynamic-text-color, var(--color-grey-400))' : 'transparent',
                    border: '1px solid var(--dynamic-text-color, var(--color-grey-400))',
                    borderRadius: 'var(--border-radius)',
                    color: showPrices ? 'var(--dynamic-bg-color, black)' : 'var(--dynamic-text-color, var(--color-grey-400))',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    if (!showPrices) {
                      e.currentTarget.style.background = 'var(--dynamic-text-color, var(--color-grey-400))';
                      e.currentTarget.style.color = 'var(--dynamic-bg-color, black)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showPrices) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--dynamic-text-color, var(--color-grey-400))';
                    }
                  }}
                >
                  {showPrices ? 'HIDE PRICES' : 'SHOW PRICES'}
                </button>
                
                {loadingPrices && (
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--dynamic-text-color, var(--color-grey-400))',
                    opacity: 0.7
                  }}>
                    Loading...
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-grey-300)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: 'var(--space-2)',
                borderRadius: 'var(--border-radius-md)',
                transition: 'all var(--transition-base)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-grey-700)';
                e.currentTarget.style.color = 'var(--color-white)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--color-grey-300)';
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          maxHeight: '60vh',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {activeTab === 'nfts' ? (
            // NFT Leaderboard Content
            loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-8)',
                color: 'var(--dynamic-text-color, var(--color-grey-300))'
            }}>
                Loading NFT leaderboard...
            </div>
          ) : error ? (
            <div style={{
              padding: 'var(--space-4)',
              background: 'var(--color-red-900)',
              border: '1px solid var(--color-red-600)',
              borderRadius: 'var(--border-radius-md)',
              color: 'var(--color-red-200)'
            }}>
              Error: {error}
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-8)',
                color: 'var(--dynamic-text-color, var(--color-grey-300))'
            }}>
                No NFT leaderboard data available
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 'var(--space-4)',
              padding: 'var(--space-2)'
            }}>
              {leaderboard.map((nft, index) => {
                const isTopThree = index < 3;
                const hasFireVotes = nft.fire_votes > 0;
                
                return (
                  <div
                    key={nft.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 'var(--space-4)',
                      background: 'var(--dynamic-text-color, var(--color-grey-800))',
                      border: '1px solid var(--dynamic-bg-color, var(--color-grey-600))',
                      borderRadius: 'var(--border-radius-lg)',
                      transition: 'all var(--transition-base)',
                      position: 'relative',
                      minHeight: '200px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Position Badge */}
                    <div style={{
                      position: 'absolute',
                      top: 'var(--space-3)',
                      left: 'var(--space-3)',
                      width: '32px',
                      height: '32px',
                      background: 'var(--dynamic-bg-color, var(--color-white))',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '700',
                      color: 'var(--dynamic-text-color, var(--color-black))',
                      border: '1px solid var(--dynamic-bg-color, var(--color-grey-600))',
                      zIndex: 3
                    }}>
                      {getPositionIcon(nft.leaderboard_position)}
                    </div>

                    {/* Left Info Section */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      gap: 'var(--space-2)',
                      flex: 1,
                      paddingRight: 'var(--space-3)',
                      paddingTop: 'var(--space-2)'
                    }}>
                      {/* Collection Name */}
                      <div 
                        style={{
                          fontSize: 'var(--font-size-md)',
                          color: 'var(--dynamic-bg-color, var(--color-white))',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'color var(--transition-base)',
                          lineHeight: 1.2
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (nft.contract_address) {
                            window.open(getCollectionMagicEdenUrl(nft.contract_address), '_blank');
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-green)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--dynamic-bg-color, var(--color-white))';
                        }}
                      >
                        {nft.collection_name}
                      </div>

                      {/* Token ID */}
                      <div 
                        style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: '900',
                          color: '#ffffff',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          transition: 'all var(--transition-base)',
                          lineHeight: 1
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (nft.contract_address && nft.token_id) {
                            window.open(getTokenMagicEdenUrl(nft.contract_address, nft.token_id), '_blank');
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-green)';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        #{nft.name.split('#')[1] || nft.token_id || 'N/A'}
                      </div>

                      {/* Price Display */}
                      {showPrices && (
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--dynamic-bg-color, var(--color-white))',
                          fontWeight: '500',
                          opacity: 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)'
                        }}>
                          <span>
                          {loadingPrices ? (
                            'Loading...'
                          ) : prices[nft.id] ? (
                            prices[nft.id]?.price ? (
                              `${prices[nft.id]!.price} ${prices[nft.id]!.currency}`
                            ) : (
                              'Unlisted'
                            )
                            ) : (nft.contract_address || COLLECTION_CONTRACTS[nft.collection_name]) && nft.token_id ? (
                            'Price unavailable'
                          ) : (
                            'No contract data'
                            )}
                          </span>
                          
                          {/* Make Offer Link - Only show if we have contract data */}
                          {(nft.contract_address || COLLECTION_CONTRACTS[nft.collection_name]) && nft.token_id && !loadingPrices && (
                            <a
                              href={getTokenMagicEdenUrl(nft.contract_address || COLLECTION_CONTRACTS[nft.collection_name], nft.token_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('🔗 Make Offer clicked for:', nft.contract_address || COLLECTION_CONTRACTS[nft.collection_name], nft.token_id);
                              }}
                              style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--dynamic-bg-color, var(--color-white))',
                                textDecoration: 'underline',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all var(--transition-base)',
                                opacity: 0.8
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--color-green)';
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--dynamic-bg-color, var(--color-white))';
                                e.currentTarget.style.opacity = '0.8';
                              }}
                            >
                              Make Offer
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* NFT Image - Right side, larger */}
                    <img
                      src={nft.image}
                      alt={nft.name}
                      style={{
                        width: '160px',
                        height: '160px',
                        borderRadius: 'var(--border-radius-md)',
                        objectFit: 'cover',
                        border: '2px solid var(--dynamic-bg-color, var(--color-grey-600))',
                        flexShrink: 0
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )) : (
            // User Leaderboard Content
            userLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-8)',
                color: 'var(--dynamic-text-color, var(--color-grey-300))'
              }}>
                Loading user leaderboard...
              </div>
            ) : userError ? (
              <div style={{
                padding: 'var(--space-4)',
                background: 'var(--color-red-900)',
                border: '1px solid var(--color-red-600)',
                borderRadius: 'var(--border-radius-md)',
                color: 'var(--color-red-200)'
              }}>
                Error: {userError}
              </div>
            ) : userLeaderboard.length === 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-8)',
                color: 'var(--dynamic-text-color, var(--color-grey-300))'
              }}>
                No user leaderboard data available
              </div>
            ) : (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)'
              }}>
                {userLeaderboard.map((user, index) => {
                  const isTopThree = index < 3;
                  const tasteLevelColor = user.taste_level.level >= 8 ? 'var(--color-green)' : 
                                         user.taste_level.level >= 5 ? 'var(--color-yellow)' : 
                                         'var(--dynamic-text-color, var(--color-grey-400))';
                  
                  const streakColor = user.voting_streak >= 7 ? 'var(--color-green)' : 
                                     user.voting_streak >= 3 ? 'var(--color-yellow)' : 
                                     'var(--dynamic-text-color, var(--color-grey-400))';
                  
                  return (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: 'var(--space-3)',
                        background: 'var(--dynamic-text-color, var(--color-grey-800))',
                        border: '1px solid var(--dynamic-bg-color, var(--color-grey-600))',
                        borderRadius: 'var(--border-radius-lg)',
                        transition: 'all var(--transition-base)',
                        position: 'relative',
                        minHeight: '60px'
                      }}
                    >
                      {/* Position Badge */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        background: isTopThree ? 'var(--color-green)' : 'var(--dynamic-bg-color, var(--color-white))',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '700',
                        color: isTopThree ? 'white' : 'var(--dynamic-text-color, var(--color-black))',
                        marginRight: 'var(--space-3)',
                        flexShrink: 0
                      }}>
                        {user.position}
                      </div>

                      {/* User Info - Single Line Layout */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: 1,
                        gap: 'var(--space-3)',
                        fontSize: 'var(--font-size-sm)'
                      }}>
                        {/* Display Name */}
                        <div style={{
                          fontSize: 'var(--font-size-md)',
                          fontWeight: '600',
                          color: 'var(--dynamic-bg-color, var(--color-white))',
                          minWidth: '120px',
                          flexShrink: 0
                        }}>
                          {user.display_name}
                        </div>
                        
                        {/* XP */}
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '500',
                          color: 'var(--dynamic-bg-color, var(--color-white))',
                          minWidth: '80px',
                          flexShrink: 0
                        }}>
                          {user.xp.toLocaleString()} XP
                        </div>
                        
                        {/* Taste Level */}
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          color: tasteLevelColor === 'var(--dynamic-text-color, var(--color-grey-400))' 
                            ? 'var(--dynamic-bg-color, var(--color-white))' 
                            : tasteLevelColor,
                          fontWeight: '500',
                          minWidth: '140px',
                          flexShrink: 0
                        }}>
                          {user.taste_level?.name || 'Unknown'}
                        </div>
                        
                        {/* Total Votes */}
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--dynamic-bg-color, var(--color-white))',
                          fontWeight: '500',
                          minWidth: '80px',
                          flexShrink: 0
                        }}>
                          {user.total_votes.toLocaleString()} votes
                        </div>
                        
                        {/* Voting Streak */}
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          color: user.voting_streak > 0 
                            ? (streakColor === 'var(--dynamic-text-color, var(--color-grey-400))' 
                                ? 'var(--dynamic-bg-color, var(--color-white))' 
                                : streakColor)
                            : 'var(--dynamic-bg-color, var(--color-white))',
                          fontWeight: '500',
                          minWidth: '60px',
                          flexShrink: 0,
                          opacity: user.voting_streak > 0 ? 1 : 0.5
                        }}>
                          {user.voting_streak > 0 ? `🔥 ${user.voting_streak}d` : '—'}
                        </div>
                        
                        {/* Votes per day */}
                        <div style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--dynamic-bg-color, var(--color-white))',
                          opacity: 0.8,
                          minWidth: '50px',
                          flexShrink: 0
                        }}>
                          {user.votes_per_day}/day
                        </div>
                        
                        {/* Days since joining */}
                        <div style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--dynamic-bg-color, var(--color-white))',
                          opacity: 0.7,
                          minWidth: '50px',
                          flexShrink: 0
                        }}>
                          {user.days_since_joining}d old
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
