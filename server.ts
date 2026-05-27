import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/session-token', (req, res) => {
  res.status(200).json({ token: process.env.GEMINI_API_KEY ?? '' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
