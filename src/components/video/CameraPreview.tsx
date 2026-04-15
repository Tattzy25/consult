import React from 'react';
import { motion } from 'motion/react';
import { VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  isVideoEnabled,
  stageRef,
}) => {
  return (
    <motion.div
      drag
      dragConstraints={stageRef}
      dragElastic={0.1}
      dragMomentum={false}
      className="absolute top-4 right-4 md:top-auto md:bottom-8 md:right-8 w-24 sm:w-32 md:w-44 aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl z-40 cursor-move touch-none pointer-events-auto"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          "w-full h-full object-cover pointer-events-none -scale-x-100",
          !isVideoEnabled && "hidden"
        )}
      />
      {!isVideoEnabled && (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900 pointer-events-none">
          <VideoOff className="text-zinc-700" />
        </div>
      )}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[8px] font-bold uppercase pointer-events-none">
        You
      </div>
    </motion.div>
  );
};
