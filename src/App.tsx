import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import {
  PhoneCallIcon,
  type PhoneCallIconHandle,
} from './components/ui/phone-call';
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
    isMuted,
    cameraFacing,
    isAudioPlaying,
    micVolume,
    isUserTalking,
    status,
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    toggleMute,
    flipCamera,
  } = useGeminiLive(SYSTEM_MESSAGE_SETTINGS);

  useEffect(() => {
    if (status === 'connecting') {
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
      ? 0.12 + micVolume * 0.4
      : 0.12;

  return (
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-brand-primary/30">
      <main className="flex h-full w-full flex-1 flex-col overflow-hidden">
        <div
          ref={stageRef}
          className="relative flex h-full w-full shrink-0 bg-black roast-gradient"
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
          </div>

          <ConnectingOverlay show={status === 'connecting'} />

          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              opacity: isConnected ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          >
            <CameraPreview
              videoRef={videoRef}
              cameraFacing={cameraFacing}
              stageRef={stageRef}
              onFlip={flipCamera}
            />
          </div>

          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div
                key="disconnected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-auto absolute bottom-12 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => startConnection('Aoede')}
                  disabled={status === 'connecting'}
                  className={cn(
                    'relative flex items-center justify-center p-4 text-green-400',
                    'touch-manipulation transition-all duration-300 active:scale-95',
                    status === 'connecting'
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:scale-110 hover:text-green-300',
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <PhoneCallIcon
                    ref={phoneIconRef}
                    className="h-12 w-12 md:h-16 md:w-16"
                  />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="connected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-0 bottom-6 z-20 md:bottom-0"
                style={{
                  paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                }}
              >
                <div className="pointer-events-auto flex items-center justify-center gap-8">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="touch-manipulation text-white/80 transition-all hover:text-white active:scale-90"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {isMuted ? (
                      <MicOff size={26} className="text-red-400" />
                    ) : (
                      <Mic size={26} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={disconnect}
                    className="touch-manipulation transition-all active:scale-90"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <PhoneOff size={32} className="text-red-500" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ display: 'none' }}
      />
    </div>
  );
}