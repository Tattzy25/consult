import React, { useRef, useState, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';
import { SYSTEM_MESSAGE_SETTINGS } from './lib/SystemMessage';
import { createIntentHandler, intents } from './lib/intentApi';
import { fetchShopperMessages, type ShopperMessages } from './lib/shopperMessages';

type PipContent = 'user' | 'agent';

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);

  const [pipContent, setPipContent] = useState<PipContent>('user');
  const [shopperMessages, setShopperMessages] = useState<ShopperMessages | null>(null);

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
    sendText,
    shopperMessage,
    clearShopperError,
    updateShopperMessages,
  } = useGeminiLive({
    ...SYSTEM_MESSAGE_SETTINGS,
    onAgentActive: () => {
      setPipContent('agent');
    },
    onAgentInactive: () => {
      // Don't auto-switch back - let user control via UCP drawer
    },
  });

  // Fetch merchant-customized messages on mount
  useEffect(() => {
    fetchShopperMessages().then((messages) => {
      setShopperMessages(messages);
      updateShopperMessages(messages);
    });
  }, [updateShopperMessages]);

  // Create intent handler for product interactions
  const intentHandler = React.useMemo(
    () => createIntentHandler(sendText),
    [sendText]
  );

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

  // Handle UCP drawer click - switch back to user camera view
  const handleUcpDrawerClick = () => {
    setPipContent('user');
    clearShopperError();
  };

  // Handle product click - send intent to Gemini
  const handleProductClick = (productId: string, storeDomain: string) => {
    intentHandler.sendIntent(intents.viewProductDetails(productId, storeDomain));
  };

  // Handle add to cart - send intent to Gemini
  const handleAddToCart = (variantId: string, storeDomain: string) => {
    intentHandler.sendIntent(intents.addToCart(variantId, storeDomain));
  };

  return (
    <div className="min-h-[100svh] bg-zinc-950 text-zinc-100 flex flex-col overflow-y-auto selection:bg-brand-primary/30">
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden h-full">
        <div
          ref={stageRef}
          className="flex-1 relative bg-black flex roast-gradient min-h-[100svh]"
        >
          {/* Shopper error message overlay */}
          <AnimatePresence>
            {shopperMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
              >
                <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg">
                  {shopperMessage}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ConnectingOverlay show={status === "connecting"} />

          {/* Main content - switches based on agent activity */}
          <AnimatePresence mode="wait">
            {pipContent === 'user' ? (
              // Normal state: Full screen orb + user camera PIP
              <motion.div
                key="user-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                {/* Orb — full screen behind everything */}
                <div className="absolute inset-0 pointer-events-none z-0">
                  <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
                </div>

                {/* User camera PIP */}
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
            ) : (
              // Agent active state: Products in center + orb in PIP
              <motion.div
                key="agent-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10"
              >
                {/* Product display in center */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {searchResults.map((product: any, index: number) => {
                        const variant = product.variants?.[0];
                        const price = variant?.price_range?.min;
                        return (
                          <motion.div
                            key={product.id || index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-zinc-900/80 backdrop-blur-sm rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all"
                          >
                            {variant?.image?.url && (
                              <div className="aspect-square bg-zinc-800">
                                <img
                                  src={variant.image.url}
                                  alt={product.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="p-4">
                              <h3 className="font-medium text-sm line-clamp-2 mb-2">
                                {product.title}
                              </h3>
                              {price && (
                                <p className="text-zinc-400 text-sm mb-3">
                                  {price.currency} {(price.amount / 100).toFixed(2)}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleProductClick(product.id, variant?.seller?.domain)}
                                  className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors"
                                >
                                  View Details
                                </button>
                                {variant?.id && variant?.seller?.domain && (
                                  <button
                                    onClick={() => handleAddToCart(variant.id, variant.seller.domain)}
                                    className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <ShoppingCart size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Agent orb in PIP window */}
                <div className="absolute bottom-28 right-4 md:bottom-8 md:right-8 w-24 sm:w-32 md:w-44 aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl z-50">
                  <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
                </div>

                {/* UCP Drawer button */}
                <button
                  onClick={handleUcpDrawerClick}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-zinc-800/90 backdrop-blur-sm hover:bg-zinc-700/90 rounded-full border border-zinc-700 transition-all active:scale-95"
                >
                  <span className="text-sm font-medium">Back to Call</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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
                <button
                  type="button"
                  onClick={() => startConnection("Aoede")}
                  disabled={status === "connecting"}
                  className={cn(
                    "relative flex items-center justify-center p-4 text-green-400",
                    "active:scale-95 transition-all duration-300 touch-manipulation",
                    status === "connecting" ? "opacity-50 cursor-not-allowed" : "hover:scale-110 hover:text-green-300"
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
                    onClick={disconnect}
                    className="active:scale-90 transition-all touch-manipulation"
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

      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}
