import React, { useRef, useEffect } from 'react';
import { SwitchCamera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';
import { buildAgentIntent, getPrimaryVariant, getProductsFromPayload } from './lib/agentStageEvents';
import { SYSTEM_MESSAGE_SETTINGS } from './lib/SystemMessage';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const merchantDomainRef = useRef<string>(resolveMerchantDomain());
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

  /* ── Receive commands from the Liquid pill ── */
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string } | null;
      if (!d || d.source !== 'ftai-widget') return;
      if (d.type === 'START_CALL' && !isConnected && status !== 'connecting') startConnection('Aoede');
      if (d.type === 'END_CALL' && isConnected) disconnect();
      if (d.type === 'SEND_IMAGE') fileInputRef.current?.click();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [isConnected, status, startConnection, disconnect]);

  /* ── Broadcast call state (only on change) ── */
  const prevConnected = useRef(isConnected);
  useEffect(() => {
    if (prevConnected.current === isConnected) return;
    prevConnected.current = isConnected;
    window.parent.postMessage(
      { source: 'ftai-embed', type: isConnected ? 'CALL_STARTED' : 'CALL_ENDED' },
      '*'
    );
  }, [isConnected]);

  /* ── Broadcast PIP mode for the Liquid shell ── */
  const showProductStage = isConnected && isAgentActive && !!searchResults;
  useEffect(() => {
    if (!isConnected) return;
    window.parent.postMessage(
      { source: 'ftai-embed', type: 'MODE_CHANGED', mode: showProductStage ? 'SEARCH_RESULTS' : 'IDLE_LISTENING' },
      '*'
    );
  }, [showProductStage, isConnected]);

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64) sendImage(base64, file.type);
    };
    reader.readAsDataURL(file);
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

  const stageProducts = getProductsFromPayload(searchResults);

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-black selection:bg-brand-primary/30">
      <ConnectingOverlay show={status === 'connecting'} />

      <main ref={stageRef} className="flex h-full flex-1 flex-col overflow-hidden bg-black roast-gradient">
        <AnimatePresence mode="wait">
          {showProductStage ? (
            <motion.div
              key="agent-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10"
            >
              <div className="absolute inset-0 overflow-y-auto px-4 pt-10 pb-16 min-[750px]:px-6">
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

              {/* Orb drops into PIP while products are on stage */}
              <div className="absolute bottom-4 right-3 z-30 aspect-[9/16] w-20 overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-900 shadow-2xl group min-[750px]:w-28 lg:w-32">
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
              {/* Orb full screen */}
              <div className="absolute inset-0 pointer-events-none z-0">
                <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
              </div>

              {/* Responsive user-camera PIP — always fully inside the panel */}
              <div
                className="absolute right-3 top-3 z-20 w-24 min-[480px]:w-28 min-[750px]:w-36 aspect-[3/4] overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl"
                style={{
                  opacity: isConnected ? 1 : 0,
                  transition: 'opacity 0.3s',
                  pointerEvents: isConnected ? 'auto' : 'none',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn('h-full w-full object-cover', cameraFacing === 'front' && '-scale-x-100')}
                />
                <button
                  type="button"
                  onClick={flipCamera}
                  className="absolute bottom-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white/90 transition hover:bg-black/70"
                  aria-label="Flip camera"
                  title="Flip camera"
                >
                  <SwitchCamera size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden file input — triggered by the pill's image button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />

      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}