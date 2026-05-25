export type LivePersonaConfig = {
  personaId: string;
  systemInstruction: string;
  model?: string;
  enableGoogleSearch?: boolean;
  enabledMcpTools?: string[];
};

export async function startLiveSession(_params: {
  sessionId: string;
  personaId: string;
  model: string;
  voice: string;
  startedAt: string;
  metadata?: Record<string, unknown>;
}) {}

export async function endLiveSession(_params: {
  sessionId: string;
  elapsedMs: number;
  reason: string;
  metadata?: Record<string, unknown>;
}) {}

export async function heartbeatLiveSession(_params: {
  sessionId: string;
  elapsedMs: number;
  muted: boolean;
  videoEnabled: boolean;
  metadata?: Record<string, unknown>;
}) {}
