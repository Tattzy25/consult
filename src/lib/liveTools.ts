// ---------------------------------------------------------------------------
// UCP agent profile + Gemini Live function declarations and MCP handlers
// Exact merge of the supplied UCP profile and supplied Gemini Live integration.
// ---------------------------------------------------------------------------

export const AGENT_PROFILE_URL = "https://ucp-agent-profile.facetimefy.com";

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
      "dev.ucp.shopping.checkout": [{
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/checkout",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/checkout.json",
      }],
      "dev.ucp.shopping.cart": [{
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/cart",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/cart.json",
      }],
      "dev.ucp.shopping.catalog.search": [{
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/catalog",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/catalog_search.json",
      }],
      "dev.ucp.shopping.catalog.lookup": [{
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/catalog",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/catalog_lookup.json",
      }],
      "dev.shopify.catalog": [{
        extends: [
          "dev.ucp.shopping.catalog.search",
          "dev.ucp.shopping.catalog.lookup",
        ],
        version: "2026-04-08",
        spec: "https://shopify.dev/docs/agents/catalog/storefront-catalog-extension",
        schema: "https://shopify.dev/ucp/schemas/2026-04-08/shopify_catalog.json",
        requires: { protocol: { min: "2026-04-08" } },
      }],
      "dev.ucp.shopping.order": [{
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/order",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/order.json",
      }],
      "dev.ucp.shopping.fulfillment": [{
        extends: "dev.ucp.shopping.checkout",
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/fulfillment",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/fulfillment.json",
        config: {
          allows_multi_destination: { shipping: false, pickup: false },
          allows_method_combinations: [["shipping"], ["pickup"]],
        },
      }],
      "dev.ucp.shopping.discount": [{
        extends: "dev.ucp.shopping.checkout",
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/discount",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/discount.json",
      }],
      "dev.ucp.shopping.buyer_consent": [{
        extends: "dev.ucp.shopping.checkout",
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/buyer-consent",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/buyer_consent.json",
      }],
      "dev.ucp.shopping.ap2_mandates": [{
        extends: "dev.ucp.shopping.checkout",
        version: "2026-04-08",
        spec: "https://ucp.dev/2026-04-08/specification/ap2-mandates",
        schema: "https://ucp.dev/2026-04-08/schemas/shopping/ap2_mandate.json",
      }],
    },
    payment_handlers: {
      "dev.shopify.shop_pay": [{
        id: "shop_pay",
        version: "2026-01-11",
        spec: "https://shopify.dev/docs/agents/checkout/shop-pay-handler",
        config_schema: "https://shopify.dev/ucp/shop-pay-handler/2026-01-11/config.json",
        instrument_schemas: [
          "https://shopify.dev/ucp/shop-pay-handler/2026-01-11/instrument.json",
        ],
      }],
      "com.google.pay": [{
        id: "gpay",
        version: "2026-01-11",
        spec: "https://pay.google.com/gp/p/ucp/2026-01-11/",
        config_schema: "https://pay.google.com/gp/p/ucp/2026-01-11/schemas/config.json",
        instrument_schemas: [
          "https://pay.google.com/gp/p/ucp/2026-01-11/schemas/card_payment_instrument.json",
        ],
      }],
    },
  },
  signing_keys: [{
    kty: "EC",
    x: "YvJFxrFpw3eilrAvZ6MqfCUQJ_kN9b4l-wPV4TqqI9M",
    y: "bN2uLb3FJSo7xdaNG6ESxxchOXd0WquDM5GD7CP13mw",
    crv: "P-256",
    kid: "agent-1786437504041",
    use: "sig",
    alg: "ES256",
  }],
} as const;

