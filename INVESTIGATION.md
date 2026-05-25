# Code Quality & Architecture Investigation

## Executive Summary
This codebase contains critical architectural gaps, silent fallbacks that mask failures, hardcoded configurations preventing modularity, and stub functions that appear to work but are actually no-ops. The system tracks sessions locally but discards them, requires code modifications to swap personas, and has no proper error boundaries.

---

## 1. NATIVE TOOL CALLS IMPLEMENTATION ISSUES

### Current State
**File**: [src/lib/mcp-injector.ts](src/lib/mcp-injector.ts)

MCP tool injection exists but has critical gaps:

#### Issue 1.1: Silent Error Swallowing
```typescript
executeTool: async (name: string, args: unknown): Promise<{ text: string }> => {
  const url = toolEndpointMap.get(name);
  if (!url) throw new Error(`Unknown tool: ${name}`); // ← throws but caller doesn't handle
  const res = await fetch(url, { ... });
  if (!res.ok) throw new Error(`MCP tools/call failed: ${res.status}`); // ← throws but caller doesn't handle
  const data = await res.json();
  const content = data.result?.content;
  if (Array.isArray(content)) {
    return { text: content.map((c: any) => c.text ?? "").join("") }; // ← silently ignores undefined
  }
  return { text: JSON.stringify(data.result ?? data.error ?? "") }; // ← returns empty string on error
}
```

**Problems**:
- No try-catch in caller catches these errors
- Empty tool responses return `""` instead of error state
- `(c: any) => c.text ?? ""` masks missing response data
- Errors aren't logged, so failures are invisible

#### Issue 1.2: No Tool Call Tracing
- No logging of which tools are being called
- No way to debug tool failures in production
- No metrics on tool success/failure rates
- No circuit breaker for failing endpoints

#### Issue 1.3: Tool Declaration Conversion is Lossy
```typescript
function toGeminiDeclaration(tool: McpTool) {
  const decl: any = { name: tool.name, behavior: "NON_BLOCKING" }; // ← hardcoded
  if (tool.description) decl.description = tool.description;
  if (tool.inputSchema) {
    decl.parameters = { type: "object", ...tool.inputSchema }; // ← could lose nested validation
  }
  return decl;
}
```

**Problems**:
- `behavior` is hardcoded to `NON_BLOCKING` — no configuration for blocking tools
- Spreads `inputSchema` directly without validation
- Loses any custom MCP schema constraints
- No type safety in the conversion

### Recommendations
1. Add explicit error handling in tool call sites
2. Implement structured logging for all tool invocations
3. Add retry logic with exponential backoff
4. Create tool call metrics/observability
5. Validate schema conversion preserves intent

---

## 2. PERSONA & ORB DYNAMIC SETUP

### Current State
**File**: [src/lib/persona.ts](src/lib/persona.ts)

Persona configuration is completely **hardcoded and static**:

```typescript
export const PERSONA_CONFIG: LivePersonaConfig = {
  personaId: "tatty-default",
  model: "gemini-3.1-flash-live-preview",
  systemInstruction: SYSTEM_PROMPT, // ← 100+ lines of TaTTTy specific text
  enableGoogleSearch: true,
};
```

### Issues

#### Issue 2.1: Single Persona Hardcoded
- Only TaTTTy exists
- "Second app — all personas, all worlds" mentioned in OWNER_MANUAL but not implemented
- To swap personas, must edit this file and rebuild
- No registry or factory pattern
- System prompt is 100+ lines — unmaintainable for multiple personas

#### Issue 2.2: No Persona Registry
No structure exists for:
- Loading personas from config
- Dynamic persona switching at runtime
- Persona validation
- Persona metadata (name, description, capabilities)
- Voice mapping per persona

#### Issue 2.3: ORB Not Mentioned
- "Second app — all personas, all worlds" references an ORB product mentioned in OWNER_MANUAL
- No code exists for ORB persona setup
- No clear distinction between TaTTTy (tattoo) and ORB (unknown purpose)
- Appears to be incomplete/planned feature

### Current Usage
**File**: [src/hooks/useGeminiLive.ts](src/hooks/useGeminiLive.ts) (line ~25)
```typescript
export function useGeminiLive(personaConfig: LivePersonaConfig) {
  // accepts personaConfig but it's always PERSONA_CONFIG from persona.ts
}
```

**File**: [src/App.tsx](src/App.tsx) — Not examined yet but likely hardcodes persona import

### Recommendations
1. Create a PersonaRegistry in separate file: `src/lib/persona-registry.ts`
2. Define persona schema with metadata
3. Load personas from JSON config or env
4. Implement factory function for persona selection
5. Support dynamic persona switching without rebuild
6. Define ORB persona structure

