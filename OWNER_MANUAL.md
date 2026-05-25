# Owner's Manual
### BaDDDiie — AI Live Consultation Platform

---

## Agent Settings
**File:** `src/lib/agent-settings.ts`

All defaults live here. When you're ready to build the settings dashboard, every option is already typed and documented — just wire it to a UI.

---

### Greeting

| Setting | Default | What it does |
|---|---|---|
| `greetUser` | `true` | Agent speaks first the moment the session is live. No waiting for the user to say something. |
| `greetingMessage` | `null` | `null` means the agent reads the room — it can see the user on camera and greets naturally based on what it observes. Set a string to force a specific opener. |

---

### Conversation Flow

| Setting | Default | What it does |
|---|---|---|
| `eagerness` | `"medium"` | How fast the agent jumps in. `high` = cuts in quickly. `low` = waits to make sure the user is done. |
| `respondDuringSilence` | `true` | Agent starts forming a response during a pause before the user fully finishes. Feels more human, less laggy. |
| `takeTurnAfterSilenceSeconds` | `7` | If the user goes quiet for 7 seconds, the agent takes over and responds. Prevents dead air. |
| `endCallAfterSilenceSeconds` | `60` | If nobody speaks for 60 seconds total, the call ends. Agent warns the user before cutting it. |

---

### Events

These control what surfaces to the UI so the user knows what's happening in real time.

| Event | Default | What it does |
|---|---|---|
| `audio` | `true` | Audio stream events |
| `interruption` | `true` | When the user cuts the agent off mid-sentence |
| `agentResponse` | `true` | When the agent is responding |
| `agentToolResponse` | `true` | When the agent calls a tool (image gen, memory, etc.) — user sees the agent is working, not just silent |

---

### Storage & Recording

| Setting | Default | What it does |
|---|---|---|
| `serverSideStorage` | `false` | **Always false. Cannot be changed.** Nothing is ever stored server-side. Audio, video, conversation — none of it. |
| `offerRecording` | `true` | Before the call starts, the user is asked if they want to record. If yes, their device captures it locally. They can download or share. Nothing comes to us. |

---

### Session Summary

Shown at the end of every call regardless of whether the user recorded.

| Setting | Default |
|---|---|
| `showSessionSummary` | `true` |
| Include date | `true` |
| Include time | `true` |
| Include duration | `true` |
| Include voice name | `true` |
| Include persona description | `true` |

---

## Memory System
**Powered by:** Dify MCP Tools

The agent has memory. It creates a profile for each user after every session and builds a skill set specific to that person for the next time they call. It can look back up to 1 year. This is not mentioned to the user — it just works in the background.

Tools available to the agent (called autonomously, never triggered by the user):
- Generate image
- Save memory
- Retrieve memory / search knowledge base
- Edit image

---

## Security

- API key never reaches the browser — an ephemeral token is generated server-side per session (expires in 30 minutes)
- No data stored server-side, ever
- Recording is device-local only if the user opts in

---

## Two Apps, One Core

This platform powers two apps. The agent settings, memory system, session summary, and tool architecture are shared. Only the persona changes between apps.

- **TaTTTy** — tattoo consultation
- **Second app** — all personas, all worlds

Persona config lives in `src/lib/persona.ts`. Swap the system instruction and persona description to deploy a different character.



HOW DO WE ACTUALLY SET THIS UP ???
