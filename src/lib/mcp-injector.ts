import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class MCPInjector {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private tools: Tool[] = [];

  constructor() {}

  async connect() {
    // Strictly pull from environment variables to allow hot-swapping
    const endpointUrl = import.meta.env.VITE_MCP_ENDPOINT_URL;
    
    if (!endpointUrl) {
      console.warn("VITE_MCP_ENDPOINT_URL is not set. MCP tools will not be injected.");
      return false;
    }

    try {
      this.transport = new SSEClientTransport(new URL(endpointUrl));
      this.client = new Client({
        name: "gemini-live-client",
        version: "1.0.0",
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);
      
      // Fetch tools
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools;
      
      console.log(`Successfully connected to MCP endpoint and loaded ${this.tools.length} tools.`);
      return true;
    } catch (error) {
      console.error("Failed to connect to MCP endpoint:", error);
      return false;
    }
  }

  getGeminiTools() {
    if (!this.tools || this.tools.length === 0) {
      return [];
    }

    const functionDeclarations = this.tools.map(tool => {
      // Convert JSON Schema to Gemini Function Declaration format
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

  async executeTool(name: string, args: any) {
    if (!this.client) {
      throw new Error("MCP Client is not connected");
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      
      return result;
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      throw error;
    }
  }

  disconnect() {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.client = null;
    this.tools = [];
  }
}

// Export a singleton instance
export const mcpInjector = new MCPInjector();
