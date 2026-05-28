import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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

// API endpoint for session token
app.post('/api/session-token', async (req, res) => {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1alpha/createSession?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-3.1-flash-live-preview',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      return res.status(response.status).json({
        error: `Failed to create session: ${response.statusText}`,
      });
    }

    const data = await response.json();
    const token = data.session?.token;

    if (!token) {
      console.error('No token in response:', data);
      return res.status(500).json({
        error: 'No token received from Gemini API',
      });
    }

    res.json({ token });
  } catch (error) {
    console.error('Session token error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
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

