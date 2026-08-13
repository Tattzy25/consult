import React, { useRef, useState } from 'react';
import { ImagePlus, PhoneOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';
import { buildAgentIntent, getPrimaryVariant, getProductsFromPayload } from './lib/agentStageEvents';
import { SYSTEM_MESSAGE_SETTINGS } from './lib/SystemMessage';

/**
 * Resolve the merchant this session belongs to from runtime URL state only.
 * Shopify embedded installs carry the store in the URL.
 */
function resolveMerchantDomain(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const raw =
    params.get('shop') ||
    params.get('merchant') ||
    params.get('store') ||
    '';
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function formatMoney(amount?: number, currency?: string) {
  if (typeof amount !== 'number') return null;
  const value = Number.isFinite(amount) ? amount / 100 : amount;
  return `${currency || ''} ${value.toFixed(2)}`.trim();
}

function renderTopLevelSummary(payload: any) {
  if (!payload || typeof payload !== 'object') return null;

  const totals = Array.isArray(payload.totals) ? payload.totals : [];
  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
        {payload.status ? <span>Status: {payload.status}</span> : null}
        {payload.id ? <span className="truncate">ID: {payload.id}</span> : null}
        {payload.currency ? <span>Currency: {payload.currency}</span> : null}
      </div>

      {lineItems.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Line items</div>
          {lineItems.map((item: any, index: number) => (
            <div key={item?.id || item?.item?.id || index} className="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-200">
              <div>{item?.title || item?.item?.title || item?.item?.id || 'Line item'}</div>
              <div className="text-zinc-400">Quantity: {item?.quantity ?? 1}</div>
            </div>
          ))}
        </div>
      ) : null}

      {totals.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Totals</div>
          {totals.map((entry: any, index: number) => (
            <div key={entry?.type || index} className="flex items-center justify-between text-sm text-zinc-200">
              <span>{entry?.display_text || entry?.type || 'total'}</span>
              <span>{formatMoney(entry?.amount, payload.currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);
  const launcherIconRef = useRef<PhoneCallIconHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const merchantDomainRef = useRef<string>(resolveMerchantDomain());
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const merchantDomain = merchantDomainRef.current;

  const {
    isConnected,
    cameraFacing,
    isAudioPlaying,
    micVolume,
    isUserTalking,
    status,
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    flipCamera,
    isAgentActive,
    searchResults,
    clearAgentView,
    sendText,
    sendImage,
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

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64) sendImage(base64, file.type);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

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
  const stageProducts = getProductsFromPayload(searchResults);

  const openLauncher = () => {
    launcherIconRef.current?.startAnimation();
    setIsLauncherOpen(true);
    window.parent.postMessage('FACETIME_OPEN', '*');
  };

  const closeLauncher = () => {
    if (isConnected) {
      disconnect();
      window.parent.postMessage('FACETIME_CLOSE', '*');
    }
    setIsLauncherOpen(false);
  };

  return (
    <div className="relative min-h-[100svh] overflow-hidden selection:bg-brand-primary/30">
      <AnimatePresence>
        {isLauncherOpen ? (
          <motion.div
            key="launcher-overlay"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="fixed inset-0 z-50"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

            <div className="absolute inset-0 overflow-hidden rounded-none border-0 bg-zinc-950 text-zinc-100 shadow-2xl sm:inset-3 sm:rounded-[2rem] sm:border sm:border-white/10">
              <button
                type="button"
                onClick={closeLauncher}
                className="absolute left-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-xl transition hover:bg-black/55 hover:text-white"
                aria-label="Close FaceTime with AI"
              >
                <X size={20} />
              </button>

              <main
                ref={stageRef}
                className="flex h-full flex-1 flex-col overflow-hidden bg-black roast-gradient"
              >
                <ConnectingOverlay show={status === 'connecting'} />

                <AnimatePresence mode="wait">
                  {showProductStage ? (
                    <motion.div
                      key="agent-view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10"
                    >
                      <div className="absolute inset-0 overflow-y-auto px-4 pt-20 pb-32 min-[750px]:px-6">
                        <div className="mx-auto max-w-7xl space-y-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">Agent stage</div>
                              <h2 className="text-2xl font-semibold text-white">Live storefront results</h2>
                            </div>
                            <button
                              onClick={clearAgentView}
                              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                            >
                              Back to call
                            </button>
                          </div>

                          {renderTopLevelSummary(searchResults)}

                          {stageProducts.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              {stageProducts.map((product: any, index: number) => {
                                const variant = getPrimaryVariant(product);
                                const price = variant?.price_range?.min || product?.price_range?.min;
                                const imageUrl = variant?.image?.url || product?.image?.url;

                                return (
                                  <article
                                    key={product?.id || variant?.id || index}
                                    className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl"
                                  >
                                    <div className="aspect-[4/5] bg-zinc-950">
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt={product?.title || 'Product image'}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                                          No image available
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-4 p-5">
                                      <div>
                                        <h3 className="text-lg font-semibold text-white">
                                          {product?.title || 'Untitled product'}
                                        </h3>
                                        {price ? (
                                          <div className="mt-1 text-sm text-zinc-300">
                                            {formatMoney(price?.amount, price?.currency)}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          onClick={() => sendText(buildAgentIntent('details', product))}
                                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 transition hover:bg-white/10"
                                        >
                                          Show details
                                        </button>
                                        <button
                                          onClick={() => sendText(buildAgentIntent('add-to-cart', product))}
                                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 transition hover:bg-white/10"
                                        >
                                          Add to cart
                                        </button>
                                        <button
                                          onClick={() => sendText(buildAgentIntent('buy-now', product))}
                                          className="rounded-full bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
                                        >
                                          Buy now
                                        </button>
                                      </div>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          ) : !renderTopLevelSummary(searchResults) ? (
                            <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-300 backdrop-blur-xl">
                              Agent results are live. The next action stays under Gemini control.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="absolute bottom-28 right-4 z-30 aspect-[9/16] w-24 overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-900 shadow-2xl group min-[750px]:w-28 lg:w-36">
                        <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
                        <button
                          onClick={clearAgentView}
                          className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                          title="Restore agent to full screen"
                          aria-label="Restore agent to full screen"
                        >
                          <div className="h-3 w-3 rounded-tl-sm border-l-2 border-t-2 border-white" />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
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

              </main>

              <footer
                className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 min-[750px]:px-6"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                <div className="pointer-events-auto flex min-h-[68px] min-w-[220px] items-center justify-center gap-5 rounded-full border border-white/10 bg-zinc-950/88 px-5 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl min-[325px]:w-[min(92vw,340px)] min-[750px]:w-auto min-[750px]:gap-8 min-[750px]:px-7">
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/5 hover:text-white active:scale-90"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                        aria-label="Share a photo of a product"
                        title="Share a photo of a product"
                      >
                        <ImagePlus size={24} />
                      </button>

                      <button
                        type="button"
                        onClick={disconnect}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/12 text-red-500 transition hover:bg-red-500/18 active:scale-90"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                        aria-label="End call"
                      >
                        <PhoneOff size={24} className="text-red-500" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startConnection('Aoede')}
                      disabled={status === 'connecting'}
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full text-green-400 transition-all touch-manipulation active:scale-95',
                        status === 'connecting'
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-white/5 hover:text-green-300',
                      )}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                      aria-label="Start call"
                    >
                      <PhoneCallIcon ref={phoneIconRef} className="h-8 w-8 min-[750px]:h-10 min-[750px]:w-10" />
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelected}
                />
              </footer>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        <motion.button
          type="button"
          onClick={openLauncher}
          whileHover={{ y: -2, scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
          className="pointer-events-auto flex min-w-[220px] max-w-full items-center gap-3 rounded-full border border-black/10 bg-white/96 px-4 py-3 text-left text-black shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:bg-white"
          aria-label="Open FaceTime with AI"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <PhoneCallIcon ref={launcherIconRef} className="h-6 w-6" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.02em] text-black">
              Facetime with AI
            </span>
            <span className="block truncate text-xs text-zinc-500">
              Tap to open the live shopping assistant
            </span>
          </span>
        </motion.button>
      </div>

      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}