**Sample Structure**:
```typescript
type Persona = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  enabledTools: string[];
  voiceMap: Record<string, string>; // voice name to ID
  enableGoogleSearch: boolean;
};

const PERSONAS: Record<string, Persona> = {
  "tatty": { /* TaTTTy config */ },
  "orb": { /* ORB config */ },
};

export function getPersona(personaId: string): Persona { ... }
```

---

## 3. CALL SETUP WITH BEFORE/AFTER SUMMARY

### Current State
**File**: [src/lib/agent-settings.ts](src/lib/agent-settings.ts) ≈ lines 1-100

Agent settings **define** what should be in summaries but **no code generates them**:

```typescript
summaryIncludes: {
  date: boolean;
  time: boolean;
  duration: boolean;
  voiceName: boolean;
  personaDescription: boolean;
};

showSessionSummary: boolean; // ← shows WHAT to do, not HOW
```

### Issues

#### Issue 3.1: Session Tracking is a No-Op
**File**: [src/lib/live-session-api.ts](src/lib/live-session-api.ts)

```typescript
export async function startLiveSession(_params: { // ← underscore = ignored
  sessionId: string;
  personaId: string;
  model: string;
  voice: string;
  startedAt: string;
  metadata?: Record<string, unknown>;
}) {}

export async function endLiveSession(_params: { // ← underscore = ignored
  sessionId: string;
  elapsedMs: number;
  reason: string;
  metadata?: Record<string, unknown>;
}) {}

export async function heartbeatLiveSession(_params: { // ← underscore = ignored
  sessionId: string;
  elapsedMs: number;
  muted: boolean;
  videoEnabled: boolean;
  metadata?: Record<string, unknown>;
}) {}
```

**Problems**:
- All three functions are empty stubs with `_params` (underscore prefix) — intentional ignoring of arguments
- Session data is collected and passed in but thrown away
- No persistent storage of sessions
- No pre-call setup
- No post-call summary generation
- Session tracking in `useGeminiLive` calls these but they do nothing

#### Issue 3.2: Before/After Summary Not Implemented
- No component renders pre-call setup
- No component renders post-call summary
- Settings define structure but no implementation exists
- No data collection for summary generation

#### Issue 3.3: Session State Lost
**File**: [src/hooks/useGeminiLive.ts](src/hooks/useGeminiLive.ts) (line ~30-60)

```typescript
const liveSessionIdRef = useRef<string | null>(null);
const liveSessionStartedAtRef = useRef<number | null>(null);
// Session data is created locally:
const beginSessionTracking = useCallback(
  (voice: string, model: string) => {
    const sessionId = crypto.randomUUID();
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    // ↓ calls live-session-api which does nothing
    void startLiveSession({
      sessionId,
      personaId: personaConfig.personaId,
      model,
      voice,
      startedAt,
      metadata: { ... },
    });
  },
  [...],
);
```

- Session data is generated but passed to no-op function
- When session ends, data is discarded
- No way to retrieve session history

### Recommendations
1. **Implement pre-call summary**:
   - Show user: persona description, voice selection, camera/mic status
   - Consent checkboxes (recording, transcription)
   - Ability to review settings before connecting

2. **Implement post-call summary**:
   - Display generated summary based on settings
   - Include transcript
   - Option to download/share

3. **Implement session storage**:
   - IndexedDB for local session history
   - Optional backend storage (with user consent)
   - Session retrieval by ID

4. **Generate summaries**:
   - Extract key points from transcript
   - Format per `summaryIncludes` settings
   - Create shareable summary format

---

## 4. SILENT FALLBACKS & MOCK IMPLEMENTATIONS

### Issue 4.1: Empty Session API
**Severity**: CRITICAL

`live-session-api.ts` is entirely non-functional. Three functions that should:
- Start session tracking
- Record session end events
- Send periodic heartbeats

Instead: do nothing.

### Issue 4.2: Generic Error Handling Masks Failures
**Severity**: HIGH

Multiple places where errors are caught and converted to empty/neutral responses:

```typescript
// MCP tool errors become empty strings
return { text: content.map((c: any) => c.text ?? "").join("") };
return { text: JSON.stringify(data.result ?? data.error ?? "") }; // ← ?? "" masks errors

// Audio worklet messages with no error handling
if (message.data.type === "error") {
  // Not shown in snippet but likely silently ignored
}
```

### Issue 4.3: No Error Boundaries in React
- useGeminiLive passes errors to callers
- If caller doesn't handle, error silently propagates
- No global error handling for tool failures
- No error state in UI

### Issue 4.4: Video Capture Assumes Success
**File**: [src/hooks/useGeminiLive.ts](src/hooks/useGeminiLive.ts) (captureFrame function)

```typescript
const captureFrame = useCallback(() => {
  if (!isVideoEnabledRef.current || !sessionRef.current || ...) {
    return; // silently exits
  }
  if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return; // silently exits
  }
  // Calls canvas context operations that could fail — no try-catch
});
```

