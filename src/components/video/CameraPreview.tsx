import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraFacing: 'user' | 'environment';
  stageRef: React.RefObject<HTMLDivElement | null>;
  onFlip: () => void;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  cameraFacing,
  stageRef,
  onFlip,
}) => {
  const lastTapRef = useRef(0);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) onFlip();
    lastTapRef.current = now;
  };

  return (
    <motion.div
      drag
      dragConstraints={stageRef}
      dragElastic={0.1}
      dragMomentum={false}
      onTap={handleTap}
      className="absolute bottom-28 right-4 md:top-auto md:bottom-8 md:right-8 w-24 sm:w-32 md:w-44 aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl z-50 cursor-move touch-none pointer-events-auto"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          "w-full h-full object-cover pointer-events-none",
          cameraFacing === "user" && "-scale-x-100"
        )}
      />
    </motion.div>
  );
};
