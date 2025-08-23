import React, { createRef, forwardRef, useCallback, useImperativeHandle, useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";

import { useMousePosition } from "@/hooks/useMousePosition";
import { getDistance, lerp } from "@/lib/utils";

interface AnimatedImageRef {
  show: ({
    x,
    y,
    newX,
    newY,
    zIndex,
  }: {
    x: number;
    y: number;
    zIndex: number;
    newX: number;
    newY: number;
  }) => void;
  isActive: () => boolean;
}

const AnimatedImage = forwardRef<AnimatedImageRef, { src: string }>(({ src }, ref) => {
  const controls = useAnimation();
  const isRunning = useRef(false);
  const isMounted = useRef(false);
  const isReady = useRef(false);
  const readyTimer = useRef<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Track component mount/unmount state and animation readiness
  useEffect(() => {
    isMounted.current = true;
    // Add an even longer delay to ensure controls are fully initialized
    readyTimer.current = setTimeout(() => {
      if (isMounted.current && controls) {
        isReady.current = true;
      }
    }, 500); // Increased delay significantly
    
    return () => {
      if (readyTimer.current) {
        clearTimeout(readyTimer.current);
        readyTimer.current = null;
      }
      isMounted.current = false;
      isReady.current = false;
      isRunning.current = false;
    };
  }, [controls]);

  useImperativeHandle(ref, () => ({
    isActive: () => isRunning.current,
    show: async ({
      x,
      y,
      newX,
      newY,
      zIndex,
    }: {
      x: number;
      y: number;
      zIndex: number;
      newX: number;
      newY: number;
    }) => {
      // Schedule animation in next tick to ensure component is fully mounted
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Don't start animations if component is unmounted, not ready, or controls don't exist
      if (!isMounted.current || !isReady.current || !controls || isRunning.current) {
        console.log('🎨 PrizeTrailingImages: Skipping animation - not ready or already running', {
          mounted: isMounted.current,
          ready: isReady.current,
          hasControls: !!controls,
          running: isRunning.current
        });
        return;
      }

      const rect = imgRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const center = (posX: number, posY: number) => {
        const coords = {
          x: posX - rect.width / 2,
          y: posY - rect.height / 2,
        };
        return `translate(${coords.x}px, ${coords.y}px)`;
      };

      // Triple check before any animation calls
      if (!isMounted.current || !isReady.current || !controls) {
        console.log('🎨 PrizeTrailingImages: Animation cancelled - component state changed');
        return;
      }

      try {
        controls.stop();

        controls.set({
          opacity: isRunning.current ? 1 : 0.8,
          zIndex,
          transform: `${center(x, y)} scale(1)`,
          transition: { ease: "circOut" },
        });

        isRunning.current = true;
      } catch (error) {
        console.error('🎨 PrizeTrailingImages: Animation error:', error);
        return;
      }

      try {
        // Double check that controls are ready and component is still mounted
        if (!isMounted.current || !isReady.current || !controls) {
          console.log('🎨 PrizeTrailingImages: Skipping start animation - not ready');
          return;
        }
        
        await controls.start({
          opacity: 1,
          transform: `${center(newX, newY)} scale(1)`,
          transition: { duration: 0.7, ease: "circOut" },
        });

        // Check again before second animation
        if (!isMounted.current || !isReady.current || !controls) {
          console.log('🎨 PrizeTrailingImages: Skipping final animation - not ready');
          return;
        }

        await Promise.all([
          controls.start({
            transition: { duration: 0.8, ease: "easeInOut" },
            transform: `${center(newX, newY)} scale(0.1)`,
          }),
          controls.start({
            opacity: 0,
            transition: { duration: 0.9, ease: "easeOut" },
          }),
        ]);
      } catch (error) {
        // Silently handle animation errors when component is unmounted or controls not ready
        console.log('🎨 PrizeTrailingImages: Animation interrupted:', error);
      }

      isRunning.current = false;
    },
  }));

  return (
    <motion.img
      ref={imgRef}
      initial={{ opacity: 0, scale: 1 }}
      animate={controls}
      src={src}
      alt="Prize trail element"
      className="absolute h-20 w-20 object-contain rounded-lg"
      style={{ 
        pointerEvents: 'none',
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))'
      }}
    />
  );
});

