import React, { useState } from "react";

// ===========================================================================
// UCP & Shopify TypeScript Type Declarations for Catalog Payload Mapping
// ===========================================================================

export interface UcpMoney {
  amount: number; // In minor units (cents), e.g., 1899 for $18.99
  currency: string;
}

export interface UcpMedia {
  type: "image" | "video";
  url: string;
  alt_text?: string;
}

export interface UcpOptionValue {
  label: string;
  available?: boolean;
  exists?: boolean;
}

export interface UcpOption {
  name: string;
  values: UcpOptionValue[];
}

export interface UcpVariant {
  id: string;
  sku?: string;
  title: string;
  description?: { plain?: string };
  price: UcpMoney;
  availability: { available: boolean };
  options: { name: string; label: string }[];
  tags?: string[];
}

export interface UcpProduct {
  id: string;
  handle: string;
  title: string;
  description: { html?: string; plain?: string };
  url: string;
  price_range: { min: UcpMoney; max: UcpMoney };
  media: UcpMedia[];
  options?: UcpOption[];
  variants?: UcpVariant[];
  rating?: { value: number; scale_max: number; count: number };
  metadata?: Record<string, any>;
}

export interface UcpCheckoutSession {
  id: string;
  status: "incomplete" | "requires_escalation" | "ready_for_complete" | "complete" | "error";
  continue_url?: string;
  messages?: { type: "error" | "info"; code: string; content: string; severity?: string }[];
}

interface ProductCatalogViewProps {
  /**
   * The raw UCP payload returned dynamically from the Storefront or Catalog MCP server tools.
   */
  payload: {
    products?: UcpProduct[];
    product?: UcpProduct;
    continue_url?: string;
    id?: string;
    status?: string;
    messages?: any[];
  } | null;
  /**
   * Domain of the active merchant store (used for helper links/permalinks)
   */
  merchantDomain: string;
  /**
   * Handler to return to the live WebRTC/P2P call view
   */
  onClose: () => void;
  /**
   * Callback to trigger standard text-based conversational actions back to Gemini
   * (e.g. telling Gemini to "Create a checkout for variants X and Y")
   */
  onSendFeedback?: (text: string) => void;
}

// Helper to format money from minor units (cents)
const formatPrice = (money?: UcpMoney): string => {
  if (!money) return "$0.00";
  const formatted = (money.amount / 100).toLocaleString(undefined, {
    style: "currency",
    currency: money.currency,
  });
  return formatted;
};

