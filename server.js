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

/**
 * UCP MCP proxy — forwards dynamically to ucp.dev or merchant endpoints.
 * Propagates critical headers (UCP-Agent, Authorization) and formats
 * unresolvable endpoint errors according to compliant JSON-RPC 2.0 / UCP specifications.
 */
app.post('/api/ucp', async (req, res) => {
  // Resolve target merchant endpoint dynamically. 
  // Fall back to ucp.dev if no dynamic target or proxyUrl is supplied.
  const body = req.body;
  const targetUrl = body?._proxyUrl || req.headers['ucp-target-url'] || 'https://ucp.dev/api/mcp';

  try {
    // Extract incoming validation headers to preserve authentication and capability profile context
    const headers = {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': req.headers['mcp-protocol-version'] || '2026-03-26',
    };

    // Forward the platform's UCP-Agent profile advertisement header (RFC 8941 compliance)
    if (req.headers['ucp-agent']) {
      headers['UCP-Agent'] = req.headers['ucp-agent'];
    }

    // Forward private authorization headers securely on behalf of the customer/merchant
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }

    // Execute the proxied fetch request to the dynamic storefront endpoint
    const fetchRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await fetchRes.json();

    // Inject UI metadata for tools that support rendering
    const UI_RESOURCE_URI = "ui://ucp-viewer/mcp-app.html";
    const UI_ENABLED_TOOLS = ["search_catalog", "get_product"];
    const toolName = body.params?.name;

    if (UI_ENABLED_TOOLS.includes(toolName) && data.result) {
      data.result = {
        ...data.result,
        _meta: {
          ui: {
            resourceUri: UI_RESOURCE_URI
          }
        }
      };
    }

    res.status(fetchRes.status).json(data);

  } catch (err) {
    console.error('[UCP PROXY ERROR]', err);
    
    // Dynamically resolve the fallback continue_url based on the target storefront domain
    let dynamicContinueUrl = 'https://ucp.dev/';
    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.hostname !== 'ucp.dev') {
        // Point directly to the merchant's live cart for a seamless buyer recovery handoff
        dynamicContinueUrl = `${parsedUrl.protocol}//${parsedUrl.host}/cart`;
      }
    } catch (urlErr) {
      // Use fallback default on parse failure
    }

    // Format error compliant with JSON-RPC 2.0 / UCP Negotiation Specs on unresolvable hosts
    res.status(502).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32001,
        message: 'UCP proxy communication failed',
        data: {
          code: 'profile_unreachable',
          content: `Unable to forward request to merchant storefront: ${err.message}`,
          continue_url: dynamicContinueUrl
        }
      }
    });
  }
});

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
