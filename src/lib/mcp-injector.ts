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
  const data = await res.json();
  return data.result?.tools ?? [];
}

function toGeminiDeclaration(tool: McpTool) {
  const decl: any = { name: tool.name };
  if (tool.description) decl.description = tool.description;
  if (tool.inputSchema) decl.parameters = tool.inputSchema;
  return decl;
}

export const mcpInjector = {
  connect: async () => {
    toolEndpointMap.clear();
    cachedGeminiTools = [];

    const raw = import.meta.env.VITE_MCP_ENDPOINTS as string | undefined;
    if (!raw) return;

    const urls = raw.split(",").map((u) => u.trim()).filter(Boolean);

    await Promise.all(
      urls.map(async (url) => {
        const tools = await fetchTools(url);
        for (const tool of tools) {
          toolEndpointMap.set(tool.name, url);
          cachedGeminiTools.push(toGeminiDeclaration(tool));
        }
      }),
    );
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
    const url = toolEndpointMap.get(name)!;
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
    const data = await res.json();
    const content = data.result?.content;
    if (Array.isArray(content)) {
      return { text: content.map((c: any) => c.text ?? "").join("") };
    }
    return { text: JSON.stringify(data.result ?? data.error ?? "") };
  },
};
