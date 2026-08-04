/**
 * Intent API - Captures user interactions and sends them to Gemini as intents
 * 
 * This allows users to click on products, filters, etc. and have the agent
 * execute the appropriate UCP operations (add to cart, filter, etc.)
 * without the user needing to know the agent is controlling it.
 */

export type IntentType = 
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_product_details'
  | 'filter_products'
  | 'sort_products'
  | 'select_variant'
  | 'checkout'
  | 'search'
  | 'custom';

export interface Intent {
  type: IntentType;
  productId?: string;
  variantId?: string;
  storeDomain?: string;
  data?: Record<string, any>;
  timestamp: number;
}

export interface IntentHandler {
  sendIntent: (intent: Intent) => void;
}

/**
 * Creates an intent handler that sends intents to Gemini via sendText
 */
export function createIntentHandler(sendText: (text: string) => void): IntentHandler {
  return {
    sendIntent: (intent: Intent) => {
      const intentText = formatIntentForGemini(intent);
      sendText(intentText);
    },
  };
}

/**
 * Formats an intent as a natural language message for Gemini
 */
function formatIntentForGemini(intent: Intent): string {
  const { type, productId, variantId, storeDomain, data } = intent;

  switch (type) {
    case 'add_to_cart':
      if (variantId && storeDomain) {
        return `[USER INTENT] Add product variant ${variantId} from ${storeDomain} to cart`;
      }
      if (productId && storeDomain) {
        return `[USER INTENT] Add product ${productId} from ${storeDomain} to cart`;
      }
      return `[USER INTENT] Add item to cart`;

    case 'remove_from_cart':
      if (variantId && storeDomain) {
        return `[USER INTENT] Remove product variant ${variantId} from ${storeDomain} from cart`;
      }
      return `[USER INTENT] Remove item from cart`;

    case 'view_product_details':
      if (productId && storeDomain) {
        return `[USER INTENT] View details for product ${productId} from ${storeDomain}`;
      }
      return `[USER INTENT] View product details`;

    case 'filter_products':
      if (data) {
        return `[USER INTENT] Filter products with: ${JSON.stringify(data)}`;
      }
      return `[USER INTENT] Apply product filter`;

    case 'sort_products':
      if (data?.sortBy) {
        return `[USER INTENT] Sort products by ${data.sortBy}`;
      }
      return `[USER INTENT] Sort products`;

    case 'select_variant':
      if (variantId && productId) {
        return `[USER INTENT] Select variant ${variantId} for product ${productId}`;
      }
      return `[USER INTENT] Select product variant`;

    case 'checkout':
      if (storeDomain) {
        return `[USER INTENT] Proceed to checkout for ${storeDomain}`;
      }
      return `[USER INTENT] Proceed to checkout`;

    case 'search':
      if (data?.query) {
        return `[USER INTENT] Search for: ${data.query}`;
      }
      return `[USER INTENT] Search products`;

    case 'custom':
      if (data?.message) {
        return `[USER INTENT] ${data.message}`;
      }
      return `[USER INTENT] Custom action`;

    default:
      return `[USER INTENT] Unknown intent type: ${type}`;
  }
}

/**
 * Helper to create specific intents
 */
export const intents = {
  addToCart: (variantId: string, storeDomain: string): Intent => ({
    type: 'add_to_cart',
    variantId,
    storeDomain,
    timestamp: Date.now(),
  }),

  removeFromCart: (variantId: string, storeDomain: string): Intent => ({
    type: 'remove_from_cart',
    variantId,
    storeDomain,
    timestamp: Date.now(),
  }),

  viewProductDetails: (productId: string, storeDomain: string): Intent => ({
    type: 'view_product_details',
    productId,
    storeDomain,
    timestamp: Date.now(),
  }),

  filterProducts: (filters: Record<string, any>): Intent => ({
    type: 'filter_products',
    data: filters,
    timestamp: Date.now(),
  }),

  sortProducts: (sortBy: string): Intent => ({
    type: 'sort_products',
    data: { sortBy },
    timestamp: Date.now(),
  }),

  selectVariant: (productId: string, variantId: string): Intent => ({
    type: 'select_variant',
    productId,
    variantId,
    timestamp: Date.now(),
  }),

  checkout: (storeDomain: string): Intent => ({
    type: 'checkout',
    storeDomain,
    timestamp: Date.now(),
  }),

  search: (query: string): Intent => ({
    type: 'search',
    data: { query },
    timestamp: Date.now(),
  }),

  custom: (message: string): Intent => ({
    type: 'custom',
    data: { message },
    timestamp: Date.now(),
  }),
};