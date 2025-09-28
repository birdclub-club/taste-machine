'use client';

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

// 🎵 Music playlist
const MUSIC_PLAYLIST = [
  '/music/12 12 inst mix ab oz (1).mp3',
  '/music/1960s 2 house inst ab oz (1).mp3',
  '/music/all day ab oz inst (1).mp3',
  '/music/argon inst mix ab oz (1).mp3',
  '/music/b hh 1 inst mix ab oz (1).mp3',
  '/music/GB3AD1300063 (1).mp3',
  '/music/open sesames inst mix ab oz (1).mp3'
];

interface MusicState {
  isPlaying: boolean;
  volume: number;
  currentTrack: number;
  isInitialized: boolean;
  hasStarted: boolean;
}

interface MusicContextType {
  // State
  isPlaying: boolean;
  volume: number;
  volumePercentage: number;
  isMuted: boolean;
  hasStarted: boolean;
  currentTrackName: string;
  
  // Actions
  startMusicOnFirstVote: () => void;
  togglePlayback: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false);
  const [playlist] = useState(() => [...MUSIC_PLAYLIST].sort(() => Math.random() - 0.5));
  
  const [state, setState] = useState<MusicState>({
    isPlaying: false,
    volume: 0.3,
    currentTrack: 0,
    isInitialized: false,
    hasStarted: false
  });

  // 🎵 Initialize audio element
  const initializeAudio = useCallback(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      console.log('🎵 Initializing audio element...');
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume;
      audioRef.current.preload = 'metadata';
      
      // Set up event listeners
      audioRef.current.addEventListener('ended', () => {
        console.log('🎵 Track ended, playing next...');
        setState(prev => ({
          ...prev,
          currentTrack: (prev.currentTrack + 1) % playlist.length
        }));
      });

      audioRef.current.addEventListener('error', (e) => {
        console.log('🎵 Audio error:', e);
      });

      setState(prev => ({ ...prev, isInitialized: true }));
    }
  }, [state.volume, playlist.length]);

  // 🎮 Start music on first vote
  const startMusicOnFirstVote = useCallback(() => {
    console.log('🎵 [GLOBAL] startMusicOnFirstVote called, hasStarted:', hasStartedRef.current);
    
    if (!hasStartedRef.current) {
      console.log('🎵 [GLOBAL] Starting music for first time');
      
      hasStartedRef.current = true;
      initializeAudio();
      
      setState(prev => ({ 
        ...prev, 
        hasStarted: true,
        isPlaying: true,
        currentTrack: 0
      }));
      
      // Start playing immediately
      setTimeout(() => {
        if (audioRef.current && playlist.length > 0) {
          const encodedSrc = encodeURI(playlist[0]);
          console.log('🎵 [GLOBAL] Setting audio source and playing:', encodedSrc);
          audioRef.current.src = encodedSrc;
          audioRef.current.play().catch(error => {
            console.log('🎵 [GLOBAL] First vote playback failed:', error);
          });
        }
      }, 100);
    }
  }, [initializeAudio, playlist]);

  // ▶️ Play/Pause toggle
  const togglePlayback = useCallback(() => {
    console.log('🎵 [GLOBAL] togglePlayback called! Current state:', { isPlaying: state.isPlaying, hasAudio: !!audioRef.current });
    
    if (!audioRef.current) {
      console.log('🎵 [GLOBAL] No audio element, initializing...');
      initializeAudio();
      return;
    }

    if (state.isPlaying) {
      console.log('🎵 [GLOBAL] Pausing audio...');
      audioRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } else {
      console.log('🎵 [GLOBAL] Playing audio...');
      // Ensure we have a source set
      if (!audioRef.current.src && playlist.length > 0) {
        audioRef.current.src = encodeURI(playlist[state.currentTrack]);
      }
      audioRef.current.play().catch(error => {
        console.log('🎵 [GLOBAL] Playback failed:', error);
      });
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, initializeAudio]);

  // 🔊 Volume control
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setState(prev => ({ ...prev, volume: clampedVolume }));
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // 🔇 Mute toggle
  const toggleMute = useCallback(() => {
    console.log('🎵 [GLOBAL] toggleMute called! Current volume:', state.volume);
    
    if (audioRef.current) {
      if (audioRef.current.volume > 0) {
        audioRef.current.volume = 0;
        setState(prev => ({ ...prev, volume: 0 }));
      } else {
        audioRef.current.volume = 0.3;
        setState(prev => ({ ...prev, volume: 0.3 }));
      }
    }
  }, [state.volume]);

  // 🎵 Handle track changes
  useEffect(() => {
    if (audioRef.current && state.isPlaying && playlist.length > 0) {
      const newSrc = encodeURI(playlist[state.currentTrack]);
      const currentSrc = audioRef.current.src;
      if (!currentSrc.includes(newSrc.split('/').pop() || '')) {
        console.log('🎵 [GLOBAL] Changing track to:', newSrc);
        audioRef.current.src = newSrc;
        audioRef.current.play().catch(error => {
          console.log('🎵 [GLOBAL] Track change playback failed:', error);
        });
      }
    }
  }, [state.currentTrack, state.isPlaying, playlist]);

  // Computed values
  const volumePercentage = Math.round(state.volume * 100);
  const isMuted = state.volume === 0;
  const currentTrackName = playlist[state.currentTrack]?.split('/').pop()?.replace('.mp3', '') || 'Unknown';

  const contextValue: MusicContextType = {
    // State
    isPlaying: state.isPlaying,
    volume: state.volume,
    volumePercentage,
    isMuted,
    hasStarted: state.hasStarted,
    currentTrackName,
    
    // Actions
    startMusicOnFirstVote,
    togglePlayback,
    setVolume,
    toggleMute
  };

  return (
    <MusicContext.Provider value={contextValue}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
