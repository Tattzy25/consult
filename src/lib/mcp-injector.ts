import { MCP_ENDPOINTS } from "./mcp-config";

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

const toolEndpointMap = new Map<string, string>();
let cachedGeminiTools: any[] = [];

async function fetchTools(url: string): Promise<McpTool[]> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  if (!res.ok) throw new Error(`MCP tools/list failed: ${res.status}`);
  const data = await res.json();
  return data.result?.tools ?? [];
}

function toGeminiDeclaration(tool: McpTool) {
  const decl: any = { name: tool.name };
  if (tool.description) decl.description = tool.description;
  if (tool.inputSchema) {
    decl.parameters = {
      type: "object",
      ...tool.inputSchema,
    };
  }
  return decl;
}

export const mcpInjector = {
  connect: async () => {
    toolEndpointMap.clear();
    cachedGeminiTools = [];

    const urls = MCP_ENDPOINTS;

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const tools = await fetchTools(url);
        for (const tool of tools) {
          toolEndpointMap.set(tool.name, url);
          cachedGeminiTools.push(toGeminiDeclaration(tool));
        }
      }),
    );
    results.forEach((r: PromiseSettledResult<void>, i: number) => {
      if (r.status === "rejected") console.warn(`MCP endpoint failed: ${urls[i]}`, (r as PromiseRejectedResult).reason);
    });
  },

  disconnect: () => {
    toolEndpointMap.clear();
    cachedGeminiTools = [];
  },

  getGeminiTools: (enabledTools?: string[]): any[] => {
    if (!enabledTools || enabledTools.length === 0) return cachedGeminiTools;
    return cachedGeminiTools.filter((t) => enabledTools.includes(t.name));
  },

  executeTool: async (name: string, args: unknown): Promise<{ text: string }> => {
    const url = toolEndpointMap.get(name);
    if (!url) throw new Error(`Unknown tool: ${name}`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    if (!res.ok) throw new Error(`MCP tools/call failed: ${res.status}`);
    const data = await res.json();
    const content = data.result?.content;
    if (Array.isArray(content)) {
      return { text: content.map((c: any) => c.text ?? "").join("") };
    }
    return { text: JSON.stringify(data.result ?? data.error ?? "") };
  },
};
