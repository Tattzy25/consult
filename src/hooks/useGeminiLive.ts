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
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const isMutedRef = useRef(false);
  const isVideoEnabledRef = useRef(true);
  const cameraFacingRef = useRef<"user" | "environment">("user");
  const isSessionOpenRef = useRef(false);

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

  const cleanupMedia = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

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
        facingMode: cameraFacingRef.current,
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
      if (isMutedRef.current || !sessionRef.current || !isSessionOpenRef.current) return;
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
        !sessionRef.current ||
        !isSessionOpenRef.current ||
        !videoRef.current ||
        !canvasRef.current
      )
        return;

      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch((err) => {
          console.error("🚨 INITIAL VIDEO PLAY FAILED:", err);
        });
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;

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

  const flipCamera = useCallback(async () => {
    try {
      const nextFacing = cameraFacingRef.current === "user" ? "environment" : "user";
      cameraFacingRef.current = nextFacing;
      setCameraFacing(nextFacing);

      streamRef.current!.getVideoTracks().forEach((track) => {
        track.stop();
        streamRef.current!.removeTrack(track);
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
      streamRef.current!.addTrack(newVideoTrack);

      videoRef.current!.srcObject = streamRef.current;
      videoRef.current!.play().catch((err) => {
        console.error("🚨 VIDEO PLAY FAILED AFTER FLIP:", err);
      });
    } catch (err) {
      console.error("🚨 CAMERA FLIP FAILED:", err);
    }
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
              isSessionOpenRef.current = true;
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
                if (part.toolCode) {
                  // Assuming the toolCode will contain information about the image generation
                  // For now, let's just set a dummy URL
                  console.log("Tool code received:", part.toolCode);
                  // In a real scenario, you would parse part.toolCode and make an HTTP request
                  // to the MCP endpoint with the extracted parameters (memory, add memory, search).
                  // For now, we'll simulate a response with a dummy URL.
                  setGeneratedImageUrl("https://via.placeholder.com/600x400?text=Generated+Image");
                }
              }
            },
            onclose: () => {
              isSessionOpenRef.current = false;
              cleanupMedia();
              resetPlayback();
              sessionRef.current = null;
              setIsConnected(false);
              setStatus("idle");
            },
            onerror: (error) => {
              console.error("Live API Error:", error);
              isSessionOpenRef.current = false;
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
        isSessionOpenRef.current = false;
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
    videoRef,
    canvasRef,
    startConnection,
    disconnect,
    toggleMute,
    toggleVideo,
    flipCamera,
    sendImage,
    isVideoEnabled,
    generatedImageUrl, // Expose the generated image URL
    setGeneratedImageUrl, // Expose the setter to clear the image
  };
}
