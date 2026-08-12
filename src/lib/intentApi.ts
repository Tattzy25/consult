// ---------------------------------------------------------------------------
// Intent API
// ---------------------------------------------------------------------------
// Bridges UI product interactions (clicks from the MCP App iframe / product
// cards) into natural-language intents that are sent to the Gemini Live agent
// via the session's text channel. The agent then invokes the appropriate UCP
// MCP tools (search_catalog / get_product / create_checkout).
// ---------------------------------------------------------------------------

export type Intent = {
  /** Stable identifier for the kind of intent. */
  type: string;
  /** Human/agent readable instruction sent to the model. */
  prompt: string;
  /** Structured payload for debugging / future use. */
  payload: Record<string, unknown>;
};

export const intents = {
  viewProductDetails(productId: string, storeDomain: string): Intent {
    return {
      type: "view_product_details",
      prompt: `The user tapped a product. Please fetch and describe the details for product "${productId}" from the store "${storeDomain}". Use the get_product tool and summarize variants, pricing, and availability.`,
      payload: { productId, storeDomain },
    };
  },

  addToCart(variantId: string, storeDomain: string): Intent {
    return {
      type: "add_to_cart",
      prompt: `The user wants to add variant "${variantId}" from the store "${storeDomain}" to their cart. Please start a checkout for this item using the create_checkout tool and confirm with the user.`,
      payload: { variantId, storeDomain },
    };
  },
} as const;

export type IntentHandler = {
  sendIntent: (intent: Intent) => void;
};

/**
 * Creates an intent handler bound to the Gemini Live `sendText` function.
 */
export function createIntentHandler(
  sendText: (text: string) => void,
): IntentHandler {
  return {
    sendIntent(intent: Intent) {
      console.log("[v0] sendIntent:", intent.type, intent.payload);
      sendText(intent.prompt);
    },
  };
}
