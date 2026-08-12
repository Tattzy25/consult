import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = join(__dirname, 'dist');

// Enable JSON body parsing — critical fix for req.body being undefined
app.use(express.json());

// CORS headers on every response
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, UCP-Agent, MCP-Protocol-Version');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// API endpoint — no try/catch swallowing
app.post('/api/session-token', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  }

  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey });
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
      httpOptions: { apiVersion: 'v1alpha' },
    },
  });

  res.status(200).json({ token: token.name });
});

// NOTE: There is intentionally NO /api/ucp proxy. UCP / Shopify storefront MCP
// endpoints are public and CORS-enabled, so the client calls them directly with
// no token and no proxy. The only backend responsibility here is minting the
// short-lived Gemini ephemeral session token above.

// Serve static files from dist — no SPA fallback
app.use(express.static(DIST_DIR));

// Global error handler — nothing swallowed
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving static files from: ${DIST_DIR}`);
});
