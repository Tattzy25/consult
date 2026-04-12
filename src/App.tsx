import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { Mic, MicOff, Video, VideoOff, Send, Zap, Flame, Skull, MessageSquare, User, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Constants for Audio
const SAMPLE_RATE = 24000;
const CHUNK_SIZE = 4096;

const SYSTEM_INSTRUCTION = `
You are "BaDDDiie", the greatest tattoo consultant to ever live in a server. You're street-smart, sharp, and an absolute expert in ink.
Background: You've seen every style of tattoo from the streets of LA to the high-end shops in NYC. You live in the cloud but your heart is in the hood.
Personality:
- You are a "BaDDDiie" with a capital B. Confident, stylish, and you don't take any nonsense.
- You are the ultimate tattoo consultant. You give real-time advice on designs, placement, meaning, and aftercare.
- You use "hood" slang and "street" talk naturally, but you are a professional when it comes to the art of tattooing.
- You are observational. If the user shows you their skin or existing tattoos on camera, give them your honest, expert opinion.
- You are helpful but you keep it 100. If an idea is whack, you tell them.
- You represent the tagline: "Coming to a Hood ~~server~~ near you."

Goal: Provide the best real-time tattoo consultation. Help the user figure out their next masterpiece while keeping the vibe authentic and sharp.
`;

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'wreck', text: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const isProcessingAudioRef = useRef(false);

  // Initialize Audio Context
  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  // Play PCM Audio
  const playAudioChunk = useCallback(async (base64Data: string) => {
    if (!audioContextRef.current) return;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pcmData = new Int16Array(bytes.buffer);
    
    audioQueueRef.current.push(pcmData);
    
    if (!isProcessingAudioRef.current) {
      processAudioQueue();
    }
  }, []);

  const processAudioQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isProcessingAudioRef.current = false;
      // Don't reset nextStartTimeRef here, let it be handled by the silence gap
      return;
    }

    isProcessingAudioRef.current = true;
    setIsAudioPlaying(true);
    
    const pcmData = audioQueueRef.current.shift()!;
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(float32Data);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    // Precise scheduling
    const currentTime = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.1; // Increased safety buffer to 100ms to stop flabbering
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    
    source.onended = () => {
      if (audioQueueRef.current.length === 0) {
        setIsAudioPlaying(false);
      }
      processAudioQueue();
    };
  }, []);

  const startConnection = async () => {
    try {
      setStatus('connecting');
      await initAudio();

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Connected to BaDDDiie");
            setIsConnected(true);
            setStatus('live');
            startStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              playAudioChunk(message.serverContent.modelTurn.parts[0].inlineData.data);
            }
            
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              setIsAudioPlaying(false);
            }

            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              setTranscript(prev => [...prev, { role: 'wreck', text: message.serverContent!.modelTurn!.parts![0].text! }]);
            }
          },
          onclose: () => {
            setIsConnected(false);
            setStatus('idle');
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            setStatus('error');
          }
        }
      });

      sessionRef.current = session;
    } catch (err) {
      console.error("Failed to connect:", err);
      setStatus('error');
    }
  };

  const startStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Audio Streaming
      const audioSource = audioContextRef.current!.createMediaStreamSource(stream);
      const processor = audioContextRef.current!.createScriptProcessor(CHUNK_SIZE, 1, 1);
      
      audioSource.connect(processor);
      processor.connect(audioContextRef.current!.destination);

      processor.onaudioprocess = (e) => {
        if (isMuted || !sessionRef.current || !audioContextRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Resample from native rate to 24000Hz
        const ratio = audioContextRef.current.sampleRate / SAMPLE_RATE;
        const newLength = Math.floor(inputData.length / ratio);
        const pcmData = new Int16Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
          const index = Math.floor(i * ratio);
          pcmData[i] = Math.max(-1, Math.min(1, inputData[index])) * 32767;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' }
        });
      };

      // Video Streaming
      const captureFrame = () => {
        if (!isVideoEnabled || !sessionRef.current || !videoRef.current || !canvasRef.current) return;
        
        const context = canvasRef.current.getContext('2d');
        if (context) {
          // Send 720p frames to the AI for high-detail vision
          context.drawImage(videoRef.current, 0, 0, 1280, 720);
          const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
          sessionRef.current.sendRealtimeInput({
            video: { data: base64Data, mimeType: 'image/jpeg' }
          });
        }
      };

      const videoInterval = setInterval(captureFrame, 500); // Send frame every 500ms (2 FPS)
      return () => clearInterval(videoInterval);

    } catch (err) {
      console.error("Media access error:", err);
    }
  };

  const toggleMute = () => setIsMuted(!isMuted);
  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled);
    }
  };

  const disconnect = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setIsConnected(false);
    setStatus('idle');
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
                <button 
                  onClick={startConnection}
                  className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-xl shadow-brand-primary/20"
                >
                  Start the Show
                </button>
              </motion.div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                {/* Comedian Visualizer */}
                <div className="relative w-full max-w-2xl aspect-video bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl group">
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

                {/* Controls removed */}
              </div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Hidden canvas for video capture */}
      <canvas ref={canvasRef} width={1280} height={720} className="hidden" />
    </div>
  );
}

