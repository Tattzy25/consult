// ---------------------------------------------------------------------------
// UCP agent profile + Gemini Live function declarations and MCP handlers
// ---------------------------------------------------------------------------

export const AGENT_PROFILE_URL = "https://ucp-agent-profile.tattty.dev";

export const UCP_AGENT_PROFILE = {
  ucp: {
    version: "2026-04-08",
    services: {
      "dev.ucp.shopping": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/overview",
          transport: "mcp",
          schema: "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json",
        },
      ],
    },
    capabilities: {
      "dev.ucp.shopping.checkout": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/checkout",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/checkout.json",
        },
      ],
      "dev.ucp.shopping.cart": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/cart",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/cart.json",
        },
      ],
      "dev.ucp.shopping.catalog.search": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/catalog",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/catalog_search.json",
        },
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/catalog",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/catalog_lookup.json",
        },
      ],
      "dev.shopify.catalog": [
        {
          extends: [
            "dev.ucp.shopping.catalog.search",
            "dev.ucp.shopping.catalog.lookup",
          ],
          version: "2026-04-08",
          spec: "https://shopify.dev/docs/agents/catalog/storefront-catalog-extension",
          schema: "https://shopify.dev/ucp/schemas/2026-04-08/shopify_catalog.json",
          requires: { protocol: { min: "2026-04-08" } },
        },
      ],
      "dev.ucp.shopping.order": [
        {
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/order",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/order.json",
        },
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          extends: "dev.ucp.shopping.checkout",
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/fulfillment",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/fulfillment.json",
          config: {
            allows_multi_destination: {
              shipping: false,
              pickup: false,
            },
            allows_method_combinations: [["shipping"], ["pickup"]],
          },
        },
      ],
      "dev.ucp.shopping.discount": [
        {
          extends: "dev.ucp.shopping.checkout",
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/discount",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/discount.json",
        },
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          extends: "dev.ucp.shopping.checkout",
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/buyer-consent",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/buyer_consent.json",
        },
      ],
      "dev.ucp.shopping.ap2_mandates": [
        {
          extends: "dev.ucp.shopping.checkout",
          version: "2026-04-08",
          spec: "https://ucp.dev/2026-04-08/specification/ap2-mandates",
          schema: "https://ucp.dev/2026-04-08/schemas/shopping/ap2_mandate.json",
        },
      ],
    },
    payment_handlers: {
      "dev.shopify.shop_pay": [
        {
          id: "shop_pay",
          version: "2026-01-11",
          spec: "https://shopify.dev/docs/agents/checkout/shop-pay-handler",
          config_schema: "https://shopify.dev/ucp/shop-pay-handler/2026-01-11/config.json",
          instrument_schemas: [
            "https://shopify.dev/ucp/shop-pay-handler/2026-01-11/instrument.json",
          ],
        },
      ],
      "com.google.pay": [
        {
          id: "gpay",
          version: "2026-01-11",
          spec: "https://pay.google.com/gp/p/ucp/2026-01-11/",
          config_schema: "https://pay.google.com/gp/p/ucp/2026-01-11/schemas/config.json",
          instrument_schemas: [
            "https://pay.google.com/gp/p/ucp/2026-01-11/schemas/card_payment_instrument.json",
          ],
        },
      ],
    },
  },
  signing_keys: [
    {
      kty: "EC",
      x: "YvJFxrFpw3eilrAvZ6MqfCUQJ_kN9b4l-wPV4TqqI9M",
      y: "bN2uLb3FJSo7xdaNG6ESxxchOXd0WquDM5GD7CP13mw",
      crv: "P-256",
      kid: "agent-1786437504041",
      use: "sig",
      alg: "ES256",
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Gemini Live declarations for the UCP operations implemented by this agent
// ---------------------------------------------------------------------------

export const LIVE_FUNCTION_DECLARATIONS = [
  {
    name: "search_catalog",
    description: "Search the store's product catalog using natural language.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Free-text search query (e.g., 'wool runners').",
        },
        context: {
          type: "OBJECT",
          description: "Buyer signals for relevance and localization.",
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
              description: "Buyer preferences or intent clues.",
            },
          },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product",
    description: "Get full product details, variants, pricing, and stock.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Product or variant GID (e.g., gid://shopify/Product/123).",
        },
        selected: {
          type: "ARRAY",
          description: "Selected options to narrow variants.",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "Option name (e.g., 'Color')." },
              label: { type: "STRING", description: "Option value (e.g., 'Blue')." },
            },
            required: ["name", "label"],
          },
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_checkout",
    description: "Create a checkout session for the buyer.",
    parameters: {
      type: "OBJECT",
      properties: {
        line_items: {
          type: "ARRAY",
          description: "Items to add to checkout.",
          items: {
            type: "OBJECT",
            properties: {
              variant_id: {
                type: "STRING",
                description: "Global variant ID.",
              },
              quantity: {
                type: "INTEGER",
                description: "Quantity.",
              },
            },
            required: ["variant_id", "quantity"],
          },
        },
        email: {
          type: "STRING",
          description: "Buyer email for order confirmation.",
        },
      },
      required: ["line_items"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// UCP MCP handlers
// ---------------------------------------------------------------------------

type McpToolName = "search_catalog" | "get_product" | "create_checkout";

/**
 * Resolve the merchant's UCP MCP endpoint dynamically. Nothing is hardcoded:
 * each merchant that installs the app is identified at runtime by its domain
 * (resolved from the Shopify `?shop=` param in the browser). A build-time
 * override (VITE_MCP_ENDPOINT_URL) is honored for local testing.
 */
function resolveMcpEndpoint(merchantDomain: string): string {
  const configured =
    (import.meta as any)?.env?.VITE_MCP_ENDPOINT_URL || "";
  if (configured) return configured;
  if (merchantDomain) {
    const host = merchantDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}/api/ucp/mcp`;
  }
  return "";
}

async function mcpCall(
  merchantDomain: string,
  tool: McpToolName,
  args: Record<string, unknown>,
) {
  const endpoint = resolveMcpEndpoint(merchantDomain);
  if (!endpoint) {
    return {
      error: "no_merchant",
      content:
        "No merchant storefront is connected to this session yet, so the catalog can't be reached.",
    };
  }

  // Go through the same-origin /api/ucp proxy (server.js). The proxy forwards
  // to the resolved merchant endpoint, handles CORS, and injects UI metadata.
  const response = await fetch("/api/ucp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "UCP-Agent": `profile="${AGENT_PROFILE_URL}"`,
      "ucp-target-url": endpoint,
      "MCP-Protocol-Version": "2026-03-26",
    },
    body: JSON.stringify({
      _proxyUrl: endpoint,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: tool,
        arguments: {
          meta: {
            "ucp-agent": { profile: AGENT_PROFILE_URL },
          },
          ...args,
        },
      },
      id: crypto.randomUUID(),
    }),
  });

  const payload = await response.json();
  if (payload?.error) {
    return {
      error: payload.error.data?.code || "mcp_error",
      content:
        payload.error.data?.content ||
        payload.error.message ||
        "The merchant storefront could not be reached.",
      continue_url: payload.error.data?.continue_url,
    };
  }
  return payload.result?.structuredContent ?? payload.result ?? payload;
}

export const LIVE_FUNCTION_HANDLERS = {
  search_catalog: (args: Record<string, unknown>, merchantDomain: string) =>
    mcpCall(merchantDomain, "search_catalog", { catalog: args }),

  get_product: (args: Record<string, unknown>, merchantDomain: string) =>
    mcpCall(merchantDomain, "get_product", { catalog: args }),

  create_checkout: (args: Record<string, unknown>, merchantDomain: string) =>
    mcpCall(merchantDomain, "create_checkout", { checkout: args }),
};
