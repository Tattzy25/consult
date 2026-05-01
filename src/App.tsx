import React, { useRef, useState } from 'react';
import { Mic, MicOff, ImagePlus, PhoneOff, Share2, Bell, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { WreckShader } from './components/WreckShader';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { GeneratedImageOverlay } from './components/ui/GeneratedImageOverlay';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { useGeminiLive } from './hooks/useGeminiLive';
import { PERSONA_CONFIG } from './lib/persona';
import { VOICES, DEFAULT_VOICE_ID } from './lib/voices';

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_ID);
  const [showImageOverlay, setShowImageOverlay] = useState(false);

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
    sendImage,
    generatedImage,
  } = useGeminiLive(PERSONA_CONFIG);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    sendImage(dataUrl.split(',')[1]);
  };

  const handleShare = async () => {
    if (!generatedImage) return;
    await navigator.share({ title: 'Tattoo Design', url: generatedImage });
  };

  React.useEffect(() => {
    if (status === "connecting") {
      phoneIconRef.current?.startAnimation();
    } else {
      phoneIconRef.current?.stopAnimation();
    }
  }, [status]);

  React.useEffect(() => {
    if (generatedImage) setShowImageOverlay(false);
  }, [generatedImage]);

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
          {/* Orb — always behind everything */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
          </div>

          <AnimatePresence>
            {generatedImage && showImageOverlay && (
              <GeneratedImageOverlay
                imageUrl={generatedImage}
                onClose={() => setShowImageOverlay(false)}
              />
            )}
          </AnimatePresence>

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

          {/* Phone button (pre-call) / Dock (in-call) */}
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div
                key="disconnected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-4"
              >
                <div className="flex gap-2">
                  {VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedVoice(voice.id)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 touch-manipulation",
                        selectedVoice === voice.id
                          ? "bg-white text-black"
                          : "bg-white/10 text-white hover:bg-white/20"
                      )}
                    >
                      {voice.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => startConnection(selectedVoice)}
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
              <motion.div
                key="connected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
                style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
              >
                <div className="flex items-center justify-center gap-8 pointer-events-auto">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-white/80 hover:text-white active:scale-90 transition-all touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {isMuted ? <MicOff size={26} className="text-red-400" /> : <Mic size={26} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-white/80 hover:text-white active:scale-90 transition-all touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <ImagePlus size={26} />
                  </button>

                  <button
                    type="button"
                    onClick={disconnect}
                    className="active:scale-90 transition-all touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <PhoneOff size={32} className="text-red-500" />
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="text-white/80 hover:text-white active:scale-90 transition-all touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <Share2 size={26} />
                  </button>

                  <button
                    type="button"
                    disabled={!generatedImage}
                    onClick={() => setShowImageOverlay(true)}
                    className="relative active:scale-90 transition-all touch-manipulation disabled:cursor-default"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {generatedImage && !showImageOverlay ? (
                      <>
                        <BellRing size={26} className="text-white" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                      </>
                    ) : (
                      <Bell size={26} className="text-white/80" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
      />

      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}
