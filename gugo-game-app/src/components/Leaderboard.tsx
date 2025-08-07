"use client"

import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  id: string;
  name: string;
  image: string;
  collection_name: string;
  total_votes: number;
  wins: number;
  current_elo: number;
  fire_votes: number;
  poa_score: number;
  confidence_score: number;
  leaderboard_position: number;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const getPositionIcon = (position: number) => {
    return `${position}`;
  };

  return (
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
      zIndex: 1000,
      padding: 'var(--space-4)'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-grey-800)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--space-6)',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '1px solid var(--color-grey-600)',
        position: 'relative'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--color-grey-600)',
          paddingBottom: 'var(--space-4)'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: '600',
              color: 'var(--color-white)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              TASTE LEADERBOARD
            </h2>
            <p style={{
              margin: 'var(--space-1) 0 0 0',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-grey-300)'
            }}>
              Top 20 NFTs by aesthetic score on Abstract Chain
            </p>
          </div>
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

        {/* Metadata - Hidden for demo */}

        {/* Content */}
        <div style={{
          maxHeight: '60vh',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-8)',
              color: 'var(--color-grey-300)'
            }}>
              Loading leaderboard...
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
              color: 'var(--color-grey-300)'
            }}>
              No leaderboard data available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {leaderboard.map((nft, index) => {
                const isTopThree = index < 3;
                const hasFireVotes = nft.fire_votes > 0;
                
                return (
                  <div
                    key={nft.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: isTopThree 
                        ? (hasFireVotes ? 'var(--color-green-900)' : 'var(--color-grey-700)')
                        : (hasFireVotes ? 'var(--color-green-950)' : 'var(--color-grey-800)'),
                      border: `1px solid ${isTopThree 
                        ? (hasFireVotes ? 'var(--color-green-600)' : 'var(--color-grey-500)')
                        : (hasFireVotes ? 'var(--color-green-700)' : 'var(--color-grey-600)')}`,
                      borderRadius: 'var(--border-radius-md)',
                      transition: 'all var(--transition-base)'
                    }}
                  >
                    {/* Position */}
                    <div style={{
                      minWidth: '40px',
                      textAlign: 'center',
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: '600'
                    }}>
                      {getPositionIcon(nft.leaderboard_position)}
                    </div>

                    {/* Remove FIRE indicator for demo */}

                    {/* NFT Image */}
                    <img
                      src={nft.image}
                      alt={nft.name}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: 'var(--border-radius-md)',
                        objectFit: 'cover',
                        border: '1px solid var(--color-grey-600)'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />

                    {/* NFT Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--font-size-md)',
                        fontWeight: '600',
                        color: 'var(--color-white)',
                        marginBottom: 'var(--space-1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {nft.name}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-grey-300)',
                        marginBottom: 'var(--space-1)'
                      }}>
                        {nft.collection_name}
                      </div>
                      {/* Token ID hidden for demo */}
                    </div>

                    {/* Scores section hidden for demo */}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
