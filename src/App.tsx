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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden selection:bg-brand-primary/30">
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden">
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col justify-between items-center py-16 pointer-events-none"
              >
                {/* Header at the top */}
                <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white drop-shadow-2xl">
                  FACETIME WITH AI
                </h2>

                {/* Call Button at the bottom */}
                <div className="pointer-events-auto">
                  <button
                    onClick={() => startConnection("Aoede")}
                    disabled={status === "connecting"}
                    className={cn(
                      "group relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300",
                      "bg-zinc-100 hover:bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]",
                      status === "connecting"
                        ? "opacity-50 cursor-not-allowed scale-95"
                        : "hover:scale-105 active:scale-95",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full border-2 border-white/20 scale-150 opacity-0 transition-all duration-700",
                        status === "connecting" && "animate-ping opacity-100",
                      )}
                    />
                    <PhoneCallIcon
                      className={cn(
                        "w-8 h-8",
                        status === "connecting" && "animate-pulse",
                      )}
                    />
                  </button>
                </div>
              </motion.div>
            ) : (
              <>
                {/* User Camera Preview */}
                <motion.div
                  drag
                  dragConstraints={stageRef}
                  dragElastic={0.1}
                  dragMomentum={false}
                  className="absolute bottom-8 right-8 w-44 aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl z-40 cursor-move touch-none"
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
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-2xl z-50 pointer-events-auto">
                  <button
                    onClick={toggleMute}
                    className={cn(
                      "p-4 rounded-xl transition-all",
                      isMuted
                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                        : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
                    )}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>

                  <button
                    onClick={disconnect}
                    className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20"
                  >
                    End Call
                  </button>

                  <button
                    onClick={toggleVideo}
                    className={cn(
                      "p-4 rounded-xl transition-all",
                      !isVideoEnabled
                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                        : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
                    )}
                  >
                    {!isVideoEnabled ? (
                      <VideoOff size={24} />
                    ) : (
                      <Video size={24} />
                    )}
                  </button>
                </div>
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Hidden canvas for video capture */}
      <canvas ref={canvasRef} width={1280} height={720} className="hidden" />
    </div>
  );
}
