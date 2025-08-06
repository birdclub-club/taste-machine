/**
 * Hook for managing session keys in the Taste Machine game
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  SessionKeyData, 
  SessionAction, 
  createGamingSession, 
  getStoredSessionKey, 
  clearSessionKey, 
  hasValidSession 
} from '../../lib/session-keys';

export interface SessionStatus {
  hasActiveSession: boolean;
  sessionData: SessionKeyData | null;
  timeRemaining: number; // milliseconds
  isExpired: boolean;
  canPerformAction: (action: SessionAction) => boolean;
}

export function useSessionKey() {
  const { address, isConnected, connector } = useAccount();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    hasActiveSession: false,
    sessionData: null,
    timeRemaining: 0,
    isExpired: false,
    canPerformAction: () => false
  });
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Update session status
  const updateSessionStatus = () => {
    const sessionData = getStoredSessionKey();
    const now = Date.now();
    
    if (!sessionData) {
      setSessionStatus({
        hasActiveSession: false,
        sessionData: null,
        timeRemaining: 0,
        isExpired: false,
        canPerformAction: () => false
      });
      return;
    }

    const timeRemaining = Math.max(0, sessionData.expiresAt - now);
    const isExpired = timeRemaining === 0;

    setSessionStatus({
      hasActiveSession: !isExpired,
      sessionData,
      timeRemaining,
      isExpired,
      canPerformAction: (action: SessionAction) => !isExpired && sessionData.actionsAllowed.includes(action)
    });
  };

  // Check if current wallet is AGW
  const isAGW = () => {
    return connector?.name?.toLowerCase().includes('abstract') || false;
  };

  // Create a new session
  const createSession = async (): Promise<boolean> => {
    if (!address || !isConnected) {
      setSessionError('Wallet not connected');
      return false;
    }

    setIsCreatingSession(true);
    setSessionError(null);

    try {
      console.log('🔑 Creating new gaming session...', {
        wallet: connector?.name,
        isAGW: isAGW()
      });
      
      // Clear any existing session first
      clearSessionKey();
      
      if (isAGW()) {
        // Use AGW's native session system
        console.log('🚀 Using AGW native session creation...');
        return await createAGWSession();
      } else {
        // Use custom session key system for MetaMask/other wallets
        console.log('🔐 Using custom session key system for non-AGW wallet...');
        return await createCustomSession();
      }

    } catch (error: any) {
      console.error('❌ Failed to create session:', error);
      
      if (error.message.includes('rejected') || error.message.includes('denied')) {
        setSessionError('Session authorization was cancelled');
      } else {
        setSessionError(error.message || 'Failed to create session');
      }
      
      return false;
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Create AGW native session
  const createAGWSession = async (): Promise<boolean> => {
    try {
      console.log('🎯 AGW native session not available in functional component context');
      console.log('🔄 AGW requires hook usage - falling back to custom session...');
      
      // Note: AGW's useCreateSession is a hook and can't be called in async functions
      // For now, we'll fall back to custom session system
      // TODO: Refactor to use AGW hooks at component level
      
      // Fallback to custom session system
      return await createCustomSession();
      
    } catch (agwError: any) {
      console.error('❌ AGW native session creation failed:', agwError);
      console.log('🔄 Falling back to custom session system...');
      
      // Fallback to custom session system
      return await createCustomSession();
    }
  };

  // Create custom session (for MetaMask and other wallets)
  const createCustomSession = async (): Promise<boolean> => {
    if (!address) {
      throw new Error('Wallet address not available');
    }
    
    try {
      console.log('🔐 Creating custom session key...');
      
      // Create new session (this will prompt user to sign)
      const sessionData = await createGamingSession(address);
      
      console.log('✅ Custom gaming session created successfully:', {
        sessionKey: sessionData.sessionPublicKey,
        expiresAt: new Date(sessionData.expiresAt).toISOString(),
        actions: sessionData.actionsAllowed
      });
      
      // Update session status
      updateSessionStatus();
      
      return true;
      
    } catch (error) {
      console.error('❌ Custom session creation failed:', error);
      throw error;
    }
  };

  // Renew session (extend expiry)
  const renewSession = async (): Promise<boolean> => {
    return await createSession(); // For simplicity, just create a new session
  };

  // End session manually
  const endSession = () => {
    clearSessionKey();
    updateSessionStatus();
    console.log('🔒 Session ended manually');
  };

  // Format time remaining for display
  const formatTimeRemaining = (milliseconds: number): string => {
    if (milliseconds <= 0) return 'Expired';
    
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Check if session needs renewal soon (less than 30 minutes)
  const needsRenewal = sessionStatus.timeRemaining > 0 && sessionStatus.timeRemaining < (30 * 60 * 1000);

  // Update session status periodically
  useEffect(() => {
    updateSessionStatus();
    
    // Update every minute to keep time remaining current
    const interval = setInterval(updateSessionStatus, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [address, isConnected]);

  // Clear session when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      clearSessionKey();
      updateSessionStatus();
    }
  }, [isConnected]);

  return {
    // Session status
    sessionStatus,
    needsRenewal,
    
    // Actions
    createSession,
    renewSession,
    endSession,
    
    // State
    isCreatingSession,
    sessionError,
    
    // Utilities
    formatTimeRemaining: (ms?: number) => formatTimeRemaining(ms || sessionStatus.timeRemaining),
    canPerformAction: sessionStatus.canPerformAction,
    
    // Quick checks
    hasValidSession: (action: SessionAction) => hasValidSession(action),
    isSessionActive: sessionStatus.hasActiveSession && !sessionStatus.isExpired
  };
}