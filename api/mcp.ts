import { MCP_ENDPOINTS } from '../src/lib/mcp-config';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const target = MCP_ENDPOINTS[0];

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
}