export function ProductCatalogView({
  payload,
  merchantDomain,
  onClose,
  onSendFeedback,
}: ProductCatalogViewProps) {
  const [selectedProduct, setSelectedProduct] = useState<UcpProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  if (!payload) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-neutral-500">
        <p className="text-sm">No products or showcase actions active currently.</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 text-xs bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors text-black font-medium"
        >
          Return to Call
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Case A: Payload is a Direct Checkout Handoff (or Escalation)
  // -------------------------------------------------------------------------
  const isCheckout = payload.continue_url || (payload.id && payload.status);
  if (isCheckout) {
    const checkoutSession = payload as UcpCheckoutSession;
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm animate-fade-in text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-8 h-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Checkout Session Prepared</h2>
        <p className="text-neutral-500 text-sm mb-6 max-w-sm mx-auto">
          Your transaction session is staged with the merchant on{" "}
          <span className="font-semibold text-neutral-800">{merchantDomain}</span>. Payment execution requires direct buyer authentication.
        </p>

        {checkoutSession.messages && checkoutSession.messages.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 rounded-2xl text-left border border-amber-100">
            {checkoutSession.messages.map((msg, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-amber-600 mt-0.5 font-bold text-sm">⚠</span>
                <div>
                  <p className="text-xs font-semibold text-amber-900 capitalize">
                    {msg.code.replace("_", " ")}
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {checkoutSession.continue_url && (
            <a
              href={checkoutSession.continue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-black hover:bg-neutral-900 text-white rounded-full font-semibold transition-all shadow-md active:scale-[0.98]"
            >
              Continue to Secure Checkout
            </a>
          )}
          <button
            onClick={onClose}
            className="block w-full py-3 hover:bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-full font-medium text-sm transition-all"
          >
            Return to Video Call
          </button>
        </div>
      </div>
    );
  }

  // Extract products if B: Catalog Search, or C: Single Product Detail
  const displayProduct = selectedProduct || payload.product || null;
  const productsList = payload.products || [];

  // -------------------------------------------------------------------------
  // Case B: Rendering Single Product Detail View (Deeper Engagement)
  // -------------------------------------------------------------------------
  if (displayProduct) {
    const product = displayProduct;
    const isSingleProductMode = !!payload.product;

    const currentMedia = product.media && product.media[0] ? product.media[0] : null;

    // Handle Option Click
    const handleSelectOption = (optionName: string, valueLabel: string) => {
      setSelectedOptions((prev) => ({
        ...prev,
        [optionName]: valueLabel,
      }));
    };

    // Resolve active Variant matching current selectedOptions config
    const matchedVariant = product.variants?.find((variant) => {
      return variant.options.every(
        (opt) => selectedOptions[opt.name] === opt.label
      );
    });

    const isAddToCartEnabled =
      product.options && product.options.length > 0
        ? Object.keys(selectedOptions).length === product.options.length &&
          matchedVariant?.availability.available
        : product.variants?.[0]?.availability.available;

    const handleActionCheckout = () => {
      if (!onSendFeedback) return;
      const targetVariantId = matchedVariant?.id || product.variants?.[0]?.id;
      if (!targetVariantId) return;

      setLoadingCheckout(true);
      // Pass checkout instruction back to Gemini Live synchronous tools router
      onSendFeedback(`I would like to create a checkout for variant ID: ${targetVariantId} with quantity 1`);
    };

    return (
      <div className="max-w-5xl mx-auto my-6 bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm animate-fade-in text-neutral-900">
        {/* Navigation Breadcrumb */}
        <div className="flex justify-between items-center pb-4 mb-6 border-b border-neutral-100">
          <button
            onClick={() => {
              if (isSingleProductMode) {
                onClose();
              } else {
                setSelectedProduct(null);
                setSelectedOptions({});
              }
            }}
            className="group flex items-center gap-2 text-neutral-500 hover:text-black transition-colors text-sm font-medium"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            {isSingleProductMode ? "Back to Call" : "Back to Catalog"}
          </button>
          <span className="text-xs tracking-wider text-neutral-400 font-semibold uppercase">
            Storefront: {merchantDomain}
          </span>
        </div>

        {/* Product Workspace Split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Media Column */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-50 border border-neutral-100">
            {currentMedia ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.alt_text || product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-300">
                No image available
              </div>
            )}
          </div>

          {/* Details & Interactive Config Column */}
          <div className="flex flex-col justify-between">
            <div>
              {/* Product Rating and Badges */}
              <div className="flex items-center gap-3 mb-2">
                {product.rating && (
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 bg-neutral-50 px-2.5 py-1 rounded-full border border-neutral-100">
                    <span className="text-amber-500">★</span>
                    <span className="font-semibold">{product.rating.value}</span>
                    <span className="text-neutral-400">({product.rating.count})</span>
                  </div>
                )}
                {product.metadata?.certifications?.map((cert: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-medium uppercase tracking-wide"
                  >
                    {cert}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight leading-none mb-3">
                {product.title}
              </h1>

              {/* Price Area */}
              <div className="text-2xl font-bold text-neutral-900 mb-6">
                {matchedVariant ? (
                  formatPrice(matchedVariant.price)
                ) : (
                  <>
                    {formatPrice(product.price_range.min)}
                    {product.price_range.max.amount > product.price_range.min.amount && (
                      <span className="text-neutral-400 font-normal text-lg">
                        {" "}
                        - {formatPrice(product.price_range.max)}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Description */}
              <div className="text-sm text-neutral-500 leading-relaxed mb-6">
                {product.description.html ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: product.description.html }}
                    className="prose prose-sm max-w-none text-neutral-600"
                  />
                ) : (
                  <p>{product.description.plain}</p>
                )}
              </div>

              {/* Dynamic Option Selection Matrices */}
              {product.options && product.options.length > 0 && (
                <div className="space-y-4 mb-8">
                  {product.options.map((opt) => (
                    <div key={opt.name}>
                      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Select {opt.name}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {opt.values.map((val) => {
                          const isSelected = selectedOptions[opt.name] === val.label;
                          const isAvailable = val.available !== false;
                          const exists = val.exists !== false;

                          return (
                            <button
                              key={val.label}
                              disabled={!exists}
                              onClick={() => handleSelectOption(opt.name, val.label)}
                              className={`px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                                !exists
                                  ? "opacity-20 cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300"
                                  : isSelected
                                  ? "border-black bg-black text-white shadow-sm"
                                  : !isAvailable
                                  ? "border-neutral-200 text-neutral-400 bg-neutral-50 line-through decoration-neutral-300"
                                  : "border-neutral-200 hover:border-neutral-400 text-neutral-700 bg-white"
                              }`}
                            >
                              {val.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buying Action Triggers */}
            <div className="pt-6 border-t border-neutral-100 space-y-3">
              <button
                disabled={!isAddToCartEnabled || loadingCheckout}
                onClick={handleActionCheckout}
                className={`w-full py-4 text-center rounded-full font-bold text-sm shadow-md transition-all active:scale-[0.98] ${
                  isAddToCartEnabled && !loadingCheckout
                    ? "bg-black text-white hover:bg-neutral-900 cursor-pointer"
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed shadow-none"
                }`}
              >
                {loadingCheckout ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin" />
                    Preparing Secure Checkout...
                  </span>
                ) : isAddToCartEnabled ? (
                  `Instantly Buy This Item (${matchedVariant ? formatPrice(matchedVariant.price) : "Staged"})`
                ) : (
                  "Select Options to Checkout"
                )}
              </button>
              <p className="text-[11px] text-center text-neutral-400">
                Purchases are secured cryptographically using our compliant UCP transaction gateway.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Case C: Catalog Product Search Results List Grid View (Browsing)
  // -------------------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto my-6 text-neutral-950">
      {/* Search Header */}
      <div className="flex justify-between items-center border-b border-neutral-100 pb-5 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Storefront Catalog</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Showing matches resolved live via <span className="font-semibold">{merchantDomain}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-semibold px-4 py-2 border border-neutral-200 hover:border-neutral-400 rounded-full transition-all bg-white"
        >
          Return to Video Call
        </button>
      </div>

      {productsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
          <p className="text-sm">No items match your catalog request.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {productsList.map((product) => {
            const featuredMedia = product.media && product.media[0] ? product.media[0] : null;

            return (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="group flex flex-col justify-between bg-white rounded-2xl border border-neutral-100 hover:border-neutral-300 overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all duration-300"
              >
                {/* Product Image Stage */}
                <div className="relative aspect-square w-full bg-neutral-50 overflow-hidden border-b border-neutral-50">
                  {featuredMedia ? (
                    <img
                      src={featuredMedia.url}
                      alt={featuredMedia.alt_text || product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                      No Image
                    </div>
                  )}

                  {/* Rating Overlay */}
                  {product.rating && (
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-[10px] bg-white/95 px-2 py-0.5 rounded-full border border-neutral-100 font-semibold text-neutral-800 backdrop-blur-sm">
                      <span className="text-amber-500">★</span>
                      <span>{product.rating.value}</span>
                    </div>
                  )}
                </div>

                {/* Content Details Block */}
                <div className="p-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-neutral-800 text-sm line-clamp-1 group-hover:text-black transition-colors mb-1">
                      {product.title}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-normal mb-3">
                      {product.description.plain}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    {/* Compact Pricing */}
                    <span className="font-bold text-neutral-900 text-sm">
                      {formatPrice(product.price_range.min)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-semibold tracking-wide uppercase px-2 py-1 bg-neutral-50 rounded-md border border-neutral-100 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all">
                      Configure →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
