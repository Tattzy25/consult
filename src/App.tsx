import React, { useRef } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { WreckShader } from './components/WreckShader';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { useGeminiLive } from './hooks/useGeminiLive';

const SYSTEM_INSTRUCTION = `
You are a helpful assistant with vision, spund and voice capbilities.
`;

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);

  const {
    isConnected,
    isMuted,
    isVideoEnabled,
    isAudioPlaying,
    micVolume,
    isUserTalking,
    status,
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    toggleMute,
    toggleVideo
  } = useGeminiLive(SYSTEM_INSTRUCTION);

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
    <div className="h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden touch-manipulation selection:bg-brand-primary/30">
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden h-full">
        {/* Stage Area */}
        <div
          ref={stageRef}
          className="flex-1 relative bg-black flex items-center justify-center roast-gradient"
        >
          {/* Always mounted WreckShader */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <WreckShader
              audioLevel={audioLevel}
              visualMode={visualMode}
            />
          </div>

          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div
                key="disconnected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col justify-end items-center p-[10px]"
              >
                {/* Call Button at the bottom */}
                <button
                  type="button"
                  onClick={() => startConnection("Aoede")}
                  disabled={status === "connecting"}
                  className={cn(
                    "relative flex items-center justify-center p-4 text-white",
                    "active:scale-95 transition-all duration-300 touch-manipulation",
                    status === "connecting" ? "opacity-50 cursor-not-allowed" : "hover:scale-110 hover:text-zinc-300"
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <PhoneCallIcon
                    ref={phoneIconRef}
                    className="w-12 h-12 md:w-16 md:h-16"
                  />
                </button>
              </motion.div>
            ) : (
              <motion.div key="connected-screen" className="absolute inset-0 z-10 pointer-events-none">
                {/* User Camera Preview */}
                <CameraPreview
                  videoRef={videoRef}
                  isVideoEnabled={isVideoEnabled}
                  stageRef={stageRef}
                />

                {/* Controls */}
                <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-4 px-4 py-3 md:px-6 md:py-4 bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-2xl z-50 pointer-events-auto w-[90%] max-w-sm sm:w-auto">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={cn(
                      "p-3 md:p-4 rounded-xl transition-all",
                      isMuted
                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                        : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
                    )}
                  >
                    {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>

                  <button
                    type="button"
                    onClick={disconnect}
                    className="px-6 py-3 md:px-8 md:py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 text-sm md:text-base whitespace-nowrap"
                  >
                    End Call
                  </button>

                  <button
                    type="button"
                    onClick={toggleVideo}
                    className={cn(
                      "p-3 md:p-4 rounded-xl transition-all",
                      !isVideoEnabled
                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                        : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
                    )}
                  >
                    {!isVideoEnabled ? (
                      <VideoOff className="w-5 h-5 md:w-6 md:h-6" />
                    ) : (
                      <Video className="w-5 h-5 md:w-6 md:h-6" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Hidden canvas for video capture */}
      <canvas ref={canvasRef} width={1280} height={720} className="hidden" />
    </div>
  );
}
