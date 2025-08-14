"use client"

import { useState, useRef, useEffect, useCallback } from 'react';

// 🎵 Background music playlist
const MUSIC_PLAYLIST = [
  '/music/12 12 inst mix ab oz (1).mp3',
  '/music/1960s 2 house inst ab oz (1).mp3',
  '/music/all day ab oz inst (1).mp3',
  '/music/argon inst mix ab oz (1).mp3',
  '/music/b hh 1 inst mix ab oz (1).mp3',
  '/music/GB3AD1300063 (1).mp3',
  '/music/open sesames inst mix ab oz (1).mp3'
];

interface BackgroundMusicState {
  isPlaying: boolean;
  volume: number;
  currentTrack: number;
  isInitialized: boolean;
  hasStarted: boolean;
}

export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false); // Track started state with ref to avoid stale closures
  const [state, setState] = useState<BackgroundMusicState>({
    isPlaying: false,
    volume: 0.3, // Default 30% volume
    currentTrack: 0,
    isInitialized: false,
    hasStarted: false
  });

  // 🎲 Shuffle playlist function
  const shufflePlaylist = useCallback(() => {
    const shuffled = [...MUSIC_PLAYLIST];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const [playlist, setPlaylist] = useState<string[]>(() => shufflePlaylist());

  // 🎵 Initialize audio element
  const initializeAudio = useCallback(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume;
      audioRef.current.preload = 'none';
      
      // 🔄 Auto-advance to next track when current ends
      audioRef.current.addEventListener('ended', () => {
        setState(prev => {
          const nextTrack = (prev.currentTrack + 1) % playlist.length;
          
          // If we've played all tracks, reshuffle
          if (nextTrack === 0) {
            setPlaylist(shufflePlaylist());
          }
          
          return {
            ...prev,
            currentTrack: nextTrack
          };
        });
      });

      // 🎯 Handle loading errors gracefully
      audioRef.current.addEventListener('error', (e) => {
        console.log('🎵 Audio loading error (graceful fallback):', e);
        // Try next track on error
        setState(prev => ({
          ...prev,
          currentTrack: (prev.currentTrack + 1) % playlist.length
        }));
      });

      setState(prev => ({ ...prev, isInitialized: true }));
    }
  }, [state.volume, playlist.length, shufflePlaylist]);

  // 🎮 Start music on first vote
  const startMusicOnFirstVote = useCallback(() => {
    // Always ensure state is synchronized with ref
    if (hasStartedRef.current && !state.hasStarted) {
      setState(prev => ({ ...prev, hasStarted: true, isPlaying: true }));
      return;
    }
    
    if (!hasStartedRef.current) {
      // 🎵 Set ref first to prevent multiple calls
      hasStartedRef.current = true;
      
      // 🎵 Initialize audio
      initializeAudio();
      
      // 🎵 Update state and start playing
      setState(prev => ({ 
        ...prev, 
        hasStarted: true,
        isPlaying: true,
        currentTrack: 0
      }));
      
      // 🎵 Start playing immediately
      setTimeout(() => {
        if (audioRef.current && playlist.length > 0) {
          audioRef.current.src = playlist[0];
          audioRef.current.play().catch(error => {
            console.log('🎵 First vote playback failed:', error);
          });
        }
      }, 100);
    }
  }, [initializeAudio, playlist, state.hasStarted]);

  // ▶️ Play/Pause toggle
  const togglePlayback = useCallback(() => {
    console.log('🎵 togglePlayback called! Current state:', { isPlaying: state.isPlaying, hasAudio: !!audioRef.current });
    
    if (!audioRef.current) {
      console.log('🎵 No audio element, initializing...');
      initializeAudio();
      return;
    }

    if (state.isPlaying) {
      console.log('🎵 Pausing audio...');
      audioRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } else {
      console.log('🎵 Playing audio...');
      audioRef.current.play().catch(error => {
        console.log('🎵 Playback failed (user interaction required):', error);
      });
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, initializeAudio]);

  // 🔊 Volume control
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    
    setState(prev => ({ ...prev, volume: clampedVolume }));
  }, []);

  // 🔇 Mute toggle
  const toggleMute = useCallback(() => {
    if (state.volume > 0) {
      setVolume(0);
    } else {
      setVolume(0.3); // Restore to 30%
    }
  }, [state.volume, setVolume]);

  // ⏭️ Skip to next track
  const skipTrack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentTrack: (prev.currentTrack + 1) % playlist.length
    }));
  }, [playlist.length]);

  // 🎵 Update audio source when track changes
  useEffect(() => {
    if (audioRef.current && state.isInitialized && playlist.length > 0) {
      const newSrc = playlist[state.currentTrack];
      
      if (audioRef.current.src !== newSrc) {
        audioRef.current.src = newSrc;
        
        if (state.isPlaying) {
          audioRef.current.play().catch(error => {
            console.log('🎵 Track change playback failed:', error);
          });
        }
      }
    }
  }, [state.currentTrack, state.isInitialized, state.isPlaying, playlist]);

  // 🧹 Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('ended', () => {});
        audioRef.current.removeEventListener('error', () => {});
      }
    };
  }, []);

  return {
    // State
    isPlaying: state.isPlaying,
    volume: state.volume,
    currentTrack: state.currentTrack,
    currentTrackName: playlist[state.currentTrack]?.split('/').pop()?.replace('.mp3', '').replace(' (1)', '').replace(' inst mix ab oz', '').replace(' ab oz inst', '').replace(' inst mix', '').trim() || 'Unknown',
    hasStarted: state.hasStarted,
    
    // Actions
    startMusicOnFirstVote,
    togglePlayback,
    setVolume,
    toggleMute,
    skipTrack,
    
    // Utils
    isMuted: state.volume === 0,
    volumePercentage: Math.round(state.volume * 100)
  };
}
