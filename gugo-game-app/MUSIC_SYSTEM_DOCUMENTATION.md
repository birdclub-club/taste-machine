# 🎵 Background Music System Documentation

## Overview

The GUGO Background Music System provides an immersive audio experience that enhances user engagement during voting sessions. The system features auto-play functionality, shuffle capabilities, volume controls, and seamless state management across the application.

## 🎯 Features

### Core Functionality
- **Auto-Play on First Vote**: Music starts automatically when user casts their first vote
- **Shuffle Playlist**: Randomized track selection from 7 curated MP3 files
- **Volume Control**: Slider with mute functionality and visual feedback
- **Play/Pause Toggle**: SVG icons with hover states and smooth transitions
- **Global State Management**: React Context ensures consistent experience
- **URL Encoding**: Handles special characters in MP3 filenames

### User Experience
- **Non-Intrusive**: Controls appear only after music starts
- **Visual Feedback**: Icons change based on play/pause state
- **Hover Effects**: Interactive elements provide clear affordance
- **Persistent Controls**: Always visible once music begins
- **Volume Memory**: Remembers user's volume preference

## 🏗 Architecture

### Component Structure
```
MusicContext (Global State)
├── AudioControls (UI Component)
├── Main App (Trigger Logic)
└── Audio Element (HTML5 Audio)
```

### File Organization
```
/src/contexts/MusicContext.tsx     # Global music state management
/src/components/AudioControls.tsx  # UI controls component
/src/hooks/useBackgroundMusic.ts   # Custom hook (deprecated)
/public/music/                     # MP3 audio files (7 tracks)
```

## 🔧 Technical Implementation

### MusicContext Provider
```typescript
// Global state management
interface MusicContextType {
  isPlaying: boolean;
  volume: number;
  currentTrack: string;
  isInitialized: boolean;
  hasStarted: boolean;
  startMusicOnFirstVote: () => void;
  togglePlayback: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}
```

### Key Functions

#### Music Initialization
```typescript
const initializeAudio = useCallback(() => {
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    audioRef.current.addEventListener('ended', () => {
      shufflePlaylist();
    });
  }
}, [volume]);
```

#### Shuffle Algorithm
```typescript
const shufflePlaylist = useCallback(() => {
  const randomIndex = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
  const selectedTrack = MUSIC_PLAYLIST[randomIndex];
  
  if (audioRef.current) {
    audioRef.current.src = encodeURI(`/music/${selectedTrack}`);
    audioRef.current.load();
    if (hasStartedRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }
  
  setCurrentTrack(selectedTrack);
}, []);
```

### Playlist Configuration
```typescript
const MUSIC_PLAYLIST = [
  '12 12 inst mix ab oz (1).mp3',
  '1960s 2 house inst ab oz (1).mp3',
  'GB3AD1300063 (1).mp3',
  'all day ab oz inst (1).mp3',
  'argon inst mix ab oz (1).mp3',
  'b hh 1 inst mix ab oz (1).mp3',
  'open sesames inst mix ab oz (1).mp3'
];
```

## 🎨 UI Components

### AudioControls Component
Located at the bottom of the main interface, next to the "Taste Activity" counter.

#### Visual Design
- **Play/Pause Button**: SVG icons with smooth transitions
- **Volume Slider**: Vertical slider with percentage display
- **Hover Effects**: Visual feedback on interactive elements
- **Consistent Styling**: Matches app's Swiss minimalist design

#### SVG Icons
```typescript
// Play Icon
<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M8 5v14l11-7z"/>
</svg>

// Pause Icon
<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
</svg>
```

### Responsive Behavior
- **Desktop**: Horizontal layout with clear spacing
- **Mobile**: Compact layout optimized for touch
- **Always Visible**: Controls remain accessible once music starts

## 🔄 State Management

### React Context Pattern
```typescript
// Provider wraps entire app
<MusicProvider>
  <App />
</MusicProvider>

// Components consume context
const { isPlaying, togglePlayback } = useMusic();
```

