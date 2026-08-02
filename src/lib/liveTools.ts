import { Type } from "@google/genai";

export const UCP_AGENT_PROFILE_URL =
  "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

export const LIVE_FUNCTION_DECLARATIONS = [
  {
    name: "search_catalog",
    description:
      "Search the global UCP catalog across all merchants. Returns products, prices, images, and checkout URLs. Use for broad product discovery. If store_domain is provided, scope search to that merchant only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: {
          type: Type.STRING,
          description: "Optional: scope search to this Shopify store domain, e.g. 'tattty.myshopify.com'. Omit for global search across all merchants.",
        },
        query: {
          type: Type.STRING,
          description: "The search query, e.g. 'marathon training shoes'.",
        },
        filters: {
          type: Type.OBJECT,
          description: "Hard exclusions like price ranges, availability, shipping constraints.",
          properties: {
            price: {
              type: Type.OBJECT,
              properties: {
                max: { type: Type.INTEGER, description: "Max price in minor currency units (e.g. 15000 = $150.00)" },
                min: { type: Type.INTEGER, description: "Min price in minor currency units" },
              },
            },
            available: { type: Type.BOOLEAN, description: "Only return available products" },
            ships_to: {
              type: Type.OBJECT,
              properties: {
                country: { type: Type.STRING, description: "Country code, e.g. 'US'" },
              },
            },
          },
        },
        context: {
          type: Type.OBJECT,
          description: "Soft signals for ranking and localization.",
          properties: {
            intent: { type: Type.STRING, description: "Free-text background, e.g. 'looking for a gift under $50'" },
            address_country: { type: Type.STRING, description: "Country code, e.g. 'US'" },
            currency: { type: Type.STRING, description: "Currency code, e.g. 'USD'" },
            language: { type: Type.STRING, description: "Language code, e.g. 'en-US'" },
          },
        },
        pagination: {
          type: Type.OBJECT,
          properties: {
            limit: { type: Type.INTEGER, description: "Max number of results to return" },
          },
        },
      },
      required: ["query"],
    },
  },

  {
    name: "get_product",
    description:
      "Get full variant matrix and availability for a specific UCP product ID. Use when buyer narrows to a specific product.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: {
          type: Type.STRING,
          description: "The Shopify store domain from the product's seller.",
        },
        product_id: {
          type: Type.STRING,
          description: "The product ID from a previous search result.",
        },
      },
      required: ["product_id"],
    },
  },

  {
    name: "create_cart",
    description:
      "Create a new UCP cart with line items on a specific merchant. Use for basket assembly.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING, description: "The Shopify store domain (seller.domain from search results)." },
        line_items: {
          type: Type.ARRAY,
          description: "Array of line items to add to cart.",
          items: {
            type: Type.OBJECT,
            properties: {
              item: {
                type: Type.OBJECT,
                properties: { id: { type: Type.STRING, description: "Variant ID from search results" } },
                required: ["id"],
              },
              quantity: { type: Type.INTEGER, description: "Quantity to add" },
            },
            required: ["item", "quantity"],
          },
        },
        context: {
          type: Type.OBJECT,
          description: "Localization signals like country, currency, language.",
          properties: {
            address_country: { type: Type.STRING },
            currency: { type: Type.STRING },
            language: { type: Type.STRING },
          },
        },
      },
      required: ["line_items"],
    },
  },

  {
    name: "update_cart",
    description:
      "Update an existing UCP cart. NOTE: This is a FULL REPLACE of line_items - always include all items.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING, description: "The Shopify store domain." },
        cart_id: { type: Type.STRING, description: "The cart ID to update." },
        line_items: {
          type: Type.ARRAY,
          description: "Complete array of line items (full replace).",
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
      },
      required: ["cart_id", "line_items"],
    },
  },

  {
    name: "create_checkout",
    description:
      "Create a checkout from a cart. Use for high-intent purchase flow.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING, description: "The Shopify store domain." },
        cart_id: { type: Type.STRING, description: "The cart ID to convert to checkout." },
      },
      required: ["cart_id"],
    },
  },

  {
    name: "update_checkout",
    description:
      "Update a checkout with shipping, billing, fulfillment, or payment selections.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING, description: "The Shopify store domain." },
        checkout_id: { type: Type.STRING, description: "The checkout ID to update." },
        destination: {
          type: Type.OBJECT,
          description: "Shipping address or pickup location.",
          properties: {
            address: {
              type: Type.OBJECT,
              properties: {
                address1: { type: Type.STRING },
                city: { type: Type.STRING },
                province: { type: Type.STRING },
                country: { type: Type.STRING },
                zip: { type: Type.STRING },
              },
            },
          },
        },
        fulfillment: {
          type: Type.OBJECT,
          description: "Selected fulfill method.",
          properties: {
            selected_option_id: { type: Type.STRING },
          },
        },
        payment: {
          type: Type.OBJECT,
          description: "Payment method selection.",
          properties: {
            selected_option_id: { type: Type.STRING },
          },
        },
      },
      required: ["checkout_id"],
    },
  },

  {
    name: "complete_checkout",
    description:
      "Complete a checkout and place the order. Returns order status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING, description: "The Shopify store domain." },
        checkout_id: { type: Type.STRING, description: "The checkout ID to complete." },
      },
      required: ["checkout_id"],
    },
  },

  {
    name: "get_order",
    description:
      "Track an existing order by order ID. Read-only post-purchase status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING, description: "The Shopify store domain." },
        order_id: { type: Type.STRING, description: "The order ID to track." },
      },
      required: ["order_id"],
    },
  },

  {
    name: "discover_merchant",
    description:
      "Check if a merchant supports UCP. Use when buyer names a specific merchant.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        store_domain: { type: Type.STRING, description: "The merchant domain to check, e.g. 'rei.com'." },
      },
      required: ["store_domain"],
    },
  },
] as const;

