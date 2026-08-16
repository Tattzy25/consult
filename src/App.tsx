import React, { useRef } from 'react';
import { PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';
import { SYSTEM_MESSAGE_SETTINGS } from './lib/SystemMessage';

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);

  const {
    isConnected,
    cameraFacing,
    isAudioPlaying,
    micVolume,
    isUserTalking,
    status,
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    flipCamera,
  } = useGeminiLive(SYSTEM_MESSAGE_SETTINGS);

  React.useEffect(() => {
    if (status === "connecting") {
      phoneIconRef.current?.startAnimation();
    } else {
      phoneIconRef.current?.stopAnimation();
    }
  }, [status]);

  const visualMode: 'idle' | 'listening' | 'speaking' = isAudioPlaying
    ? 'speaking'
    : isUserTalking
      ? 'listening'
      : 'idle';

  const audioLevel = isAudioPlaying
    ? 0.85
    : isUserTalking
      ? 0.12 + (micVolume * 0.4)
      : 0.12;

  return (
    <div className="min-h-[100svh] bg-zinc-950 text-zinc-100 flex flex-col overflow-y-auto selection:bg-brand-primary/30">
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden h-full">
        <div
          ref={stageRef}
          className="flex-1 relative bg-black flex roast-gradient min-h-[100svh]"
        >
         <div className="absolute inset-y-0 left-0 w-1/3 -translate-y-[12%] pointer-events-none z-0">
         <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
         </div>

          <ConnectingOverlay show={status === "connecting"} />

          {/*
            CameraPreview is ALWAYS mounted so videoRef.current is non-null
            when startStreaming runs — this lets play() succeed immediately
            when the camera permission is granted (within the gesture context).
            It's invisible until the call is live.
          */}
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ opacity: isConnected ? 1 : 0, transition: 'opacity 0.3s' }}
          >
            <CameraPreview
              videoRef={videoRef}
              cameraFacing={cameraFacing}
              stageRef={stageRef}
              onFlip={flipCamera}
            />
          </div>

                    {/* Footer — call / end call, bottom center */}
          <footer
  className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4"
  style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
>
  <div className="pointer-events-auto flex min-h-[68px] min-w-[220px] items-center justify-center rounded-full border border-white/10 bg-zinc-950/80 px-8 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
    <AnimatePresence mode="wait" initial={false}>
      {!isConnected ? (
        <motion.button
          key="call"
          type="button"
          onClick={() => startConnection("Aoede")}
          disabled={status === "connecting"}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={cn(
            "relative flex h-12 w-12 items-center justify-center text-green-400",
            "active:scale-95 transition-all duration-300 touch-manipulation",
            status === "connecting" ? "opacity-50 cursor-not-allowed" : "hover:scale-110 hover:text-green-300"
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Start call"
        >
          <PhoneCallIcon ref={phoneIconRef} className="h-8 w-8" />
        </motion.button>
      ) : (
        <motion.button
          key="end"
          type="button"
          onClick={disconnect}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 active:scale-90 transition-all touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="End call"
        >
          <PhoneOff size={24} className="text-red-500" />
        </motion.button>
      )}
    </AnimatePresence>
  </div>
</footer>
        </div>
      </main>

      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}