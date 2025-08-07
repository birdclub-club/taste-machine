"use client"

import React, { useState, useEffect, useRef } from 'react';
import MatchupCard from '@/components/MatchupCard';
import type { VotingSession } from '@/types/voting';
import { votingPreloader } from '@lib/preloader';

interface StackedMatchupsProps {
  onVote: (winnerId: string, superVote: boolean) => void;
  onNoVote?: () => void;
  onImageFailure?: () => void;
  isVoting?: boolean;
  preference?: string;
  totalNftCount?: number | null;
}

interface StackedSession {
  session: VotingSession;
  id: string;
  zIndex: number;
  isVisible: boolean;
  isAnimating: boolean;
}

const STACK_SIZE = 3; // Number of matchups to keep pre-loaded

export default function StackedMatchups({ 
  onVote, 
  onNoVote, 
  onImageFailure, 
  isVoting = false,
  preference,
  totalNftCount 
}: StackedMatchupsProps) {
  const [matchupStack, setMatchupStack] = useState<StackedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const stackIdCounter = useRef(0);

  // Initialize the stack with pre-loaded matchups
  useEffect(() => {
    initializeStack();
  }, [preference]);

  const initializeStack = async () => {
    console.log('🏗️ Initializing matchup stack...');
    setIsLoading(true);
    
    const initialStack: StackedSession[] = [];
    
    // Load STACK_SIZE matchups in parallel
    const loadPromises = Array.from({ length: STACK_SIZE }, async (_, index) => {
      const session = votingPreloader.getNextSession();
      if (session) {
        return {
          session,
          id: `stack-${++stackIdCounter.current}`,
          zIndex: 1000 - index, // Top layer has highest z-index
          isVisible: index === 0, // Only top matchup is visible initially
          isAnimating: false
        };
      }
      return null;
    });

    const loadedSessions = await Promise.all(loadPromises);
    const validSessions = loadedSessions.filter(Boolean) as StackedSession[];
    
    setMatchupStack(validSessions);
    setIsLoading(false);
    
    console.log(`✅ Stack initialized with ${validSessions.length} matchups`);
  };

  // Handle vote with instant transition
  const handleVoteWithStack = async (winnerId: string, superVote: boolean = false) => {
    if (matchupStack.length === 0 || isVoting) return;

    console.log('⚡ Stack vote: instant transition starting...');

    // 1. Call the actual vote handler
    onVote(winnerId, superVote);

    // 2. Animate current top layer out and next layer in
    setMatchupStack(prevStack => {
      const newStack = [...prevStack];
      
      // Mark top layer as animating out
      if (newStack[0]) {
        newStack[0].isAnimating = true;
      }
      
      // Make next layer visible
      if (newStack[1]) {
        newStack[1].isVisible = true;
      }
      
      return newStack;
    });

    // 3. After animation delay, remove top layer and add new one at bottom
    setTimeout(async () => {
      setMatchupStack(prevStack => {
        const newStack = prevStack.slice(1); // Remove top layer
        
        // Update z-indexes and visibility
        newStack.forEach((stackedSession, index) => {
          stackedSession.zIndex = 1000 - index;
          stackedSession.isVisible = index === 0;
          stackedSession.isAnimating = false;
        });
        
        return newStack;
      });

      // 4. Load new matchup for bottom of stack (background)
      const newSession = votingPreloader.getNextSession();
      if (newSession) {
        const newStackedSession: StackedSession = {
          session: newSession,
          id: `stack-${++stackIdCounter.current}`,
          zIndex: 1000 - (STACK_SIZE - 1),
          isVisible: false,
          isAnimating: false
        };

        setMatchupStack(prevStack => [...prevStack, newStackedSession]);
        console.log('📚 Added new matchup to bottom of stack');
      }
    }, 300); // Match this with CSS transition duration
  };

  const handleImageFailure = () => {
    console.log('❌ Image failure in stack, removing current matchup...');
    
    // Skip current matchup by moving to next one
    setMatchupStack(prevStack => {
      const newStack = prevStack.slice(1);
      
      // Update z-indexes and visibility
      newStack.forEach((stackedSession, index) => {
        stackedSession.zIndex = 1000 - index;
        stackedSession.isVisible = index === 0;
        stackedSession.isAnimating = false;
      });
      
      return newStack;
    });

    // Load replacement matchup
    setTimeout(async () => {
      const newSession = votingPreloader.getNextSession();
      if (newSession) {
        const newStackedSession: StackedSession = {
          session: newSession,
          id: `stack-${++stackIdCounter.current}`,
          zIndex: 1000 - (STACK_SIZE - 1),
          isVisible: false,
          isAnimating: false
        };

        setMatchupStack(prevStack => [...prevStack, newStackedSession]);
      }
    }, 100);

    // Call parent failure handler if provided
    onImageFailure?.();
  };

  if (isLoading || matchupStack.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: 'var(--color-white)',
        fontSize: 'var(--font-size-lg)'
      }}>
        🔄 Loading matchups from {totalNftCount ? totalNftCount.toLocaleString() : '...'} NFTs...
      </div>
    );
  }

  const currentMatchup = matchupStack[0];

  return (
    <div style={{ 
      position: 'relative',
      width: '100%',
      height: '100%'
    }}>
      {matchupStack.map((stackedSession, index) => {
        const { session, id, zIndex, isVisible, isAnimating } = stackedSession;
        
        if (session.vote_type !== 'same_coll' && session.vote_type !== 'cross_coll') {
          return null; // Skip slider sessions in stack
        }

        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex,
              opacity: isVisible ? 1 : 0,
              transform: isAnimating ? 'scale(0.95) translateY(-20px)' : 'scale(1) translateY(0)',
              transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
              pointerEvents: index === 0 && isVisible ? 'auto' : 'none' // Only top layer interactive
            }}
          >
            <MatchupCard
              nft1={session.nft1}
              nft2={session.nft2}
              onVote={handleVoteWithStack}
              onNoVote={onNoVote}
              onImageFailure={handleImageFailure}
              isVoting={isVoting}
            />
          </div>
        );
      })}
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 2000
        }}>
          Stack: {matchupStack.length} loaded
        </div>
      )}
    </div>
  );
}