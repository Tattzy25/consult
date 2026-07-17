import { Type } from "@google/genai";

export const UCP_AGENT_PROFILE_URL = "https://blackbox.tattty.com/.well-known/ucp-agent.json";

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
          description: 'The specific MCP tool name. Examples: "search_catalog", "create_cart", "create_checkout", "catalog_lookup".',
        },
        arguments: {
          type: Type.OBJECT,
          description: "The arguments required by the specific MCP tool (e.g., query for search, productId for lookup).",
        },
        store_domain: {
          type: Type.STRING,
          description: "The shopify domain for the merchant (e.g., 'nba0ey-th.myshopify.com').",
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