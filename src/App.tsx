import React, { useRef, useEffect } from 'react';
import { SwitchCamera } from 'lucide-react';
import { cn } from './lib/utils';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';
import { buildAgentIntent } from './lib/agentStageEvents';
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

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; payload?: any } | null;
      if (!d || d.source !== 'ftai-widget') return;
      if (d.type === 'START_CALL' && !isConnected && status !== 'connecting') startConnection('Aoede');
      if (d.type === 'END_CALL' && isConnected) disconnect();
      if (d.type === 'SEND_IMAGE') fileInputRef.current?.click();
      if (d.type === 'CLEAR') clearAgentView();
      if (d.type === 'INTENT' && d.payload) {
        sendText(buildAgentIntent(d.payload.action as any, d.payload.product));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [isConnected, status, startConnection, disconnect, clearAgentView, sendText]);

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
    const mode = showProductStage ? 'SEARCH_RESULTS' : 'IDLE_LISTENING';
    window.parent.postMessage({ source: 'ftai-embed', type: 'MODE_CHANGED', mode }, '*');
    if (showProductStage) {
      window.parent.postMessage({ source: 'ftai-embed', type: 'RESULTS', payload: searchResults }, '*');
    }
  }, [showProductStage, isConnected, searchResults]);

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
          <div className="absolute right-3 top-3 z-20 w-24 min-[480px]:w-28 min-[750px]:w-36 aspect-[3/4] overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl">
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
        </div>
      </main>

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