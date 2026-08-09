import { useCallback, useRef, useState, useEffect } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { toast } from "sonner";

// Constants conforming to Gemini 3.1 Flash Live specifications
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const OUTPUT_PREBUFFER_SAMPLES = 2400; // 100ms at 24k
const VIDEO_INTERVAL_MS = 500;

type LiveSystemMessageSettings = {
  systemInstruction: string;
  model?: string;
  enableGoogleSearch?: boolean;
  enabledMcpTools?: string[];
  responseModality?: "AUDIO" | "TEXT";
  merchantDomain: string; // The active merchant store domain (e.g. store.myshopify.com)
  agentProfileUrl: string; // Your verified, hosted UCP profile URL
};

type TranscriptItem = { role: "user" | "tatty"; text: string };

function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToPCM16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Updated useGeminiLive Hook matching your exact implementation structure.
 * Houses the dynamic canvas rendering logic and layout transitions
 * for product showcases, without dropping the session or stream connections.
 */
export function useGeminiLive(systemMessageSettings: LiveSystemMessageSettings) {
  const [isConnected, setIsConnected] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [sessionDurationMs, setSessionDurationMs] = useState(0);
  const [consentGoogleSearch, setConsentGoogleSearchState] = useState(false);
  const [consentTranscription, setConsentTranscriptionState] = useState(false);

  // ==========================================
  // Layout Transitions for Product Showcase
  // ==========================================
  const [activeLayout, setActiveLayout] = useState<"video-call" | "showcase">("video-call");
  const [showcasePayload, setShowcasePayload] = useState<any | null>(null);

  const isMutedRef = useRef(false);
  const isVideoEnabledRef = useRef(true);
  const cameraFacingRef = useRef<"user" | "environment">("user");
  const isSessionOpenRef = useRef(false);
  const manualDisconnectRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);

  const inputNodeRef = useRef<AudioWorkletNode | null>(null);
  const outputNodeRef = useRef<AudioWorkletNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const videoIntervalRef = useRef<number | null>(null);

  const pendingOutputRef = useRef<Int16Array[]>([]);
  const pendingOutputSamplesRef = useRef(0);
  const playbackPrimedRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const consentGoogleSearchRef = useRef(false);
  const consentTranscriptionRef = useRef(false);

  // ==========================================
  // Custom Canvas Rendering Loop
  // Handles self-view OR rendering the Gemini Orb in PiP
  // ==========================================
  const activeLayoutRef = useRef<"video-call" | "showcase">("video-call");
  const micVolumeRef = useRef<number>(0);

  // Keep refs synchronized with state to avoid re-binding drawing intervals
  useEffect(() => {
    activeLayoutRef.current = activeLayout;
  }, [activeLayout]);

  useEffect(() => {
    micVolumeRef.current = micVolume;
  }, [micVolume]);

  const startCanvasDrawingLoop = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    let pulsePhase = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafIdRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafIdRef.current = requestAnimationFrame(draw);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;

      if (activeLayoutRef.current === "video-call") {
        // Mode 1: Standard call. Draw camera stream (user self-view)
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, width, height);
        } else {
          // Fallback background
          ctx.fillStyle = "#171717";
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        // Mode 2: Showcase. User view cut. Draw beautiful animated Gemini Orb
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, width, height);

        // Calculate dynamic dimensions for pulsing
        pulsePhase += 0.05;
        // Blend volume signals with sine waves for natural-looking organic movement
        const baseRadius = Math.min(width, height) * 0.22;
        const volumeFactor = micVolumeRef.current * 1.5;
        const pulse = Math.sin(pulsePhase) * 4 + volumeFactor * 25;
        const finalRadius = Math.max(15, baseRadius + pulse);

        // Center coordinates
        const cx = width / 2;
        const cy = height / 2;

        // Render Outer glow ring
        const outerGradient = ctx.createRadialGradient(cx, cy, finalRadius * 0.4, cx, cy, finalRadius * 1.8);
        outerGradient.addColorStop(0, "rgba(56, 189, 248, 0.15)"); // sky-400
        outerGradient.addColorStop(0.5, "rgba(59, 130, 246, 0.05)"); // blue-500
        outerGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, finalRadius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Render pulsing core Orb
        const innerGradient = ctx.createRadialGradient(
          cx - finalRadius * 0.15,
          cy - finalRadius * 0.15,
          finalRadius * 0.05,
          cx,
          cy,
          finalRadius
        );
        innerGradient.addColorStop(0, "#22d3ee"); // cyan-400 core
        innerGradient.addColorStop(0.4, "#3b82f6"); // blue-500 mid
        innerGradient.addColorStop(1, "#1e3a8a"); // blue-900 border
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, finalRadius, 0, Math.PI * 2);
        ctx.fill();

        // Overlay text label inside PiP
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.font = "bold 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("GEMINI LIVE", cx, height - 16);
      }

      rafIdRef.current = requestAnimationFrame(draw);
    };

    rafIdRef.current = requestAnimationFrame(draw);
  }, []);

  // Ensure canvas renderer initializes when hook loads
  useEffect(() => {
    startCanvasDrawingLoop();
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [startCanvasDrawingLoop]);

  // ==========================================
  // Live Message Processing & Synced Tool Handlers
  // ==========================================
  const handleServerMessage = useCallback(async (message: any) => {
    // 1. Process standard audio/text outputs (multi-part server packets)
    if (message.serverContent && message.serverContent.modelTurn) {
      const parts = message.serverContent.modelTurn.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const audioBase64 = part.inlineData.data;
          const pcm16 = base64ToPCM16(audioBase64);
          enqueueOutputPCM(pcm16);
        }
        if (part.text) {
          // Render transcripts in local UI State
          setTranscript((prev) => [...prev, { role: "tatty", text: part.text }]);
        }
      }
    }

    // 2. Intercept UCP/MCP tool executions for product showcase transitions
    if (message.toolCall) {
      const functionCalls = message.toolCall.functionCalls || [];
      const functionResponses: any[] = [];

      for (const fc of functionCalls) {
        let resultPayload: any = { status: "success" };

        try {
          // If the model wants to search catalog, get product, or checkout
          if (fc.name === "search_catalog" || fc.name === "get_product" || fc.name === "create_checkout") {
            
            // Dispatch a real backend network call against the merchant's UCP/MCP router
            const endpoint = `https://${systemMessageSettings.merchantDomain}/api/ucp/mcp`;
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "UCP-Agent": `profile="${systemMessageSettings.agentProfileUrl}"`
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                  name: fc.name,
                  arguments: fc.arguments
                },
                id: fc.id
              })
            });

            if (response.ok) {
              const ucpJson = await response.json();
              resultPayload = ucpJson.result?.structuredContent || ucpJson.result || { status: "success" };
              
              // Trigger showcase viewport layout swap
              setShowcasePayload(resultPayload);
              setActiveLayout("showcase");
              
              toast.success(`Showcasing products for ${fc.name}`);
            } else {
              resultPayload = { status: "error", message: `HTTP Error: ${response.status}` };
            }
          }
        } catch (err: any) {
          console.error("Failed executing synced UCP tool:", err);
          resultPayload = { status: "error", message: err.message };
        }

        // Package the synchronous response back so the live audio session doesn't block or drop
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: resultPayload
        });
      }

      // Return responses synchronously to the active live session ref
      if (functionResponses.length > 0 && isSessionOpenRef.current && sessionRef.current) {
        await sessionRef.current.sendToolResponse({ functionResponses });
      }
    }
  }, [systemMessageSettings, enqueueOutputPCM]);

  // ==========================================
  // Context Actions & Utilities
  // ==========================================
  const setConsentGoogleSearch = useCallback((value: boolean) => {
    consentGoogleSearchRef.current = value;
    setConsentGoogleSearchState(value);
  }, []);

  const setConsentTranscription = useCallback((value: boolean) => {
    consentTranscriptionRef.current = value;
    setConsentTranscriptionState(value);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const syncSessionDuration = useCallback(() => {
    if (!connectedAtRef.current) {
      setSessionDurationMs(0);
      return 0;
    }
    const elapsedMs = Date.now() - connectedAtRef.current;
    setSessionDurationMs(elapsedMs);
    return elapsedMs;
  }, []);

  const beginSessionTracking = useCallback(() => {
    connectedAtRef.current = Date.now();
    setSessionDurationMs(0);
    durationIntervalRef.current = window.setInterval(() => {
      syncSessionDuration();
    }, 1000);
  }, [syncSessionDuration]);

  const endSessionTracking = useCallback(() => {
    stopDurationTimer();
    syncSessionDuration();
    connectedAtRef.current = null;
  }, [stopDurationTimer, syncSessionDuration]);

  const stopVideoCapture = useCallback(() => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    stopVideoCapture();
  }, [stopVideoCapture]);

  const resetPlayback = useCallback(() => {
    pendingOutputRef.current = [];
    pendingOutputSamplesRef.current = 0;
    playbackPrimedRef.current = false;
    setIsAudioPlaying(false);
  }, []);

  const enqueueOutputPCM = useCallback((pcm: Int16Array) => {
    pendingOutputRef.current.push(pcm);
    pendingOutputSamplesRef.current += pcm.length;
  }, []);

  const captureFrame = useCallback(() => {
    if (
      !isVideoEnabledRef.current ||
      !sessionRef.current ||
      !isSessionOpenRef.current ||
      !videoRef.current ||
      !canvasRef.current
    ) {
      return;
    }
    // (Your existing WebRTC video capture frame logic remains here)
  }, []);

  const startVideoCapture = useCallback(() => {
    stopVideoCapture();
    if (!isVideoEnabledRef.current || !streamRef.current) return;
    captureFrame();
    videoIntervalRef.current = window.setInterval(captureFrame, VIDEO_INTERVAL_MS);
  }, [captureFrame, stopVideoCapture]);

  const initAudio = useCallback(async () => {
    const base = window.location.origin;
    if (!inputCtxRef.current) {
      inputCtxRef.current = new AudioContext({ latencyHint: "interactive" });
      await inputCtxRef.current.audioWorklet.addModule(`${base}/audio-input-worklet.js`);
    }
  }, []);

  const startStreaming = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: cameraFacingRef.current,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
    });
    streamRef.current = stream;
    startVideoCapture();
  }, [startVideoCapture]);

  const flipCamera = useCallback(async () => {
    if (!streamRef.current) return;
    cameraFacingRef.current = cameraFacingRef.current === "user" ? "environment" : "user";
    setCameraFacing(cameraFacingRef.current);
    startVideoCapture();
  }, [startVideoCapture]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    isSessionOpenRef.current = false;
    resumptionHandleRef.current = null;
    endSessionTracking();
    cleanupMedia();
    resetPlayback();
    setIsConnected(false);
    setStatus("idle");
  }, [cleanupMedia, endSessionTracking, resetPlayback]);

  const startConnection = useCallback(async (selectedVoice: string) => {
    try {
      setStatus("connecting");
      manualDisconnectRef.current = false;
      await initAudio();
      await startStreaming();
      setIsConnected(true);
      isSessionOpenRef.current = true;
      setStatus("live");
      beginSessionTracking();
    } catch (e: any) {
      console.error(e);
      setStatus("error");
    }
  }, [initAudio, startStreaming, beginSessionTracking]);

  const sendText = useCallback((text: string) => {
    if (!sessionRef.current || !isSessionOpenRef.current) return;
    sessionRef.current.sendRealtimeInput({ text });
    setTranscript((prev) => [...prev, { role: "user", text }]);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      return next;
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setIsVideoEnabled((prev) => {
      const next = !prev;
      isVideoEnabledRef.current = next;
      return next;
    });
  }, []);
  const isAgentActive = activeLayout === "showcase";

const sendText = useCallback((text: string) => {
  if (sessionRef.current) {
    sessionRef.current.send({ text });
  }
}, []);

  // Restores standard video view stage and redirects drawing loop back to camera self-view
  const closeShowcase = useCallback(() => {
    setActiveLayout("video-call");
    setShowcasePayload(null);
  }, []);
  

  return {
    isConnected,
    isMuted,
    isAgentActive,
    searchResults,
    cameraFacing,
    isAudioPlaying,
    micVolume,
    isUserTalking,
    transcript,
    status,
    sessionDurationMs,
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    sendText,
    toggleMute,
    toggleVideo,
    flipCamera,
    isVideoEnabled,
    consentGoogleSearch,
    consentTranscription,
    setConsentGoogleSearch,
    setConsentTranscription,
    // Returned state and handlers for rendering products in parent stage
    activeLayout,
    showcasePayload,
    closeShowcase,
    handleServerMessage
  };
}