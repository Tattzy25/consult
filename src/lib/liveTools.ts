// lib/liveTools.ts

import { Tool, Type } from '@google/genai';

export const shoppingTools: Tool = {
  functionDeclarations: [
    {
      name: 'search_catalog',
      description: 'Search the merchant product catalog. Use immediately when buyer expresses shopping interest.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          catalog: {
            type: Type.OBJECT,
            description: 'The search parameters',
            properties: {
              query: { type: Type.STRING, description: 'Free-text search query (e.g., "running shoes", "gift for mom")' },
              context: {
                type: Type.OBJECT,
                description: 'Buyer context for localization and ranking',
                properties: {
                  address_country: { type: Type.STRING, description: 'ISO alpha-2 country code' },
                  currency: { type: Type.STRING, description: 'ISO 4217 currency code' },
                  intent: { type: Type.STRING, description: 'Free-text buyer intent or preferences' }
                }
              },
              pagination: {
                type: Type.OBJECT,
                properties: {
                  limit: { type: Type.INTEGER, description: 'Max results to return (default 10, max 250)' },
                  cursor: { type: Type.STRING, description: 'Opaque cursor from previous response for next page' }
                }
              }
            },
            required: ['query']
          }
        },
        required: ['catalog']
      }
    },
    {
      name: 'get_product',
      description: 'Get full product details, variant matrix, and real-time stock for a specific product.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          catalog: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: 'Product or Variant GID exactly as returned by search_catalog' },
              selected: {
                type: Type.ARRAY,
                description: 'Option selections to narrow to a specific variant',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    label: { type: Type.STRING }
                  }
                }
              }
            },
            required: ['id']
          }
        },
        required: ['catalog']
      }
    },
    {
      name: 'create_cart',
      description: 'Create a new shopping cart with line items.',
      parameters: {
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
                      properties: { id: { type: Type.STRING, description: 'Variant ID' } }
                    },
                    quantity: { type: Type.INTEGER }
                  },
                  required: ['item', 'quantity']
                }
              }
            },
            required: ['line_items']
          }
        },
        required: ['cart']
      }
    },
    {
      name: 'update_cart',
      description: 'Update an existing cart. Must pass the full line_items array (full-replace).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Cart ID' },
          cart: {
            type: Type.OBJECT,
            properties: {
              line_items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.OBJECT, properties: { id: { type: Type.STRING } } },
                    quantity: { type: Type.INTEGER }
                  }
                }
              }
            }
          }
        },
        required: ['id', 'cart']
      }
    },
    {
      name: 'create_checkout',
      description: 'Convert a cart to a checkout session, or start a direct buy-now checkout.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          cart_id: { type: Type.STRING, description: 'Existing cart ID to convert' },
          checkout: {
            type: Type.OBJECT,
            properties: {
              line_items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.OBJECT, properties: { id: { type: Type.STRING } } },
                    quantity: { type: Type.INTEGER }
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      name: 'update_checkout',
      description: 'Update checkout with shipping address, selected shipping method, or discount codes.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Checkout ID' },
          checkout: {
            type: Type.OBJECT,
            properties: {
              fulfillment: {
                type: Type.OBJECT,
                properties: {
                  selected_method_id: { type: Type.STRING, description: 'ID of the chosen shipping/pickup method' }
                }
              },
              discount_codes: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        },
        required: ['id', 'checkout']
      }
    },
    {
      name: 'complete_checkout',
      description: 'Finalize the checkout and place the order.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Checkout ID' }
        },
        required: ['id']
      }
    }
  ]
};

// Extract function declarations for Gemini Live API
export const LIVE_FUNCTION_DECLARATIONS = shoppingTools.functionDeclarations || [];

// UCP MCP Client - makes JSON-RPC calls to merchant's /api/ucp/mcp endpoint
async function callUCPTool(
  merchantDomain: string,
  toolName: string,
  args: any
): Promise<any> {
  if (!merchantDomain) {
    throw new Error('Missing merchant domain for UCP MCP call');
  }

  const endpoint = `https://${merchantDomain}/api/ucp/mcp`;
  
  const requestBody = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: {
        meta: {
          'ucp-agent': {
  profile: 'https://ucp-agent-profile.facetimefy.com'
}
        },
        ...args
      }
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`UCP MCP request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message || 'UCP MCP error');
  }

  // UCP MCP returns results in structuredContent for backward compatibility
  if (result.result?.structuredContent) {
    return result.result.structuredContent;
  }
  
  return result.result;
}

// Tool handlers - map function names to actual UCP MCP calls
export const LIVE_FUNCTION_HANDLERS: Record<string, (args: any, merchantDomain: string) => Promise<any>> = {
  search_catalog: async (args, merchantDomain) => {
    return callUCPTool(merchantDomain, 'search_catalog', args);
  },

  get_product: async (args, merchantDomain) => {
    return callUCPTool(merchantDomain, 'get_product', args);
  },

  create_cart: async (args, merchantDomain) => {
    return callUCPTool(merchantDomain, 'create_cart', args);
  },

  update_cart: async (args, merchantDomain) => {
    return callUCPTool(merchantDomain, 'update_cart', args);
  },

  create_checkout: async (args, merchantDomain) => {
    return callUCPTool(merchantDomain, 'create_checkout', args);
  },

  update_checkout: async (args, merchantDomain) => {
    return callUCPTool(merchantDomain, 'update_checkout', args);
  },

  complete_checkout: async (args, merchantDomain) => {
    return callUCPTool(merchantDomain, 'complete_checkout', args);
  }
};