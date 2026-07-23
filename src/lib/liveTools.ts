import { Type } from "@google/genai";

export const UCP_AGENT_PROFILE_URL =
  "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

export const LIVE_FUNCTION_DECLARATIONS = [
  {
    name: "search_catalog",
    description:
      "Search a merchant's UCP catalog. Returns products, prices, images, and checkout URLs.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: {
          type: Type.STRING,
          description:
            "The Shopify store domain to query, e.g. 'tattty.myshopify.com'.",
        },
        arguments: {
          type: Type.OBJECT,
          description: "UCP search_catalog arguments.",
          properties: {
            catalog: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING },
                filters: { type: Type.OBJECT },
                pagination: { type: Type.OBJECT },
              },
              required: ["query"],
            },
            context: { type: Type.OBJECT },
          },
          required: ["catalog"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },

  {
    name: "get_product",
    description:
      "Get full variant matrix and availability for a specific UCP product ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: {
          type: Type.STRING,
          description: "The Shopify store domain.",
        },
        arguments: {
          type: Type.OBJECT,
          properties: {
            product: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
              },
              required: ["id"],
            },
            context: { type: Type.OBJECT },
          },
          required: ["product"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },

  {
    name: "create_cart",
    description:
      "Create a new UCP cart with line items on a specific merchant.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING },
        arguments: {
          type: Type.OBJECT,
          properties: {
            cart: {
              type: Type.OBJECT,
              properties: {
                line_items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item: {
                        type: Type.OBJECT,
                        properties: { id: { type: Type.STRING } },
                        required: ["id"],
                      },
                      quantity: { type: Type.INTEGER },
                    },
                    required: ["item", "quantity"],
                  },
                },
                context: { type: Type.OBJECT },
              },
              required: ["line_items"],
            },
          },
          required: ["cart"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },

  {
    name: "update_cart",
    description:
      "Update an existing UCP cart (full replace of line_items).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING },
        arguments: {
          type: Type.OBJECT,
          properties: {
            cart: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                line_items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item: {
                        type: Type.OBJECT,
                        properties: { id: { type: Type.STRING } },
                        required: ["id"],
                      },
                      quantity: { type: Type.INTEGER },
                    },
                    required: ["item", "quantity"],
                  },
                },
                context: { type: Type.OBJECT },
                destination: { type: Type.OBJECT },
                fulfillment: { type: Type.OBJECT },
              },
              required: ["id", "line_items"],
            },
          },
          required: ["cart"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },

  {
    name: "create_checkout",
    description:
      "Create a checkout from a cart or directly from line items.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING },
        arguments: {
          type: Type.OBJECT,
          properties: {
            checkout: {
              type: Type.OBJECT,
              properties: {
                cart_id: { type: Type.STRING },
                line_items: {
                  type: Type.ARRAY,
                  items: { type: Type.OBJECT },
                },
                context: { type: Type.OBJECT },
              },
            },
          },
          required: ["checkout"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },

  {
    name: "update_checkout",
    description:
      "Update a checkout with shipping, billing, fulfillment, or payment selections.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING },
        arguments: {
          type: Type.OBJECT,
          properties: {
            checkout: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                line_items: {
                  type: Type.ARRAY,
                  items: { type: Type.OBJECT },
                },
                fulfillment: { type: Type.OBJECT },
                payment: { type: Type.OBJECT },
                context: { type: Type.OBJECT },
              },
              required: ["id"],
            },
          },
          required: ["checkout"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },

  {
    name: "complete_checkout",
    description:
      "Complete a checkout and place the order.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING },
        arguments: {
          type: Type.OBJECT,
          properties: {
            checkout: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                payment: { type: Type.OBJECT },
                signals: { type: Type.OBJECT },
              },
              required: ["id"],
            },
          },
          required: ["checkout"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },

  {
    name: "get_order",
    description:
      "Track an existing order by order ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING },
        arguments: {
          type: Type.OBJECT,
          properties: {
            order: {
              type: Type.OBJECT,
              properties: { id: { type: Type.STRING } },
              required: ["id"],
            },
          },
          required: ["order"],
        },
      },
      required: ["store_domain", "arguments"],
    },
  },
] as const;

export async function executeMcpCall(args: any) {
  const { tool, store_domain, arguments: ucpArguments = {} } = args;

  if (!tool) throw new Error("Missing UCP tool name");
  if (!store_domain) throw new Error("Missing store_domain for UCP call");

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
        ...ucpArguments,
      },
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-03-26",
  };

  const token =
    import.meta.env?.VITE_UCP_ACCESS_TOKEN ||
    (typeof process !== "undefined" ? process.env?.UCP_ACCESS_TOKEN : "") ||
    "";

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(dynamicMcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Shopify MCP Error (${res.status}): ${errorText}`);
  }

  return await res.json();
}