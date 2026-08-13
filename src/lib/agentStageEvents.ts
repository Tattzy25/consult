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

function detectEntityType(item: any) {
  if (Array.isArray(item?.variants)) return 'product';
  if (Array.isArray(item?.line_items)) return 'checkout';
  if (item?.status && Array.isArray(item?.totals)) return 'commerce_state';
  if (item?.id) return 'entity';
  return 'unknown';
}

function buildEntitySnapshot(item: any) {
  const variant = getPrimaryVariant(item);

  return {
    id: item?.id ?? null,
    title: item?.title ?? item?.name ?? null,
    variant_id: variant?.id ?? item?.variant_id ?? null,
    seller_domain: variant?.seller?.domain ?? item?.seller?.domain ?? null,
    status: item?.status ?? null,
    price_amount: variant?.price_range?.min?.amount ?? item?.price_range?.min?.amount ?? null,
    price_currency: variant?.price_range?.min?.currency ?? item?.price_range?.min?.currency ?? item?.currency ?? null,
  };
}

export function buildAgentIntent(action: string, item: any) {
  const event = {
    type: 'ui_event',
    source: 'live_storefront_stage',
    action,
    entity_type: detectEntityType(item),
    entity: buildEntitySnapshot(item),
    instruction:
      'Treat this as buyer intent from the rendered storefront UI. Use merchant tools only. Base the next action on current session state and tool data.',
  };

  return JSON.stringify(event);
}