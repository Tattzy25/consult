import React, { useRef, useEffect } from 'react';
import { ImagePlus, PhoneOff, SwitchCamera } from 'lucide-react';
import { cn } from './lib/utils';
import { PhoneCallIcon, type PhoneCallIconHandle } from './components/ui/phone-call';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';
import { buildAgentIntent, formatUIEvent } from './lib/agentStageEvents';
import { SYSTEM_MESSAGE_SETTINGS } from './lib/SystemMessage';

function resolveMerchantDomain(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  let raw =
    params.get('shop') ||
    params.get('merchant') ||
    params.get('store') ||
    '';
  if (!raw) {
    try {
      const host = new URL(document.referrer).hostname;
      if (host.endsWith('.myshopify.com')) raw = host;
    } catch {
      /* ignore */
    }
  }
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);
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

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; payload?: any } | null;
      if (!d || d.source !== 'ftai-widget') return;
      if (d.type === 'CLEAR') clearAgentView();
      if (d.type === 'EVENT' && d.payload) {
        sendText(formatUIEvent(d.payload));
      }
      if (d.type === 'INTENT' && d.payload) {
        sendText(buildAgentIntent(d.payload.action as any, d.payload.product));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [clearAgentView, sendText]);

  const prevConnected = useRef(isConnected);
  useEffect(() => {
    if (prevConnected.current === isConnected) return;
    prevConnected.current = isConnected;
    window.parent.postMessage(
      { source: 'ftai-embed', type: isConnected ? 'CALL_STARTED' : 'CALL_ENDED' },
      '*'
    );
  }, [isConnected]);

  const showProductStage = isConnected && isAgentActive && !!searchResults;

  useEffect(() => {
    if (!isConnected) return;
    if (showProductStage) {
      // Determine mode from payload shape
      const p = searchResults;
      let mode = 'CATALOG';
      if (p.line_items && p.totals && !p.fulfillment?.methods) mode = 'CART';
      if (p.line_items && p.fulfillment?.methods) mode = 'CHECKOUT';
      if (p.status === 'completed' || p.order_id) mode = 'ORDER';
      
      window.parent.postMessage({ 
        source: 'ftai-embed', 
        type: 'SHEET_OPEN', 
        mode,
        payload: p 
      }, '*');
    } else {
      window.parent.postMessage({ source: 'ftai-embed', type: 'SHEET_CLOSE' }, '*');
    }
  }, [showProductStage, isConnected, searchResults]);

  useEffect(() => {
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

  const isStoreSurface =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('surface') === 'store';

  if (!isStoreSurface) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="max-w-md rounded-3xl border border-white/10 bg-zinc-900/60 p-8 text-center">
          <h1 className="text-xl font-semibold">Agent Sold</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            The FaceTime with AI assistant lives on your online store.
            Open your storefront and tap the Facetime pill at the bottom of the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-black selection:bg-brand-primary/30">
      <ConnectingOverlay show={status === 'connecting'} />

      <main ref={stageRef} className="flex h-full flex-1 flex-col overflow-hidden bg-black roast-gradient">
        <div className="absolute inset-0 pointer-events-none z-0">
          <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
        </div>

        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ opacity: isConnected ? 1 : 0, transition: 'opacity 0.3s' }}
        >
          <div className="absolute right-8 top-8 z-20 w-24 min-[480px]:w-28 min-[750px]:w-36 aspect-[3/4] overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn('h-full w-full object-cover', cameraFacing === 'user' && '-scale-x-100')}
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
        </div>
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

      <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
    </div>
  );
}