// ---------------------------------------------------------------------------
// Gemini Live declarations
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
    name: "lookup_catalog",
    description: "Lookup products or variants by identifier using the merchant catalog lookup flow.",
    parameters: {
      type: "OBJECT",
      properties: {
        catalog: {
          type: "OBJECT",
          description: "Catalog lookup payload matching the merchant UCP catalog lookup schema.",
        },
      },
      required: ["catalog"],
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
    name: "create_cart",
    description: "Create a new cart session for the buyer.",
    parameters: {
      type: "OBJECT",
      properties: {
        cart: {
          type: "OBJECT",
          description: "Cart payload matching the merchant UCP cart schema.",
        },
      },
      required: ["cart"],
    },
  },
  {
    name: "get_cart",
    description: "Get the current state of a cart by ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Cart ID returned by the merchant.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "update_cart",
    description: "Update an existing cart by ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Cart ID returned by the merchant.",
        },
        cart: {
          type: "OBJECT",
          description: "Cart payload matching the merchant UCP cart schema.",
        },
      },
      required: ["id", "cart"],
    },
  },
  {
    name: "cancel_cart",
    description: "Cancel an existing cart by ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Cart ID returned by the merchant.",
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
  {
    name: "get_checkout",
    description: "Get the current state of a checkout by ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Checkout ID returned by the merchant.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "update_checkout",
    description: "Update an existing checkout by ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Checkout ID returned by the merchant.",
        },
        checkout: {
          type: "OBJECT",
          description: "Checkout payload matching the merchant UCP checkout schema.",
        },
      },
      required: ["id", "checkout"],
    },
  },
  {
    name: "complete_checkout",
    description: "Complete an existing checkout and place the order.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Checkout ID returned by the merchant.",
        },
        checkout: {
          type: "OBJECT",
          description: "Final checkout payload matching the merchant UCP checkout schema.",
        },
      },
      required: ["id", "checkout"],
    },
  },
  {
    name: "cancel_checkout",
    description: "Cancel an existing checkout by ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Checkout ID returned by the merchant.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_order",
    description: "Get the current state of an order by ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Order ID returned by the merchant.",
        },
      },
      required: ["id"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// UCP MCP handlers
// ---------------------------------------------------------------------------

async function resolveMerchantMcpEndpoint(merchantDomain: string) {
  if (!merchantDomain) {
    throw new Error("Missing merchant domain for UCP MCP call.");
  }

  const response = await fetch(`https://${merchantDomain}/.well-known/ucp`);
  if (!response.ok) {
    throw new Error(`Failed to load merchant UCP profile (${response.status}).`);
  }

  const profile = await response.json();
  const shoppingServices = profile?.ucp?.services?.["dev.ucp.shopping"];
  if (!Array.isArray(shoppingServices)) {
    throw new Error("Merchant UCP profile is missing dev.ucp.shopping services.");
  }

  const mcpService = shoppingServices.find(
    (service: any) => service?.transport === "mcp" && typeof service?.endpoint === "string",
  );
  if (!mcpService?.endpoint) {
    throw new Error("Merchant UCP profile is missing a dev.ucp.shopping MCP endpoint.");
  }

  return mcpService.endpoint;
}

function buildMcpMeta(tool: string) {
  const meta: Record<string, any> = {
    "ucp-agent": { profile: AGENT_PROFILE_URL },
  };

  if (["complete_checkout", "cancel_checkout", "cancel_cart"].includes(tool)) {
    meta["idempotency-key"] = crypto.randomUUID();
  }

  return meta;
}

async function mcpCall(merchantDomain: string, tool: string, args: any) {
  const endpoint = await resolveMerchantMcpEndpoint(merchantDomain);

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "UCP-Agent": `profile="${AGENT_PROFILE_URL}"`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: tool,
        arguments: {
          meta: buildMcpMeta(tool),
          ...args,
        },
      },
      id: Date.now(),
    }),
  }).then(async (response) => {
    const json = await response.json();

    if (json?.error) {
      throw new Error(json.error.message || `UCP method ${tool} failed.`);
    }

    const result = json?.result?.structuredContent ?? json?.result;
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return result;
    }

    if ("response" in result) return result.response;
    if ("checkout" in result) return result.checkout;
    if ("cart" in result) return result.cart;
    if ("order" in result) return result.order;

    return result;
  });
}

export const LIVE_FUNCTION_HANDLERS = {
  search_catalog: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "search_catalog", { catalog: args }),

  lookup_catalog: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "lookup_catalog", { catalog: args.catalog }),

  get_product: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "get_product", { catalog: args }),

  create_cart: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "create_cart", { cart: args.cart }),

  get_cart: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "get_cart", { id: args.id }),

  update_cart: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "update_cart", { id: args.id, cart: args.cart }),

  cancel_cart: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "cancel_cart", { id: args.id }),

  create_checkout: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "create_checkout", { checkout: args }),

  get_checkout: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "get_checkout", { id: args.id }),

  update_checkout: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "update_checkout", { id: args.id, checkout: args.checkout }),

  complete_checkout: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "complete_checkout", { id: args.id, checkout: args.checkout }),

  cancel_checkout: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "cancel_checkout", { id: args.id }),

  get_order: (args: any, merchantDomain: string) =>
    mcpCall(merchantDomain, "get_order", { id: args.id }),
};