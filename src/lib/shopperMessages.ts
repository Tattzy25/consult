/**
 * Shopper-Facing Messages
 * 
 * Messages come from the merchant's D1 database via sales.facetimefy.com
 * No hardcoded messages - everything is dynamic.
 */

export interface ShopperMessages {
  geminiKeyMissing: string;
  geminiKeyInvalidOrRevoked: string;
  geminiUsageLimitReached: string;
  connectionUnavailable: string;
}

export const DEFAULT_SHOPPER_MESSAGES: ShopperMessages = {
  geminiKeyMissing: "",
  geminiKeyInvalidOrRevoked: "",
  geminiUsageLimitReached: "",
  connectionUnavailable: "",
};

export type ErrorCode = keyof ShopperMessages;

/**
 * Fetches merchant-customized messages from D1 via sales.facetimefy.com
 */
export async function fetchShopperMessages(storeDomain?: string): Promise<ShopperMessages> {
  if (!storeDomain) return DEFAULT_SHOPPER_MESSAGES;

  const res = await fetch(`https://sales.facetimefy.com/api/messages?store=${encodeURIComponent(storeDomain)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) return DEFAULT_SHOPPER_MESSAGES;

  const data = await res.json();
  return {
    ...DEFAULT_SHOPPER_MESSAGES,
    ...data.messages,
  };
}

/**
 * Maps error types to shopper message keys
 * Returns the message from the database, or empty string if not set.
 */
export function getShopperMessageForError(error: unknown, messages: ShopperMessages): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('api key') && (lowerMessage.includes('missing') || lowerMessage.includes('not found'))) {
    return messages.geminiKeyMissing;
  }

  if (lowerMessage.includes('api key') && (lowerMessage.includes('invalid') || lowerMessage.includes('revoked') || lowerMessage.includes('unauthorized'))) {
    return messages.geminiKeyInvalidOrRevoked;
  }

  if (lowerMessage.includes('quota') || lowerMessage.includes('rate limit') || lowerMessage.includes('usage limit') || lowerMessage.includes('429') || lowerMessage.includes('context window') || lowerMessage.includes('token limit')) {
    return messages.geminiUsageLimitReached;
  }

  return messages.connectionUnavailable;
}

export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}