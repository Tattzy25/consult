// lib/agentStageEvents.ts

export interface UIEvent {
  tag: string;
  [key: string]: any;
}

/**
 * Formats a UI event from the Liquid widget into a strict JSON string.
 * Gemini is instructed via system prompt to parse this and execute the 
 * corresponding UCP tool call immediately.
 */
export function formatUIEvent(event: UIEvent): string {
  return JSON.stringify({
    source: 'ui_event',
    ...event
  });
}

// Legacy helpers kept for payload parsing in app.tsx
export function getProductsFromPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.response?.products)) return payload.response.products;
  if (payload?.product) return [payload.product];
  if (payload?.response?.product) return [payload.response.product];
  if (payload?.id && (payload?.title || payload?.variants)) return [payload];
  return [];
}

export function getPrimaryVariant(product: any) {
  if (!product) return null;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants[0];
  }
  return null;
}

export function buildAgentIntent(action: string, product: any): string {
  const productTitle = product?.title || 'the product';
  return `The user wants to ${action} ${productTitle}. Please handle this request.`;
}