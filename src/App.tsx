import React, { useRef } from 'react';
import { Mic, MicOff, SwitchCamera, Phone, ImagePlus, Video, VideoOff, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { WreckShader } from './components/WreckShader';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { GeneratedImageOverlay } from './components/ui/GeneratedImageOverlay';

import { Dock, type DockItem } from './components/ui/Dock';
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
    isVideoEnabled,
    toggleVideo,
    generatedImage,
    setGeneratedImage
  } = useGeminiLive(SYSTEM_INSTRUCTION);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        if (base64Data) {
          sendImage(base64Data);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const dockItems: DockItem[] = [
    {
      icon: isMuted ? <MicOff className="text-red-500" /> : <Mic />,
      label: isMuted ? "Unmute" : "Mute",
      onClick: toggleMute,
    },
    {
      icon: !isVideoEnabled ? <VideoOff className="text-red-500" /> : <Video />,
      label: !isVideoEnabled ? "Start Video" : "Stop Video",
      onClick: toggleVideo,
    },

    {
      icon: <ImagePlus />,
      label: "Upload Image",
      onClick: () => fileInputRef.current?.click(),
    },
    {
      icon: <SwitchCamera />,
      label: "Flip Camera",
      onClick: flipCamera,
    },
    {
      icon: <PhoneOff className="text-red-500" />,
      label: "End Call",
      onClick: disconnect,
    },
  ];

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
        {/* Stage Area */}
        <div
            ref={stageRef}
            className="flex-1 relative bg-black flex roast-gradient min-h-[500px]"
          >
          {/* Always mounted WreckShader */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <WreckShader
              audioLevel={audioLevel}
              visualMode={visualMode}
            />
          </div>

          <AnimatePresence>
            {generatedImage && (
              <GeneratedImageOverlay
                imageUrl={generatedImage}
                onClose={() => setGeneratedImage(null)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div
                key="disconnected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 pointer-events-auto"
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
                  cameraFacing={cameraFacing}
                  stageRef={stageRef}
                />

                {/* Horizontal Dock - MOVED UP TO AVOID IOS HOME BAR */}
                <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                  <Dock items={dockItems} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Hidden file input for image uploads */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Hidden canvas for video capture */}
      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}