export async function executeMcpCall(args: {
  tool: string;
  store_domain?: string;
  arguments: Record<string, any>;
}) {
  const { tool, store_domain, arguments: ucpArguments = {} } = args;

  if (!tool) throw new Error("Missing UCP tool name");

  // Global search doesn't require a store domain
  const isGlobalSearch = tool === 'search_catalog' && !store_domain;
  
  if (!store_domain && !isGlobalSearch) {
    throw new Error(`store_domain is required for ${tool}`);
  }

  // For global search, use the UCP global endpoint
  // For merchant-scoped operations, use the merchant's MCP endpoint
  const mcpUrl = isGlobalSearch 
    ? 'https://ucp.dev/api/mcp' // Global UCP endpoint
    : `https://${store_domain}/api/ucp/mcp`;

  let ucpPayload: any;

  switch (tool) {
    case "search_catalog":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "search_catalog",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            catalog: {
              query: ucpArguments.query,
              context: ucpArguments.context,
              filters: ucpArguments.filters,
              pagination: ucpArguments.pagination,
            },
          },
        },
      };
      break;

    case "get_product":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "get_product",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            product: { id: ucpArguments.product_id },
          },
        },
      };
      break;

    case "create_cart":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "create_cart",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            cart: {
              line_items: ucpArguments.line_items,
              context: ucpArguments.context,
            },
          },
        },
      };
      break;

    case "update_cart":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "update_cart",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            cart: {
              id: ucpArguments.cart_id,
              line_items: ucpArguments.line_items,
            },
          },
        },
      };
      break;

    case "create_checkout":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "create_checkout",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            checkout: {
              cart_id: ucpArguments.cart_id,
            },
          },
        },
      };
      break;

    case "update_checkout":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "update_checkout",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            checkout: {
              id: ucpArguments.checkout_id,
              destination: ucpArguments.destination,
              fulfillment: ucpArguments.fulfillment,
              payment: ucpArguments.payment,
            },
          },
        },
      };
      break;

    case "complete_checkout":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "complete_checkout",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            checkout: {
              id: ucpArguments.checkout_id,
            },
          },
        },
      };
      break;

    case "get_order":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "get_order",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
            order: { id: ucpArguments.order_id },
          },
        },
      };
      break;

    case "discover_merchant":
      ucpPayload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: "discover",
          arguments: {
            meta: {
              "ucp-agent": { profile: UCP_AGENT_PROFILE_URL },
            },
          },
        },
      };
      break;

    default:
      throw new Error(`Unknown UCP tool: ${tool}`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-03-26",
  };

  const token =
    import.meta.env?.VITE_UCP_ACCESS_TOKEN ||
    (typeof process !== "undefined" ? process.env?.UCP_ACCESS_TOKEN : "") ||
    "";

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(ucpPayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Shopify MCP Error (${res.status}): ${errorText}`);
  }

  return await res.json();
}