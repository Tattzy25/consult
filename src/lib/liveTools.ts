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