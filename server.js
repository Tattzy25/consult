import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(express.json());
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Gemini API proxy endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    const { message, apiKey, storeId } = req.body;

    // Validate required fields
    if (!message || !apiKey) {
      return res.status(400).json({
        error: 'Missing required fields: message and apiKey'
      });
    }

    // Initialize Gemini client with the provided API key
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Send request to Gemini API
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      storeId,
      response: text
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for: ${FRONTEND_URL}`);
});

