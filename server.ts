import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// ─── Session Token Endpoint ───────────────────────────────────────────────────
// Issues a short-lived ephemeral token for the Gemini Live API.
// The client uses this token directly with the @google/genai SDK so the
// real API key never leaves the server.
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/session-token", async (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[session-token] GEMINI_API_KEY is not set");
    res.status(500).json({ error: "Server misconfiguration: API key missing" });
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);

    const tokenRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/ephemeralTokens?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Token is valid for 30 minutes — enough for a full session
          expireTime: new Date((now + 30 * 60) * 1000).toISOString(),
          // New sessions must start within 1 minute of token issuance
          newSessionExpireTime: new Date((now + 60) * 1000).toISOString(),
          usageType: "REALTIME",
          allowedModels: ["models/gemini-3.1-flash-live-preview"],
        }),
      },
    );

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error(
        `[session-token] Gemini token API error ${tokenRes.status}: ${body}`,
      );
      res.status(502).json({
        error: `Token API returned ${tokenRes.status}: ${body}`,
      });
      return;
    }

    const data = (await tokenRes.json()) as { token?: { name?: string } };
    const token = data?.token?.name;

    if (!token) {
      console.error(
        "[session-token] Token API response missing token.name:",
        JSON.stringify(data),
      );
      res.status(502).json({ error: "Token API returned unexpected response" });
      return;
    }

    res.json({ token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[session-token] Unexpected error:", message);
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

// ─── Static Assets (production) ───────────────────────────────────────────────
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Listening on http://0.0.0.0:${PORT}`);
});