### Issue 4.5: Audio Worklet Errors Silent
- Audio worklet messages (`audio-input-worklet.js`, `audio-output-worklet.js`) have no error reporting
- If worklet crashes, main thread has no way to know
- Transcoding (PCM16 ↔ Base64) has no validation

### Recommendations
1. Add explicit error handling with error codes
2. Log all errors with context
3. Implement error recovery strategies
4. Create error states in React components
5. Add error boundaries
6. Implement proper logging infrastructure

---

## 5. UNUSED & DEAD CODE

### Issue 5.1: hooks/use-sound.ts
**File**: [hooks/use-sound.ts](hooks/use-sound.ts)
- Exported but no imports found
- Likely dead code from previous implementation

### Issue 5.2: lib/sound-engine.ts
**File**: [lib/sound-engine.ts](lib/sound-engine.ts)
- Exported functions for sound engine
- Audio is handled by worklets now — likely superseded
- Check if actually used

### Issue 5.3: Unused Components
**Files to verify**:
- `src/components/WreckShader.tsx` — used?
- `src/components/ui/GeneratedImageOverlay.tsx` — used?
- `src/components/unlumen-ui/dock.tsx` vs `src/components/ui/Dock.tsx` — duplicate?

### Issue 5.4: Unused Settings
**File**: [src/lib/agent-settings.ts](src/lib/agent-settings.ts)

```typescript
export type AgentSettings = {
  greetUser: boolean;           // defined but never read
  greetingMessage: string | null; // defined but never used
  eagerness: "high" | "medium" | "low"; // defined but not implemented
  respondDuringSilence: boolean; // defined but not implemented
  takeTurnAfterSilenceSeconds: number; // defined but not implemented
  endCallAfterSilenceSeconds: number; // defined but not implemented
  // ... etc
};
```

All settings are defined but **no code reads or applies them**. They're placeholder architecture with no behavior.

### Recommendations
1. Audit imports to find dead code
2. Remove or implement unused hooks/libs
3. Consolidate duplicate UI components
4. Either implement all AgentSettings or remove them

---

## 6. MISSING IMPLEMENTATIONS

### Issue 6.1: Before-Call Setup Missing
- No pre-call screen
- No consent forms (recording, transcription)
- No settings review
- User goes directly into live session

### Issue 6.2: After-Call Summary Missing
- No summary screen
- No transcript display
- No download/share options
- Session data lost when component unmounts

### Issue 6.3: Session History Missing
- No way to view past sessions
- No session replay
- No analytics
- No audit trail

### Issue 6.4: Persona Settings UI Missing
- No way to select persona
- No way to configure ORB
- Hardcoded to TaTTTy forever

### Issue 6.5: MCP Tool Management Missing
- No UI to enable/disable tools
- No tool status indicators
- No tool call history

---

## PRIORITY FIX LIST

### P0 (Critical — Blocks functionality)
1. **Implement session tracking** — `live-session-api.ts` is non-functional
   - Add IndexedDB storage or backend API
   - Actually record start/end/heartbeat events
   - Estimated: 4-6 hours

2. **Add error handling to tool calls**
   - Wrap `executeTool` calls in try-catch
   - Log errors with context
   - Return error states instead of empty strings
   - Estimated: 2-3 hours

3. **Implement post-call summary**
   - Extract key points from transcript
   - Render summary screen
   - Allow download/share
   - Estimated: 6-8 hours

### P1 (High — Enables features)
4. **Implement dynamic persona setup**
   - Create persona registry
   - Add persona selection UI
   - Support ORB personas
   - Estimated: 8-10 hours

5. **Implement pre-call setup screen**
   - Consent forms
   - Settings review
   - Camera/mic test
   - Estimated: 4-6 hours

6. **Implement all AgentSettings**
   - Either use them or remove them
   - Add settings UI for those that are meaningful
   - Estimated: 8-12 hours

### P2 (Medium — Nice to have)
7. Consolidate duplicate UI components
8. Audit and remove dead code
9. Add tool call logging/metrics
10. Implement circuit breaker for failing MCP endpoints

---

## SUMMARY

This codebase has solid **infrastructure** (Gemini Live API integration, audio worklets, MCP framework) but **critical behavioral gaps**:

✅ **Works**: Audio I/O, video capture, Gemini Live streaming

❌ **Broken**: Session tracking (no-op), error handling (silent), persona swapping (hardcoded)

❌ **Missing**: Pre/post-call UI, session history, settings UI, dynamic persona support

⚠️ **Risk**: Silent failures mask real issues. Errors are caught and thrown away. Session data is lost.

The codebase needs:
1. Complete error handling implementation
2. Session storage (local + optional backend)
3. Pre/post-call UI implementation
4. Dynamic persona registry
5. Settings UI that actually applies settings

Estimated total effort to production-ready: **40-60 engineer hours**
