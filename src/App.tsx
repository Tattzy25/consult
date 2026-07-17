import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import {
  PhoneCallIcon,
  type PhoneCallIconHandle,
} from './components/ui/phone-call';
import { CameraPreview } from './components/video/CameraPreview';
import { ConnectingOverlay } from './components/ui/ConnectingOverlay';
import { WreckShader } from './components/WreckShader';
import { useGeminiLive } from './hooks/useGeminiLive';
import { SYSTEM_MESSAGE_SETTINGS } from './lib/SystemMessage';

type CommercePanelEvent = {
  channel: 'commerce-panel';
  type:
    | 'clear'
    | 'tool'
    | 'products'
    | 'button'
    | 'buttons'
    | 'checkout'
    | 'mcp_result'
    | 'loading';
  [key: string]: unknown;
};

type CommercePanelAction = {
  channel: 'commerce-panel';
  type: 'action';
  action: 'view_product' | 'add_to_cart' | 'open_checkout' | 'choice';
  product?: {
    id?: string;
    title?: string;
    url?: string;
    variant_id?: string;
    variantId?: string;
    [key: string]: unknown;
  };
  url?: string;
  label?: string;
  value?: string;
};

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneIconRef = useRef<PhoneCallIconHandle>(null);
  const commercePanelRef = useRef<HTMLIFrameElement>(null);
  const queuedPanelEventsRef = useRef<CommercePanelEvent[]>([]);
  const commercePanelReadyRef = useRef(false);
  const splitContainerRef = useRef<HTMLElement>(null);

  const [mobileSplit, setMobileSplit] = useState(70);

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
  } = useGeminiLive(SYSTEM_MESSAGE_SETTINGS);

  const sendToCommercePanel = (event: CommercePanelEvent) => {
    const frameWindow = commercePanelRef.current?.contentWindow;

    if (!commercePanelReadyRef.current || !frameWindow) {
      queuedPanelEventsRef.current.push(event);
      return;
    }

    frameWindow.postMessage(event, window.location.origin);
  };

  const handleSplitPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;

    const updateFromClientY = (clientY: number) => {
      const rect = container.getBoundingClientRect();
      const pct = ((clientY - rect.top) / rect.height) * 100;
      setMobileSplit(Math.min(85, Math.max(25, pct)));
    };

    updateFromClientY(event.clientY);

    const onPointerMove = (moveEvent: PointerEvent) => {
      updateFromClientY(moveEvent.clientY);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as
        | { channel?: string; type?: string }
        | undefined;

      if (!data || data.channel !== 'commerce-panel') return;

      if (data.type === 'ready') {
        commercePanelReadyRef.current = true;

        const frameWindow = commercePanelRef.current?.contentWindow;
        if (!frameWindow) return;

        for (const queuedEvent of queuedPanelEventsRef.current) {
          frameWindow.postMessage(queuedEvent, window.location.origin);
        }

        queuedPanelEventsRef.current = [];
        return;
      }

      if (data.type === 'action') {
        const action = data as CommercePanelAction;

        if (action.action === 'view_product' && action.product?.url) {
          window.open(action.product.url, '_blank', 'noopener,noreferrer');
          return;
        }

        if (action.action === 'open_checkout' && action.url) {
          window.open(action.url, '_blank', 'noopener,noreferrer');
          return;
        }

        /*
          This sends the customer’s click to useGeminiLive.ts.
          Gemini then decides which UCP/MCP tool to call.

          Example:
          - Add to Cart click -> Gemini calls create_cart/add cart line tool
          - Accept button -> Gemini continues the requested flow
          - Decline button -> Gemini cancels that flow
        */
        window.dispatchEvent(
          new CustomEvent('commerce-panel-action', {
            detail: action,
          }),
        );
      }
    };

    const handleCommerceRender = (event: Event) => {
      const customEvent = event as CustomEvent<CommercePanelEvent>;
      if (!customEvent.detail) return;
      sendToCommercePanel(customEvent.detail);
    };

    window.addEventListener('message', handleWindowMessage);
    window.addEventListener(
      'commerce-panel-render',
      handleCommerceRender as EventListener,
    );

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener(
        'commerce-panel-render',
        handleCommerceRender as EventListener,
      );
    };
  }, []);

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

  return (
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-brand-primary/30">
      <main
        ref={splitContainerRef}
        className="flex h-full w-full flex-1 flex-col overflow-hidden md:flex-row md:items-center"
      >
        <div
          ref={stageRef}
          className="relative flex h-[var(--stage-h)] shrink-0 bg-black roast-gradient md:h-full md:w-1/2"
          style={{ '--stage-h': `${mobileSplit}%` } as React.CSSProperties}
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            <WreckShader audioLevel={audioLevel} visualMode={visualMode} />
          </div>

          <ConnectingOverlay show={status === 'connecting'} />

          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              opacity: isConnected ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          >
            <CameraPreview
              videoRef={videoRef}
              cameraFacing={cameraFacing}
              stageRef={stageRef}
              onFlip={flipCamera}
            />
          </div>

          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div
                key="disconnected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-auto absolute bottom-12 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => startConnection('Aoede')}
                  disabled={status === 'connecting'}
                  className={cn(
                    'relative flex items-center justify-center p-4 text-green-400',
                    'touch-manipulation transition-all duration-300 active:scale-95',
                    status === 'connecting'
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:scale-110 hover:text-green-300',
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <PhoneCallIcon
                    ref={phoneIconRef}
                    className="h-12 w-12 md:h-16 md:w-16"
                  />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="connected-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-0 bottom-6 z-20 md:bottom-0"
                style={{
                  paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                }}
              >
                <div className="pointer-events-auto flex items-center justify-center gap-8">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="touch-manipulation text-white/80 transition-all hover:text-white active:scale-90"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {isMuted ? (
                      <MicOff size={26} className="text-red-400" />
                    ) : (
                      <Mic size={26} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={disconnect}
                    className="touch-manipulation transition-all active:scale-90"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <PhoneOff size={32} className="text-red-500" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={handleSplitPointerDown}
          className="relative z-20 flex h-6 shrink-0 touch-none items-center justify-center md:hidden"
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>

        <div className="m-4 min-h-0 flex-1 overflow-hidden rounded-2xl border-2 border-[#00c1ec] bg-black md:m-4 md:h-[85%] md:flex-initial md:w-1/2 md:self-center">
          <iframe
            ref={commercePanelRef}
            src="/commerce-display/index.html"
            title="Commerce display"
            className="h-full w-full border-0"
          />
        </div>
      </main>

      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ display: 'none' }}
      />
    </div>
  );
}