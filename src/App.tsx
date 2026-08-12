import React, { useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { ProductCatalogView } from './components/ProductCatalogView';
import { useGeminiLive } from './hooks/useGeminiLive';
import { SYSTEM_MESSAGE_SETTINGS } from './lib/SystemMessage';

/**
 * Resolve the merchant this session belongs to WITHOUT hardcoding any store.
 * Shopify embedded/marketplace installs always carry the store in the URL
 * (`?shop=store.myshopify.com`). We accept a few aliases and fall back to a
 * build-time override for local testing.
 */
function resolveMerchantDomain(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const raw =
    params.get('shop') ||
    params.get('merchant') ||
    params.get('store') ||
    (import.meta as any)?.env?.VITE_MERCHANT_DOMAIN ||
    '';
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);
  const merchantDomainRef = useRef<string>(resolveMerchantDomain());
  const merchantDomain = merchantDomainRef.current;

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
    isAgentActive,
    searchResults,
    clearAgentView,
    sendText,
  } = useGeminiLive({
    ...SYSTEM_MESSAGE_SETTINGS,
    merchantDomain,
  });

  React.useEffect(() => {
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

  // The agent takes over the screen once it has rendered products/checkout.
  const showProductStage = isConnected && isAgentActive && !!searchResults;

  return (
    <div className="min-h-[100svh] bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden selection:bg-brand-primary/30">
      <main
        ref={stageRef}
        className="flex-1 relative bg-black roast-gradient overflow-hidden"
      >
        <ConnectingOverlay show={status === 'connecting'} />

        <AnimatePresence mode="wait">
          {showProductStage ? (
            // Agent active: products fill the stage, orb drops into the PIP.
            <motion.div
              key="agent-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10"
            >
              <div className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-6">
                <ProductCatalogView
                  payload={searchResults}
                  merchantDomain={merchantDomain}
                  onClose={clearAgentView}
                  onSendFeedback={sendText}
                />
              </div>

              {/* Agent orb in PIP — sits above the footer, never overlapping it. */}
              <div className="absolute bottom-4 right-4 w-24 sm:w-28 md:w-36 aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl z-30 group">
                <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
                <button
                  onClick={clearAgentView}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Restore agent to full screen"
                  aria-label="Restore agent to full screen"
                >
                  <div className="w-3 h-3 border-t-2 border-l-2 border-white rounded-tl-sm" />
                </button>
              </div>
            </motion.div>
          ) : (
            // Default: full-screen orb with the user's camera PIP.
            <motion.div
              key="user-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <div className="absolute inset-0 pointer-events-none z-0">
                <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
              </div>

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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pre-call: centered phone button */}
        {!isConnected && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => startConnection('Aoede')}
              disabled={status === 'connecting'}
              className={cn(
                'pointer-events-auto relative flex items-center justify-center p-4 text-green-400',
                'active:scale-95 transition-all duration-300 touch-manipulation',
                status === 'connecting'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-110 hover:text-green-300',
              )}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <PhoneCallIcon ref={phoneIconRef} className="w-12 h-12 md:w-16 md:h-16" />
            </button>
          </div>
        )}
      </main>

      {/* Persistent footer — the End button never moves. */}
      {isConnected && (
        <footer
          className="shrink-0 border-t border-white/5 bg-zinc-950/85 backdrop-blur-md"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-center gap-12 pt-4 pb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-white/80 hover:text-white active:scale-90 transition-all touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Share a photo of a product"
              title="Share a photo of a product"
            >
              <ImagePlus size={26} />
            </button>

            <button
              type="button"
              onClick={disconnect}
              className="active:scale-90 transition-all touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="End call"
            >
              <PhoneOff size={32} className="text-red-500" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelected}
          />
        </footer>
      )}

      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}
