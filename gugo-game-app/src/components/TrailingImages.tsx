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
  const imgRef = useRef<HTMLImageElement>(null);

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

      controls.stop();

      controls.set({
        opacity: isRunning.current ? 1 : 0.75,
        zIndex,
        transform: `${center(x, y)} scale(1)`,
        transition: { ease: "circOut" },
      });

      isRunning.current = true;

      await controls.start({
        opacity: 1,
        transform: `${center(newX, newY)} scale(1)`,
        transition: { duration: 0.9, ease: "circOut" },
      });

      await Promise.all([
        controls.start({
          transition: { duration: 1, ease: "easeInOut" },
          transform: `${center(newX, newY)} scale(0.1)`,
        }),
        controls.start({
          opacity: 0,
          transition: { duration: 1.1, ease: "easeOut" },
        }),
      ]);

      isRunning.current = false;
    },
  }));

  return (
    <motion.img
      ref={imgRef}
      initial={{ opacity: 0, scale: 1 }}
      animate={controls}
      src={src}
      alt="NFT trail element"
      className="absolute h-32 w-32 object-cover rounded-lg shadow-lg"
      style={{ pointerEvents: 'none' }}
    />
  );
});

AnimatedImage.displayName = "AnimatedImage";

// All 20 NFT images with correct file extensions!
const DEFAULT_IMAGES = [
  "/nft-images/NFT1.jpeg",
  "/nft-images/NFT2.jpeg",
  "/nft-images/NFT3.jpeg",
  "/nft-images/NFT4.png",     // PNG file
  "/nft-images/NFT5.jpeg",
  "/nft-images/NFT6.jpeg",
  "/nft-images/NFT7.png",     // PNG file
  "/nft-images/NFT8.jpeg",
  "/nft-images/NFT9.jpeg",
  "/nft-images/NFT10.jpeg",
  "/nft-images/NFT11.jpeg",
  "/nft-images/NFT12.jpeg",
  "/nft-images/NFT13.jpeg",
  "/nft-images/NFT14.jpeg",
  "/nft-images/NFT15.jpeg",
  "/nft-images/NFT16.png",    // PNG file
  "/nft-images/NFT17.png",    // PNG file
  "/nft-images/NFT18.jpeg",
  "/nft-images/NFT19.jpeg",
  "/nft-images/NFT20.jpeg",
];

interface TrailingImagesProps {
  images?: string[];
  className?: string;
}

const TrailingImages: React.FC<TrailingImagesProps> = ({ 
  images = DEFAULT_IMAGES,
  className = ""
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Create a maximum of 20 trails for a smoother experience
  const trailsRef = useRef(
    Array.from({ length: Math.max(20, images.length) }, createRef<AnimatedImageRef>),
  );

  const lastPosition = useRef({ x: 0, y: 0 });
  const cachedPosition = useRef({ x: 0, y: 0 });
  const imageIndex = useRef(0);
  const zIndex = useRef(1);

  const update = useCallback((cursor: { x: number; y: number }) => {

    
    const activeRefCount = trailsRef.current.filter((ref) => ref.current?.isActive()).length;
    if (activeRefCount === 0) {
      // Reset zIndex since there are no active references
      // This prevents zIndex from incrementing indefinitely
      zIndex.current = 1;
    }

    const distance = getDistance(
      cursor.x,
      cursor.y,
      lastPosition.current.x,
      lastPosition.current.y,
    );
    const threshold = 50;

    const newCachePosition = {
      x: lerp(cachedPosition.current.x || cursor.x, cursor.x, 0.1),
      y: lerp(cachedPosition.current.y || cursor.y, cursor.y, 0.1),
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
  }, []);

  useMousePosition(containerRef, update);

  // Direct mouse event listener for reliable tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      update({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [update]);

  return (
    <div 
      ref={containerRef} 
      className={`fixed inset-0 z-50 ${className}`}
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

export default TrailingImages;