### State Synchronization
- **Global State**: Single source of truth for music status
- **Ref Management**: Prevents stale closures in event handlers
- **Event Listeners**: Automatic track progression and error handling

### Memory Management
```typescript
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }
  };
}, []);
```

## 🎵 Audio File Management

### File Requirements
- **Format**: MP3 for broad browser compatibility
- **Quality**: Optimized for web delivery (128-192 kbps recommended)
- **Length**: 2-5 minutes per track for variety
- **Naming**: URL-safe filenames (spaces and special characters handled)

### Current Playlist
1. **12 12 inst mix ab oz (1).mp3** - Electronic instrumental
2. **1960s 2 house inst ab oz (1).mp3** - Retro house track
3. **GB3AD1300063 (1).mp3** - Ambient composition
4. **all day ab oz inst (1).mp3** - Upbeat instrumental
5. **argon inst mix ab oz (1).mp3** - Atmospheric track
6. **b hh 1 inst mix ab oz (1).mp3** - Hip-hop influenced
7. **open sesames inst mix ab oz (1).mp3** - Experimental sound

### Adding New Tracks
1. Place MP3 files in `/public/music/` directory
2. Update `MUSIC_PLAYLIST` array in `MusicContext.tsx`
3. Ensure filenames are properly encoded for URLs

## 🐛 Troubleshooting

### Common Issues

#### Music Not Starting
- **Check Browser Autoplay Policy**: Some browsers block autoplay
- **Verify File Paths**: Ensure MP3 files exist in `/public/music/`
- **Console Errors**: Check browser console for loading errors

#### Controls Not Visible
- **State Check**: Verify `hasStarted` is true after first vote
- **CSS Issues**: Check for overlapping elements or z-index problems
- **React Portal**: Component uses portal for reliable rendering

#### Volume Issues
- **Browser Limits**: Some browsers limit volume control
- **Mute State**: Check if browser or system is muted
- **Audio Context**: Verify HTML5 Audio element is properly initialized

### Debug Tools
```javascript
// Browser console debugging
console.log('Music state:', {
  isPlaying: musicContext.isPlaying,
  volume: musicContext.volume,
  hasStarted: musicContext.hasStarted,
  currentTrack: musicContext.currentTrack
});

// Check audio element
console.log('Audio element:', audioRef.current);
console.log('Audio src:', audioRef.current?.src);
```

## 🔧 Development

### Local Development
```bash
# Ensure music files are in place
ls public/music/

# Start development server
npm run dev

# Test music functionality
# 1. Connect wallet
# 2. Cast first vote
# 3. Verify music starts and controls appear
```

### Testing Checklist
- [ ] Music starts on first vote
- [ ] Play/pause button functions correctly
- [ ] Volume slider adjusts audio level
- [ ] Mute button works as expected
- [ ] Tracks shuffle automatically when ended
- [ ] Controls remain visible after music starts
- [ ] No console errors during playback

## 🚀 Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Audio files loaded only when needed
- **Memory Management**: Proper cleanup of audio elements
- **Event Debouncing**: Prevents excessive state updates
- **Efficient Re-renders**: Context optimized to minimize re-renders

### Browser Compatibility
- **HTML5 Audio**: Supported in all modern browsers
- **MP3 Format**: Universal browser support
- **Autoplay Handling**: Graceful fallback for restrictive policies

## 🔮 Future Enhancements

### Planned Features
- **Track Selection**: Allow users to choose specific tracks
- **Crossfade**: Smooth transitions between tracks
- **Visualizer**: Audio visualization during playback
- **Playlist Management**: User-customizable playlists
- **Volume Presets**: Quick volume level selections

### Advanced Features
- **Spatial Audio**: 3D audio positioning
- **Dynamic Volume**: Adjust based on user activity
- **Mood-Based Selection**: Track selection based on voting patterns
- **Social Features**: Share favorite tracks with other users

---

**Designed to enhance the GUGO voting experience through immersive audio** 🎵
