import { Type } from "@google/genai";

// Updated to the exact profile URL used in your successful JSON-RPC test payload
export const UCP_AGENT_PROFILE_URL = "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

/**
 * GEMINI 3.1 FUNCTION DECLARATIONS
 * These follow the exact schema required by the Gemini Live / Interactions API.
 */
export const LIVE_FUNCTION_DECLARATIONS = [
  {
    name: "shopify_ucp_call",
    description: "Directly interacts with the Shopify UCP MCP to search catalogs, manage carts, and handle checkouts for the current merchant store.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tool: {
          type: Type.STRING,
          description: 'The specific UCP MCP tool name. Examples: "search_catalog", "update_cart", "create_checkout".',
        },
        store_domain: {
          type: Type.STRING,
          description: "The shopify domain for the merchant (e.g., 'tattty.myshopify.com').",
        },
        arguments: {
          type: Type.OBJECT,
          description: "The strict nested arguments structure required by the UCP protocol.",
          properties: {
            catalog: {
              type: Type.OBJECT,
              description: "Include this object ONLY when the tool is 'search_catalog'.",
              properties: {
                query: { 
                  type: Type.STRING, 
                  description: "The user's search term (e.g., 'wolf', 'lion', 'numbing cream')." 
                }
              },
              required: ["query"]
            },
            cart: {
              type: Type.OBJECT,
              description: "Include this object for cart and item updates.",
              properties: {
                lines: {
                  type: Type.ARRAY,
                  description: "The array of product variants being modified.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      merchandiseId: { 
                        type: Type.STRING, 
                        description: "The full variant GID (e.g., 'gid://shopify/ProductVariant/12345')." 
                      },
                      quantity: { type: Type.INTEGER }
                    },
                    required: ["merchandiseId", "quantity"]
                  }
                }
              }
            }
          }
        }
      },
      required: ["tool", "arguments", "store_domain"],
    },
  },
] as const;

/**
 * The actual execution logic for the MCP Call
 */
export async function executeMcpCall(args: any) {
  const { tool, arguments: ucpArgs, store_domain } = args;

  if (!store_domain) throw new Error("Missing store_domain for MCP call");
  
  // Construct the dynamic endpoint based on the merchant store
  const dynamicMcpUrl = `https://${store_domain}/api/ucp/mcp`;

  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: Date.now(),
    params: {
      name: tool,
      arguments: {
        meta: {
          "ucp-agent": {
            profile: UCP_AGENT_PROFILE_URL,
          },
        },
        ...ucpArgs,
      },
    },
  };

  const res = await fetch(dynamicMcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Pull token from env or session
      "Authorization": `Bearer ${import.meta.env.VITE_UCP_ACCESS_TOKEN || ''}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Shopify MCP Error (${res.status}): ${errorText}`);
  }

  return await res.json();
}