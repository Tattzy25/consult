import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

// Middleware
app.use(express.json());

// CORS headers for session token endpoint
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// API endpoint for session token
app.post('/api/session-token', async (req, res) => {
  try {
    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const token = await (client as any).authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    res.status(200).json({ token: token.name });
  } catch (error: any) {
    console.error('Session token error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create session token',
    });
  }
});

// Serve static files from dist (built frontend)
const distPath = join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

