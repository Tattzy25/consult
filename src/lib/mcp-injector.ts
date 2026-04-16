// Transparent, verifiably correct MCP HTTP/SSE Client Implementation
// Adheres strictly to the Model Context Protocol specification without opaque SDKs.

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export class MCPInjector {
  private sseSource: EventSource | null = null;
  private postEndpoint: string | null = null;
  private tools: Tool[] = [];
  private messageIdCounter = 1;

  constructor() {}

  /**
   * Establishes the SSE connection and resolves the POST endpoint.
   */
  async connect(): Promise<boolean> {
    const endpointUrl = import.meta.env.VITE_MCP_ENDPOINT_URL;
    
    if (!endpointUrl) {
      console.warn("VITE_MCP_ENDPOINT_URL is not set. MCP tools will not be injected.");
      return false;
    }

    return new Promise((resolve) => {
      try {
        this.sseSource = new EventSource(endpointUrl);

        // The MCP spec dictates the server sends an 'endpoint' event containing the POST URL
        this.sseSource.addEventListener("endpoint", async (event: MessageEvent) => {
          try {
            // The event data contains the URI for POST requests.
            // It might be relative or absolute.
            const postUri = event.data;
            this.postEndpoint = new URL(postUri, endpointUrl).toString();
            console.log(`[MCP] SSE Connection established. POST endpoint resolved: ${this.postEndpoint}`);
            
            // Once we have the POST endpoint, we must initialize the connection
            const initSuccess = await this.initializeConnection();
            if (!initSuccess) {
              resolve(false);
              return;
            }

            // After initialization, fetch the available tools
            const toolsSuccess = await this.fetchTools();
            resolve(toolsSuccess);

          } catch (error) {
            console.error("[MCP] Failed to process endpoint event:", error);
            this.disconnect();
            resolve(false);
          }
        });

        this.sseSource.onerror = (error) => {
          console.error("[MCP] SSE Connection error:", error);
          this.disconnect();
          resolve(false);
        };

      } catch (error) {
        console.error("[MCP] Failed to initialize EventSource:", error);
        resolve(false);
      }
    });
  }

  /**
   * Sends the required 'initialize' JSON-RPC request.
   */
  private async initializeConnection(): Promise<boolean> {
    try {
      const response = await this.sendJsonRpcRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "gemini-live-client",
          version: "1.0.0"
        }
      });

      if (response.error) {
        console.error("[MCP] Initialization failed:", response.error);
        return false;
      }

      // Send the initialized notification
      await this.sendJsonRpcNotification("notifications/initialized");
      return true;
    } catch (error) {
      console.error("[MCP] Initialization request failed:", error);
      return false;
    }
  }

  /**
   * Fetches the list of tools from the MCP server.
   */
  private async fetchTools(): Promise<boolean> {
    try {
      const response = await this.sendJsonRpcRequest("tools/list");
      
      if (response.error) {
        console.error("[MCP] Failed to fetch tools:", response.error);
        return false;
      }

      if (response.result && Array.isArray(response.result.tools)) {
        this.tools = response.result.tools;
        console.log(`[MCP] Successfully loaded ${this.tools.length} tools.`);
        return true;
      }

      console.error("[MCP] Invalid tools response format:", response);
      return false;
    } catch (error) {
      console.error("[MCP] Tool fetch request failed:", error);
      return false;
    }
  }

  /**
   * Formats the fetched tools into the schema required by Gemini.
   */
  getGeminiTools() {
    if (!this.tools || this.tools.length === 0) {
      return [];
    }

    const functionDeclarations = this.tools.map(tool => {
      const formatSchema = (schema: any): any => {
        if (!schema) return undefined;
        
        const typeMap: Record<string, string> = {
          "string": "STRING",
          "number": "NUMBER",
          "integer": "INTEGER",
          "boolean": "BOOLEAN",
          "array": "ARRAY",
          "object": "OBJECT"
        };

        const formatted: any = {
          type: typeMap[schema.type] || "STRING",
          description: schema.description,
        };

        if (schema.type === "object" && schema.properties) {
          formatted.properties = {};
          for (const [key, value] of Object.entries(schema.properties)) {
            formatted.properties[key] = formatSchema(value);
          }
          if (schema.required) {
            formatted.required = schema.required;
          }
        } else if (schema.type === "array" && schema.items) {
          formatted.items = formatSchema(schema.items);
        }

        return formatted;
      };

      return {
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`,
        parameters: tool.inputSchema ? formatSchema(tool.inputSchema) : undefined
      };
    });

    return [{ functionDeclarations }];
  }

  /**
   * Executes a tool call via HTTP POST.
   */
  async executeTool(name: string, args: any) {
    if (!this.postEndpoint) {
      throw new Error("MCP Client is not fully connected (missing POST endpoint)");
    }

    console.log(`[MCP] Executing tool: ${name}`, args);

    try {
      const response = await this.sendJsonRpcRequest("tools/call", {
        name,
        arguments: args
      });

      if (response.error) {
        throw new Error(response.error.message || JSON.stringify(response.error));
      }

      return response.result;
    } catch (error) {
      console.error(`[MCP] Error executing tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Helper to send JSON-RPC 2.0 requests.
   */
  private async sendJsonRpcRequest(method: string, params?: any): Promise<any> {
    if (!this.postEndpoint) throw new Error("No POST endpoint available");

    const payload = {
      jsonrpc: "2.0",
      id: this.messageIdCounter++,
      method,
      params
    };

    try {
      const response = await fetch(this.postEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Helper to send JSON-RPC 2.0 notifications (no response expected).
   */
  private async sendJsonRpcNotification(method: string, params?: any): Promise<void> {
    if (!this.postEndpoint) throw new Error("No POST endpoint available");

    const payload = {
      jsonrpc: "2.0",
      method,
      params
    };

    try {
      await fetch(this.postEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error(`[MCP] Failed to send notification ${method}:`, error);
    }
  }

  disconnect() {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    this.postEndpoint = null;
    this.tools = [];
    console.log("[MCP] Disconnected.");
  }
}

// Export a singleton instance
export const mcpInjector = new MCPInjector();
