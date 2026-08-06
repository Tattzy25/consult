import { types } from "@google/genai";

// ---------------------------------------------------------------------------
// 1. Strict UCP Schema Definitions (conforming to 2026 specs)
// ---------------------------------------------------------------------------

const UCP_META_SCHEMA = {
  type: "OBJECT",
  description: "Required UCP agent metadata.",
  properties: {
    "ucp-agent": {
      type: "OBJECT",
      description: "The UCP-compliant agent descriptor.",
      properties: {
        profile: {
          type: "STRING",
          description: "The verified, hosted URL to the agent's UCP Profile.",
        },
      },
      required: ["profile"],
    },
  },
  required: ["ucp-agent"],
};

export const LIVE_FUNCTION_DECLARATIONS = [
  {
    name: "search_catalog",
    description: "Search the store's product catalog in natural language based on buyer intent.",
    parameters: {
      type: "OBJECT",
      properties: {
        meta: UCP_META_SCHEMA,
        catalog: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "Free-text search query (e.g., 'wool runners').",
            },
            context: {
              type: "OBJECT",
              description: "Buyer signals for relevance and dynamic localization.",
              properties: {
                address_country: {
                  type: "STRING",
                  description: "ISO 3166-1 alpha-2 country code.",
                },
                currency: {
                  type: "STRING",
                  description: "Three-letter currency code (e.g., USD).",
                },
                intent: {
                  type: "STRING",
                  description: "Optional buyer preferences or qualitative intent clues.",
                },
              },
            },
          },
          required: ["query"],
        },
      },
      required: ["meta", "catalog"],
    },
  },
  {
    name: "get_product",
    description: "Retrieves complete product variant information, pricing, options, and stock details.",
    parameters: {
      type: "OBJECT",
      properties: {
        meta: UCP_META_SCHEMA,
        catalog: {
          type: "OBJECT",
          properties: {
            id: {
              type: "STRING",
              description: "The unique global product or variant identifier (e.g., gid://shopify/Product/123).",
            },
            selected: {
              type: "ARRAY",
              description: "Optional list of selected options used to narrow variants.",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", description: "Option name (e.g., 'Color')." },
                  label: { type: "STRING", description: "Option value label (e.g., 'Blue')." },
                },
                required: ["name", "label"],
              },
            },
          },
          required: ["id"],
        },
      },
      required: ["meta", "catalog"],
    },
  },
  {
    name: "create_checkout",
    description: "Creates a secure checkout session with the merchant. Requires human verification on redirect.",
    parameters: {
      type: "OBJECT",
      properties: {
        meta: UCP_META_SCHEMA,
        checkout: {
          type: "OBJECT",
          properties: {
            line_items: {
              type: "ARRAY",
              description: "Items to populate initially inside the buyer's checkout session.",
              items: {
                type: "OBJECT",
                properties: {
                  variant_id: {
                    type: "STRING",
                    description: "Global variant ID to add.",
                  },
                  quantity: {
                    type: "INTEGER",
                    description: "Integer quantity to add.",
                  },
                },
                required: ["variant_id", "quantity"],
              },
            },
          },
          required: ["line_items"],
        },
      },
      required: ["meta", "checkout"],
    },
  },
];

// ---------------------------------------------------------------------------
// 2. Real-World Dynamic UCP Handlers
// ---------------------------------------------------------------------------

export interface HandlerContext {
  merchantDomain: string;
  agentProfileUrl: string;
}

export const LIVE_FUNCTION_HANDLERS = {
  /**
   * Forwards a search_catalog call directly to the merchant's UCP/MCP endpoint.
   */
  search_catalog: async (args: any, context: HandlerContext): Promise<any> => {
    const endpoint = `https://${context.merchantDomain}/api/ucp/mcp`;
    
    // Inject agent profile dynamically if missing from arguments
    const payloadArgs = { ...args };
    if (!payloadArgs.meta) {
      payloadArgs.meta = {
        "ucp-agent": {
          profile: context.agentProfileUrl,
        },
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "UCP-Agent": `profile="${context.agentProfileUrl}"`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "search_catalog",
          arguments: payloadArgs,
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`UCP Storefront catalog search failed with status ${response.status}`);
    }

    const jsonRpcResponse = await response.json();
    if (jsonRpcResponse.error) {
      throw new Error(`UCP Search Error: ${jsonRpcResponse.error.message}`);
    }

    // UCP over MCP returns output nested inside results.structuredContent
    return jsonRpcResponse.result?.structuredContent || jsonRpcResponse.result;
  },

  /**
   * Forwards a get_product call to extract detailed options and variants.
   */
  get_product: async (args: any, context: HandlerContext): Promise<any> => {
    const endpoint = `https://${context.merchantDomain}/api/ucp/mcp`;
    
    const payloadArgs = { ...args };
    if (!payloadArgs.meta) {
      payloadArgs.meta = {
        "ucp-agent": {
          profile: context.agentProfileUrl,
        },
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "UCP-Agent": `profile="${context.agentProfileUrl}"`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "get_product",
          arguments: payloadArgs,
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`UCP Storefront product retrieval failed with status ${response.status}`);
    }

    const jsonRpcResponse = await response.json();
    if (jsonRpcResponse.error) {
      throw new Error(`UCP Product Retrieval Error: ${jsonRpcResponse.error.message}`);
    }

    return jsonRpcResponse.result?.structuredContent || jsonRpcResponse.result;
  },

  /**
   * Forwards create_checkout to generate continue_url payloads.
   */
  create_checkout: async (args: any, context: HandlerContext): Promise<any> => {
    const endpoint = `https://${context.merchantDomain}/api/ucp/mcp`;
    
    const payloadArgs = { ...args };
    if (!payloadArgs.meta) {
      payloadArgs.meta = {
        "ucp-agent": {
          profile: context.agentProfileUrl,
        },
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "UCP-Agent": `profile="${context.agentProfileUrl}"`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "create_checkout",
          arguments: payloadArgs,
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`UCP Storefront checkout creation failed with status ${response.status}`);
    }

    const jsonRpcResponse = await response.json();
    if (jsonRpcResponse.error) {
      throw new Error(`UCP Checkout Error: ${jsonRpcResponse.error.message}`);
    }

    return jsonRpcResponse.result?.structuredContent || jsonRpcResponse.result;
  },
};