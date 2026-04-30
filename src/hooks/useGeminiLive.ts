import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { toast } from "sonner";
import { mcpInjector } from "../lib/mcp-injector";
import {
  endLiveSession,
  heartbeatLiveSession,
  type LivePersonaConfig,
  startLiveSession,
} from "../lib/live-session-api.ts";

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const OUTPUT_PREBUFFER_SAMPLES = 2400; // 100ms at 24k
const VIDEO_INTERVAL_MS = 500;

type TranscriptItem = { role: "user" | "wreck"; text: string };

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
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function useGeminiLive(personaConfig: LivePersonaConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user",
  );
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [sessionDurationMs, setSessionDurationMs] = useState(0);
  const [consentGoogleSearch, setConsentGoogleSearchState] = useState(false);
  const [consentTranscription, setConsentTranscriptionState] = useState(false);

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
  const liveSessionIdRef = useRef<string | null>(null);
  const liveSessionStartedAtRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const consentGoogleSearchRef = useRef(false);
  const consentTranscriptionRef = useRef(false);

  const setConsentGoogleSearch = useCallback((value: boolean) => {
    consentGoogleSearchRef.current = value;
    setConsentGoogleSearchState(value);
  }, []);

  const setConsentTranscription = useCallback((value: boolean) => {
    consentTranscriptionRef.current = value;
    setConsentTranscriptionState(value);
  }, []);

  const stopSessionTrackingTimers = useCallback(() => {
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const syncSessionDuration = useCallback(() => {
    if (!liveSessionStartedAtRef.current) {
      setSessionDurationMs(0);
      return 0;
    }

    const elapsedMs = Date.now() - liveSessionStartedAtRef.current;
    setSessionDurationMs(elapsedMs);
    return elapsedMs;
  }, []);

  const endSessionTracking = useCallback(
    (reason: string) => {
      stopSessionTrackingTimers();

      const sessionId = liveSessionIdRef.current;
      const elapsedMs = syncSessionDuration();

      liveSessionIdRef.current = null;
      liveSessionStartedAtRef.current = null;

      if (!sessionId) {
        setSessionDurationMs(0);
        return;
      }

      void endLiveSession({
        sessionId,
        elapsedMs,
        reason,
        metadata: {
          muted: isMutedRef.current,
          videoEnabled: isVideoEnabledRef.current,
        },
      });
    },
    [stopSessionTrackingTimers, syncSessionDuration],
  );

  const beginSessionTracking = useCallback(
    (voice: string, model: string) => {
      const sessionId = crypto.randomUUID();
      const startedAtMs = Date.now();
      const startedAt = new Date(startedAtMs).toISOString();

      liveSessionIdRef.current = sessionId;
      liveSessionStartedAtRef.current = startedAtMs;
      setSessionDurationMs(0);

      void startLiveSession({
        sessionId,
        personaId: personaConfig.personaId,
        model,
        voice,
        startedAt,
        metadata: {
          cameraFacing: cameraFacingRef.current,
          userAgent: navigator.userAgent,
        },
      });

      durationIntervalRef.current = window.setInterval(() => {
        syncSessionDuration();
      }, 1000);

      heartbeatIntervalRef.current = window.setInterval(() => {
        const activeSessionId = liveSessionIdRef.current;
        if (!activeSessionId) return;

        void heartbeatLiveSession({
          sessionId: activeSessionId,
          elapsedMs: syncSessionDuration(),
          muted: isMutedRef.current,
          videoEnabled: isVideoEnabledRef.current,
          metadata: {
            cameraFacing: cameraFacingRef.current,
            connected: isSessionOpenRef.current,
          },
        });
      }, 15000);
    },
    [personaConfig.personaId, syncSessionDuration],
  );

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

    if (inputNodeRef.current) {
      inputNodeRef.current.port.onmessage = null;
      inputNodeRef.current.disconnect();
      inputNodeRef.current = null;
    }

    if (outputNodeRef.current) {
      outputNodeRef.current.disconnect();
      outputNodeRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (silentGainRef.current) {
      silentGainRef.current.disconnect();
      silentGainRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setMicVolume(0);
    setIsUserTalking(false);
  }, [stopVideoCapture]);

  const resetPlayback = useCallback(() => {
    pendingOutputRef.current = [];
    pendingOutputSamplesRef.current = 0;
    playbackPrimedRef.current = false;
    setIsAudioPlaying(false);

    if (outputNodeRef.current) {
      outputNodeRef.current.port.postMessage({ type: "flush" });
    }
  }, []);

  const enqueueOutputPCM = useCallback((pcm: Int16Array) => {
    pendingOutputRef.current.push(pcm);
    pendingOutputSamplesRef.current += pcm.length;

    if (!playbackPrimedRef.current) {
      if (pendingOutputSamplesRef.current < OUTPUT_PREBUFFER_SAMPLES) return;
      playbackPrimedRef.current = true;
      setIsAudioPlaying(true);

      while (pendingOutputRef.current.length) {
        const chunk = pendingOutputRef.current.shift()!;
        pendingOutputSamplesRef.current -= chunk.length;
        outputNodeRef.current?.port.postMessage(
          { type: "chunk", buffer: chunk.buffer },
          [chunk.buffer],
        );
      }
      return;
    }

    setIsAudioPlaying(true);
    const chunk = pendingOutputRef.current.shift()!;
    pendingOutputSamplesRef.current -= chunk.length;
    outputNodeRef.current?.port.postMessage(
      { type: "chunk", buffer: chunk.buffer },
      [chunk.buffer],
    );
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

    if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.error("Initial video play failed:", err);
      });
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
    if (!base64Data) return;

    sessionRef.current.sendRealtimeInput({
      video: { data: base64Data, mimeType: "image/jpeg" },
    });
  }, []);

  const startVideoCapture = useCallback(() => {
    stopVideoCapture();

    if (!isVideoEnabledRef.current || !streamRef.current) {
      return;
    }

    captureFrame();
    videoIntervalRef.current = window.setInterval(
      captureFrame,
      VIDEO_INTERVAL_MS,
    );
  }, [captureFrame, stopVideoCapture]);

  const initAudio = useCallback(async () => {
    if (!inputCtxRef.current) {
      inputCtxRef.current = new AudioContext({ latencyHint: "interactive" });
      await inputCtxRef.current.audioWorklet.addModule(
        "/audio-input-worklet.js",
      );
    }

    if (!outputCtxRef.current) {
      outputCtxRef.current = new AudioContext({
        sampleRate: OUTPUT_RATE,
        latencyHint: "interactive",
      });
      await outputCtxRef.current.audioWorklet.addModule(
        "/audio-output-worklet.js",
      );
    }

    if (inputCtxRef.current.state === "suspended")
      await inputCtxRef.current.resume();
    if (outputCtxRef.current.state === "suspended")
      await outputCtxRef.current.resume();

    if (!outputNodeRef.current) {
      outputNodeRef.current = new AudioWorkletNode(
        outputCtxRef.current,
        "gemini-output-worklet",
        {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        },
      );

      outputNodeRef.current.port.onmessage = (event) => {
        if (event.data?.type === "underrun") {
          setIsAudioPlaying(false);
        }
      };

      outputNodeRef.current.connect(outputCtxRef.current.destination);
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

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        // Browser autoplay policies can reject until the user gesture propagates.
      });
    }

    const inputCtx = inputCtxRef.current!;
    const source = inputCtx.createMediaStreamSource(stream);

    // Setup AnalyserNode for mic volume
    const analyser = inputCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const volume = Math.min(1, avg / 128);

      setMicVolume((prev) => {
        if (volume === 0 && prev === 0) return prev;
        if (Math.abs(prev - volume) < 0.02) return prev;
        return volume;
      });

      setIsUserTalking((prev) => {
        // Hysteresis to prevent split-second bouncing on background noise
        if (prev && volume < 0.1) return false;
        if (!prev && volume >= 0.15) return true;
        return prev;
      });

      rafIdRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    const inputNode = new AudioWorkletNode(inputCtx, "gemini-input-worklet", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      processorOptions: {
        targetSampleRate: INPUT_RATE,
        chunkSamples: 320,
      },
    });

    const silentGain = inputCtx.createGain();
    silentGain.gain.value = 0;

    audioSourceRef.current = source;
    inputNodeRef.current = inputNode;
    silentGainRef.current = silentGain;

    source.connect(inputNode);
    inputNode.connect(silentGain);
    silentGain.connect(inputCtx.destination);

    inputNode.port.onmessage = (event) => {
      if (
        isMutedRef.current ||
        !sessionRef.current ||
        !isSessionOpenRef.current
      )
        return;
      const pcm = new Int16Array(event.data);
      const base64Data = pcm16ToBase64(pcm);

      sessionRef.current.sendRealtimeInput({
        audio: {
          data: base64Data,
          mimeType: `audio/pcm;rate=${INPUT_RATE}`,
        },
      });
    };

    startVideoCapture();
  }, [startVideoCapture]);

  const flipCamera = useCallback(async () => {
    try {
      if (!streamRef.current) return;

      const nextFacing =
        cameraFacingRef.current === "user" ? "environment" : "user";
      cameraFacingRef.current = nextFacing;
      setCameraFacing(nextFacing);

      streamRef.current.getVideoTracks().forEach((track) => {
        track.stop();
        streamRef.current?.removeTrack(track);
      });

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;
      streamRef.current.addTrack(newVideoTrack);

      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch((err) => {
          console.error("Video play failed after flip:", err);
        });
      }

      if (isSessionOpenRef.current && isVideoEnabledRef.current) {
        startVideoCapture();
      }
    } catch (err) {
      console.error("Camera flip failed:", err);
    }
  }, [startVideoCapture]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    isSessionOpenRef.current = false;
    endSessionTracking("manual_disconnect");
    cleanupMedia();
    resetPlayback();
    mcpInjector.disconnect();

    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      try {
        session.close();
      } catch (err) {
        console.error("Error closing session:", err);
      }
    }

    setIsConnected(false);
    setStatus("idle");
    setTranscript([]);
    setGeneratedImage(null);
    setSessionDurationMs(0);
  }, [cleanupMedia, endSessionTracking, resetPlayback]);

  const startConnection = useCallback(
    async (selectedVoice: string) => {
      try {
        setStatus("connecting");
        manualDisconnectRef.current = false;
        await initAudio();
        await startStreaming();

        const tools: any[] = [];
        if (personaConfig.enableGoogleSearch && consentGoogleSearchRef.current) {
          tools.push({ googleSearch: {} });
        }

        const mcpTools = mcpInjector.getGeminiTools(
          personaConfig.enabledMcpTools,
        );
        tools.push(...mcpTools);

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const model = personaConfig.model || "gemini-3.1-flash-live-preview";

        const session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: personaConfig.systemInstruction,
            tools: tools.length > 0 ? tools : undefined,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
            ...(consentTranscriptionRef.current
              ? { inputAudioTranscription: {}, outputAudioTranscription: {} }
              : {}),
          },
          callbacks: {
            onopen: async () => {
              isSessionOpenRef.current = true;
              setIsConnected(true);
              setStatus("live");
              resetPlayback();
              beginSessionTracking(selectedVoice, model);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.interrupted) {
                resetPlayback();
              }

              if (consentTranscriptionRef.current) {
                const inputTranscript =
                  message.serverContent?.inputTranscription?.text;
                if (inputTranscript) {
                  setTranscript((prev) => [
                    ...prev,
                    { role: "user", text: inputTranscript },
                  ]);
                }

                const outputTranscript =
                  message.serverContent?.outputTranscription?.text;
                if (outputTranscript) {
                  setTranscript((prev) => [
                    ...prev,
                    { role: "wreck", text: outputTranscript },
                  ]);
                }
              }

              const parts = message.serverContent?.modelTurn?.parts ?? [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  const pcm = base64ToPCM16(part.inlineData.data);
                  enqueueOutputPCM(pcm);
                }
                if (part.text && consentTranscriptionRef.current) {
                  setTranscript((prev) => [
                    ...prev,
                    { role: "wreck", text: part.text! },
                  ]);
                }
                if (part.functionCall) {
                  const { name, args } = part.functionCall;
                  if (!name) continue;
                  try {
                    const result = await mcpInjector.executeTool(name, args);

                    // Check if the result contains an image URL from our tool
                    try {
                      if (result && typeof result.text === "string") {
                        const parsed = JSON.parse(result.text);
                        if (
                          Array.isArray(parsed) &&
                          parsed.length > 0 &&
                          typeof parsed[0] === "string" &&
                          parsed[0].startsWith("http")
                        ) {
                          setGeneratedImage(parsed[0]);
                        }
                      }
                    } catch (e) {
                      // Ignore parsing errors, it might not be an image tool response
                    }

                    sessionRef.current?.sendToolResponse({
                      functionResponses: [
                        {
                          name,
                          response: { result },
                        },
                      ],
                    });
                  } catch (error: any) {
                    sessionRef.current?.sendToolResponse({
                      functionResponses: [
                        {
                          name,
                          response: {
                            error: error.message || "Tool execution failed",
                          },
                        },
                      ],
                    });
                  }
                }
              }
            },
            onclose: () => {
              isSessionOpenRef.current = false;
              endSessionTracking("socket_closed");
              cleanupMedia();
              resetPlayback();
              sessionRef.current = null;
              setIsConnected(false);
              setStatus("idle");
              setSessionDurationMs(0);
              if (!manualDisconnectRef.current) {
                toast.error("Live session closed unexpectedly");
              }
              manualDisconnectRef.current = false;
            },
            onerror: (error) => {
              console.error("Live API Error:", error);
              isSessionOpenRef.current = false;
              endSessionTracking("socket_error");
              cleanupMedia();
              resetPlayback();
              sessionRef.current = null;
              setIsConnected(false);
              setStatus("error");
              setSessionDurationMs(0);
              manualDisconnectRef.current = true;
              toast.error(
                error instanceof Error ? error.message : "Live API error",
              );
            },
          },
        });

        sessionRef.current = session;
      } catch (err) {
        console.error("Failed to connect:", err);
        isSessionOpenRef.current = false;
        cleanupMedia();
        resetPlayback();
        sessionRef.current = null;
        setStatus("error");
        setIsConnected(false);
        setSessionDurationMs(0);
        manualDisconnectRef.current = false;
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to start the live session",
        );
      }
    },
    [
      beginSessionTracking,
      cleanupMedia,
      endSessionTracking,
      enqueueOutputPCM,
      initAudio,
      resetPlayback,
      startStreaming,
      personaConfig,
    ],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;

      if (next && isSessionOpenRef.current && sessionRef.current) {
        sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
      }

      return next;
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setIsVideoEnabled((prev) => {
      const next = !prev;
      isVideoEnabledRef.current = next;

      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = next;
        });
      }

      if (!next) {
        stopVideoCapture();
      } else if (isSessionOpenRef.current) {
        startVideoCapture();
      }

      return next;
    });
  }, [startVideoCapture, stopVideoCapture]);

  const sendImage = useCallback((base64Data: string) => {
    if (sessionRef.current) {
      sessionRef.current.sendRealtimeInput({
        video: { data: base64Data, mimeType: "image/jpeg" },
      });
    }
  }, []);

  return {
    isConnected,
    isMuted,
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
    toggleMute,
    toggleVideo,
    flipCamera,
    sendImage,
    isVideoEnabled,
    generatedImage,
    setGeneratedImage,
    consentGoogleSearch,
    consentTranscription,
    setConsentGoogleSearch,
    setConsentTranscription,
  };
}