AnimatedImage.displayName = "AnimatedImage";

// Prize-specific image sets
const XP_VOTES_IMAGES = [
  "/Taste-Machine-Monster-Abstract-Green-150x150.png", // Monster logo
  "/lick-icon.png", // Licks icon
];

const GUGO_IMAGES = [
  "/GUGO-Duck-Burning-Bags.png", // Burning GUGO duck
  "/GOGO-duck-at-easel-01.png", // Art duck
  "/GUGO-Duck-Holding-NFTs.png", // Duck holding NFTs
  "/GUGO-Duck-Stealing-Art.png", // Duck stealing art
  "/GUGO-Duck-with-bag.png", // Duck with GUGO bag
];

interface PrizeTrailingImagesProps {
  rewardType: 'gugo' | 'xp-votes';
  isActive: boolean;
  className?: string;
}

const PrizeTrailingImages: React.FC<PrizeTrailingImagesProps> = ({ 
  rewardType,
  isActive,
  className = ""
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const images = rewardType === 'gugo' ? GUGO_IMAGES : XP_VOTES_IMAGES;
  
  // Create trails for the images (more trails for GUGO rewards since we have more images)
  const trailsRef = useRef(
    Array.from({ length: rewardType === 'gugo' ? 12 : 8 }, createRef<AnimatedImageRef>),
  );

  const lastPosition = useRef({ x: 0, y: 0 });
  const cachedPosition = useRef({ x: 0, y: 0 });
  const imageIndex = useRef(0);
  const zIndex = useRef(1);

  const update = useCallback((cursor: { x: number; y: number }) => {
    if (!isActive) return; // Only trail when active
    
    const activeRefCount = trailsRef.current.filter((ref) => ref.current?.isActive()).length;
    if (activeRefCount === 0) {
      // Reset zIndex since there are no active references
      zIndex.current = 1;
    }

    const distance = getDistance(
      cursor.x,
      cursor.y,
      lastPosition.current.x,
      lastPosition.current.y,
    );
    const threshold = 40; // Slightly more sensitive than landing page

    const newCachePosition = {
      x: lerp(cachedPosition.current.x || cursor.x, cursor.x, 0.15), // Slightly more responsive
      y: lerp(cachedPosition.current.y || cursor.y, cursor.y, 0.15),
    };
    cachedPosition.current = newCachePosition;

    if (distance > threshold) {
      imageIndex.current = (imageIndex.current + 1) % trailsRef.current.length;
      zIndex.current = zIndex.current + 1;
      lastPosition.current = cursor;
      trailsRef.current[imageIndex.current].current?.show?.({
        x: newCachePosition.x,
        y: newCachePosition.y,
        zIndex: zIndex.current,
        newX: cursor.x,
        newY: cursor.y,
      });
    }
  }, [isActive]);

  useMousePosition(containerRef, update);

  // Direct mouse event listener for reliable tracking
  useEffect(() => {
    if (!isActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      update({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [update, isActive]);

  // Cleanup all animations when component becomes inactive
  useEffect(() => {
    if (!isActive) {
      // Stop all running animations
      trailsRef.current.forEach(ref => {
        if (ref.current?.isActive()) {
          // Reset the running state to prevent further animations
          try {
            // This will be handled gracefully by the isMounted checks
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div 
      ref={containerRef} 
      className={`fixed inset-0 z-40 ${className}`}
      style={{ pointerEvents: 'none' }}
    >
      {trailsRef.current.map((ref, index) => (
        <AnimatedImage 
          key={index} 
          ref={ref} 
          src={images[index % images.length]} 
        />
      ))}
    </div>
  );
};

export default PrizeTrailingImages;
