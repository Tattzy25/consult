import React, { useState, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';

const SYSTEM_INSTRUCTION = `
You are a helpful assistant with vision, spund and voice capbilities.
`;

export default function App() {
  const [selectedVoice, setSelectedVoice] = useState('Aoede');
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

  const handleStartConnection = () => {
    startConnection(selectedVoice);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden selection:bg-brand-primary/30">
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden">
        {/* Stage Area */}
        <div ref={stageRef} className="flex-1 relative bg-black flex items-center justify-center roast-gradient">
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center max-w-md p-8"
              >
                <div className="mb-6 relative inline-block">
                  <div className="absolute inset-0 bg-brand-primary blur-3xl opacity-20 animate-pulse" />
                </div>
                <h2 className="text-4xl font-display font-bold mb-4">FACETIME WITH AI</h2>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                  BaDDDiie is the greatest tattoo consultant in real-time. 
                  Coming to a Hood <span className="line-through opacity-50">server</span> near you. 
                  The consultant that lives in your pocket.
                </p>
                
                <div className="mb-8">
                  <p className="text-sm text-zinc-500 mb-3 uppercase tracking-wider font-bold">Select Voice</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['Aoede', 'Charon', 'Fenrir', 'Kore'].map((voice) => (
                      <button
                        key={voice}
                        onClick={() => setSelectedVoice(voice)}
                        className={cn(
                          "py-3 rounded-xl font-bold transition-all border",
                          selectedVoice === voice 
                            ? "bg-brand-primary/20 border-brand-primary text-brand-primary" 
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        )}
                      >
                        {voice}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleStartConnection}
                  disabled={status === 'connecting'}
                  className={cn(
                    "w-full py-4 bg-brand-primary text-white rounded-xl font-bold text-lg transition-transform shadow-xl shadow-brand-primary/20",
                    status === 'connecting' ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >
                  {status === 'connecting' ? 'Connecting...' : 'Start the Show'}
                </button>
              </motion.div>
            ) : (
              <>
                {/* Comedian Visualizer (The Blob) */}
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
                  <WreckShader audioLevel={isAudioPlaying ? 0.8 : 0.0} isAudioPlaying={isAudioPlaying} />
                </div>

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
                    className={cn("w-full h-full object-cover pointer-events-none -scale-x-100", !isVideoEnabled && "hidden")} 
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
                      isMuted ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
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
                      !isVideoEnabled ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                    )}
                  >
                    {!isVideoEnabled ? <VideoOff size={24} /> : <Video size={24} />}
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
