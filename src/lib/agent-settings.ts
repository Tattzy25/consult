// ─── Agent Settings ───────────────────────────────────────────────────────────
// Central config for agent behavior. Defaults live here.
// Built to become a UI dashboard — each setting has a label, description,
// type, and default so a settings panel can render it automatically.
// ─────────────────────────────────────────────────────────────────────────────

export type AgentSettings = {

  // ── Greeting ───────────────────────────────────────────────────────────────

  /**
   * Whether the agent speaks first when the session opens.
   * If true, the agent greets the user immediately without waiting for input.
   */
  greetUser: boolean;

  /**
   * The opening message the agent delivers the moment the session is live.
   * Keep it short and in character.
   */
  greetingMessage: string | null;

  // ── Conversation Flow ──────────────────────────────────────────────────────

  /**
   * How eager the agent is to respond.
   * HIGH = jumps in fast. LOW = waits to make sure user is done speaking.
   * Maps to VAD end-of-speech sensitivity.
   */
  eagerness: "high" | "medium" | "low";

  /**
   * Start generating a response during silence before full turn confidence
   * is reached. Reduces perceived latency — agent feels more alive.
   */
  respondDuringSilence: boolean;

  /**
   * Seconds of user silence before the agent forces a turn and responds.
   * If the user goes quiet for this long, the agent takes over.
   */
  takeTurnAfterSilenceSeconds: number;

  /**
   * Seconds of total silence before the call is terminated.
   * Agent will warn the user before cutting the call.
   */
  endCallAfterSilenceSeconds: number;

  // ── Events ─────────────────────────────────────────────────────────────────

  /**
   * Which events surface to the client UI.
   * agent_tool_response is critical — shows the user the agent is working
   * (e.g. generating an image) so they know something is happening.
   */
  events: {
    audio: boolean;
    interruption: boolean;
    agentResponse: boolean;
    agentToolResponse: boolean;
  };

  // ── Storage & Recording ────────────────────────────────────────────────────

  /**
   * Audio and video are never stored server-side. Ever.
   * If the user opts in to recording, their device captures it locally
   * and they can download or share it. Nothing leaves their device to us.
   */
  serverSideStorage: false; // always false — not a toggle

  /**
   * Whether to ask the user if they want to record the session
   * before the call starts.
   */
  offerRecording: boolean;

  // ── Session Summary ────────────────────────────────────────────────────────

  /**
   * Show a summary screen when the call ends.
   * Always shown regardless of whether the user recorded or not.
   */
  showSessionSummary: boolean;

  /**
   * What to include in the session summary.
   */
  summaryIncludes: {
    date: boolean;
    time: boolean;
    duration: boolean;
    voiceName: boolean;
    personaDescription: boolean;
  };
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  greetUser: true,
  greetingMessage: null, // null = agent reads the room visually and greets naturally

  eagerness: "medium",
  respondDuringSilence: true,
  takeTurnAfterSilenceSeconds: 7,
  endCallAfterSilenceSeconds: 60,

  events: {
    audio: true,
    interruption: true,
    agentResponse: true,
    agentToolResponse: true,
  },

  serverSideStorage: false,
  offerRecording: true,

  showSessionSummary: true,
  summaryIncludes: {
    date: true,
    time: true,
    duration: true,
    voiceName: true,
    personaDescription: true,
  },
};
