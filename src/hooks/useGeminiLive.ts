import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

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

export function useGeminiLive(systemInstruction: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  const isMutedRef = useRef(false);
  const isVideoEnabledRef = useRef(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);

  const inputNodeRef = useRef<AudioWorkletNode | null>(null);
  const outputNodeRef = useRef<AudioWorkletNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const videoIntervalRef = useRef<number | null>(null);

  const pendingOutputRef = useRef<Int16Array[]>([]);
  const pendingOutputSamplesRef = useRef(0);
  const playbackPrimedRef = useRef(false);

  const cleanupMedia = useCallback(() => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (inputNodeRef.current) {
      inputNodeRef.current.port.onmessage = null;
      inputNodeRef.current.disconnect();
      inputNodeRef.current = null;
    }

    if (outputNodeRef.current) {
      outputNodeRef.current.disconnect();
      outputNodeRef.current = null;
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
  }, []);

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
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    const inputCtx = inputCtxRef.current!;
    const source = inputCtx.createMediaStreamSource(stream);
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
      if (isMutedRef.current || !sessionRef.current) return;
      const pcm = new Int16Array(event.data);
      const base64Data = pcm16ToBase64(pcm);

      sessionRef.current.sendRealtimeInput({
        audio: {
          data: base64Data,
          mimeType: `audio/pcm;rate=${INPUT_RATE}`,
        },
      });
    };

    const captureFrame = () => {
      if (
        !isVideoEnabledRef.current ||
        !sessionRef.current ||
        !videoRef.current ||
        !canvasRef.current
      )
        return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];

      sessionRef.current.sendRealtimeInput({
        video: { data: base64Data, mimeType: "image/jpeg" },
      });
    };

    videoIntervalRef.current = window.setInterval(
      captureFrame,
      VIDEO_INTERVAL_MS,
    );
  }, []);

  const disconnect = useCallback(() => {
    cleanupMedia();
    resetPlayback();

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
  }, [cleanupMedia, resetPlayback]);

  const startConnection = useCallback(
    async (selectedVoice: string) => {
      try {
        setStatus("connecting");
        await initAudio();
        
        // Request media BEFORE connection to ensure mobile browsers don't block it
        await startStreaming();

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const session = await ai.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: async () => {
              setIsConnected(true);
              setStatus("live");
              resetPlayback();
            },
            onmessage: (message: LiveServerMessage) => {
              if (message.serverContent?.interrupted) {
                resetPlayback();
              }

              const parts = message.serverContent?.modelTurn?.parts ?? [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  const pcm = base64ToPCM16(part.inlineData.data);
                  enqueueOutputPCM(pcm);
                }
                if (part.text) {
                  setTranscript((prev) => [
                    ...prev,
                    { role: "wreck", text: part.text! },
                  ]);
                }
              }
            },
            onclose: () => {
              cleanupMedia();
              resetPlayback();
              sessionRef.current = null;
              setIsConnected(false);
              setStatus("idle");
            },
            onerror: (error) => {
              console.error("Live API Error:", error);
              cleanupMedia();
              resetPlayback();
              sessionRef.current = null;
              setIsConnected(false);
              setStatus("error");
            },
          },
        });

        sessionRef.current = session;
      } catch (err) {
        console.error("Failed to connect:", err);
        cleanupMedia();
        resetPlayback();
        sessionRef.current = null;
        setStatus("error");
        setIsConnected(false);
      }
    },
    [
      cleanupMedia,
      enqueueOutputPCM,
      initAudio,
      resetPlayback,
      startStreaming,
      systemInstruction,
    ],
  );

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
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = next;
        });
      }
      return next;
    });
  }, []);

  return {
    isConnected,
    isMuted,
    isVideoEnabled,
    isAudioPlaying,
    transcript,
    status,
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    toggleMute,
    toggleVideo,
  };
}
