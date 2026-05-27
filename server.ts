import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/session-token', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Not configured' });
    return;
  }

  try {
    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const token = await (client as any).authTokens.create();
    res.status(200).json({ token: token.name });
  } catch (error) {
    console.error('Failed to create session token:', error);
    res.status(500).json({ error: 'Failed to create session token' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
