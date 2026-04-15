import React, { useRef } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { WreckShader } from './components/WreckShader';
import { PhoneCallIcon } from './components/ui/phone-call';
import { useGeminiLive } from './hooks/useGeminiLive';

const SYSTEM_INSTRUCTION = `
You are a helpful assistant with vision, spund and voice capbilities.
`;

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isMuted,
    isVideoEnabled,
    isAudioPlaying,
    status,
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    toggleMute,
    toggleVideo
  } = useGeminiLive(SYSTEM_INSTRUCTION);

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
              audioLevel={isAudioPlaying ? 0.85 : 0.12}
              isAudioPlaying={isAudioPlaying}
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
                    "relative flex items-center justify-center w-20 h-20 md:w-20 md:h-20 rounded-full",
                    "bg-zinc-100 hover:bg-white text-black",
                    "shadow-[0_0_40px_rgba(255,255,255,0.2)]",
                    "active:scale-95 transition-all duration-300 touch-manipulation",
                    status === "connecting" ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full border-2 border-white/20 scale-150 opacity-0 transition-all duration-700",
                      status === "connecting" && "animate-ping opacity-100"
                    )}
                  />
                  <PhoneCallIcon
                    className={cn(
                      "w-8 h-8",
                      status === "connecting" && "animate-pulse"
                    )}
                  />
                </button>
              </motion.div>
            ) : (
              <motion.div key="connected-screen" className="absolute inset-0 z-10 pointer-events-none">
                {/* User Camera Preview */}
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
                      !isVideoEnabled && "hidden",
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
