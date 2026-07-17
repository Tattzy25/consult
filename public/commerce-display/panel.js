(function () {
  'use strict';

  const PANEL_CHANNEL = 'commerce-panel';
  const output = document.getElementById('commerce-output');

  if (!output) {
    throw new Error('Commerce display could not find #commerce-output');
  }

  function postAction(action) {
    window.parent.postMessage(
      {
        channel: PANEL_CHANNEL,
        type: 'action',
        ...action,
      },
      window.location.origin,
    );
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      output.scrollTop = output.scrollHeight;
    });
  }

  function removeEmptyState() {
    const empty = document.getElementById('commerce-empty-state');
    if (empty) empty.remove();
  }

  function clearPanel() {
    output.replaceChildren();
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (typeof text === 'string') {
      element.textContent = text;
    }

    return element;
  }

  function stringify(value) {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return String(value ?? '');
    }
  }

  function showLoading(label) {
    removeLoading();

    const loading = createElement('div', 'commerce-loading');
    loading.id = 'commerce-loading';

    const dots = createElement('span', 'commerce-loading-dots');
    dots.innerHTML = '<span></span><span></span><span></span>';

    loading.append(dots, document.createTextNode(label || 'Working'));
    output.appendChild(loading);
    scrollToBottom();
  }

  function removeLoading() {
    document.getElementById('commerce-loading')?.remove();
  }

  function renderTool(name, args, state) {
    removeEmptyState();

    const details = createElement('details', 'commerce-tool');
    details.open = state === 'running';

    const summary = createElement('summary');
    const label = createElement(
      'span',
      'commerce-tool-label',
      `${state === 'running' ? 'Working: ' : 'Action: '}${name || 'commerce tool'}`,
    );

    const pre = createElement('pre', 'commerce-tool-args');
    pre.textContent = stringify(args);

    summary.appendChild(label);
    details.append(summary, pre);
    output.appendChild(details);

    if (state === 'running') {
      showLoading(name || 'Working');
    } else {
      removeLoading();
    }

    scrollToBottom();
  }

  function renderProducts(products, heading) {
    removeEmptyState();
    removeLoading();

    const section = createElement('section', 'shop-ai-product-section');
    const header = createElement('div', 'shop-ai-product-header');
    const title = createElement(
      'h2',
      '',
      heading || 'Products selected for you',
    );
    const grid = createElement('div', 'shop-ai-product-grid');

    header.appendChild(title);

    if (!Array.isArray(products) || products.length === 0) {
      const empty = createElement(
        'p',
        'commerce-empty-products',
        'No matching products were returned.',
      );
      section.append(header, empty);
      output.appendChild(section);
      return;
    }

    for (const product of products) {
      grid.appendChild(createProductCard(normalizeProduct(product)));
    }

    section.append(header, grid);
    output.appendChild(section);
    scrollToBottom();
  }

  function normalizeProduct(product) {
    const item = product && typeof product === 'object' ? product : {};

    // UCP shape: variant-level id/seller/url/checkout live in variants[0], not flat on the product.
    const variant =
      Array.isArray(item.variants) && item.variants.length > 0
        ? item.variants[0]
        : null;

    // UCP shape: media is an array of { type: "image", url, alt_text }, on the
    // variant and/or the product. Confirmed from a real catalog_search response.
    const variantMedia =
      Array.isArray(variant?.media) && variant.media.length > 0
        ? variant.media[0]
        : null;
    const productMedia =
      Array.isArray(item.media) && item.media.length > 0 ? item.media[0] : null;

    const image =
      variantMedia?.url ||
      productMedia?.url ||
      item.image_url ||
      item.imageUrl ||
      item.image ||
      item.featured_image?.url ||
      item.featuredImage?.url ||
      item.thumbnail ||
      '';

    const imageAlt = variantMedia?.alt_text || productMedia?.alt_text || '';

    // UCP: variant.price = { amount, currency } is the exact price for this
    // variant. price_range.min is only the product-wide min/max fallback.
    const variantPrice =
      variant?.price && typeof variant.price === 'object' ? variant.price : null;
    const priceRangeObj =
      (item.price_range && typeof item.price_range === 'object' && item.price_range) ||
      (item.priceRange && typeof item.priceRange === 'object' && item.priceRange) ||
      null;
    const minorAmount = variantPrice?.amount ?? priceRangeObj?.min?.amount;
    const priceCurrency = variantPrice?.currency ?? priceRangeObj?.min?.currency;

    let formattedPrice = '';

    if (typeof minorAmount === 'number' && priceCurrency) {
      formattedPrice = `${(minorAmount / 100).toFixed(2)} ${priceCurrency}`;
    } else {
      const money =
        item.price ||
        item.price_text ||
        item.priceText ||
        item.amount ||
        '';
      formattedPrice = typeof money === 'string' ? money : '';
    }

    const variantId = String(
      variant?.id || item.variant_id || item.variantId || '',
    );

    const url =
      variant?.url ||
      item.url ||
      item.product_url ||
      item.productUrl ||
      item.handle_url ||
      item.handleUrl ||
      '';

    const checkoutUrl = variant?.checkout_url || item.checkout_url || item.checkoutUrl || '';

    return {
      ...item,
      id: String(
        item.id ||
          item.product_id ||
          item.productId ||
          variantId ||
          '',
      ),
      variant_id: variantId,
      title: String(item.title || item.name || item.product_title || 'Product'),
      image_url: typeof image === 'string' ? image : '',
      image_alt: typeof imageAlt === 'string' ? imageAlt : '',
      price: formattedPrice,
      url: typeof url === 'string' ? url : '',
      checkout_url: typeof checkoutUrl === 'string' ? checkoutUrl : '',
    };
  }

  function createProductCard(product) {
    const card = createElement('article', 'shop-ai-product-card');

    const imageWrap = createElement('button', 'shop-ai-product-image');
    imageWrap.type = 'button';
    imageWrap.setAttribute('aria-label', `View ${product.title}`);

    const image = document.createElement('img');
    image.src =
      product.image_url ||
      'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
    image.alt = product.image_alt || product.title;
    image.loading = 'lazy';

    image.onerror = function () {
      this.src =
        'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
    };

    imageWrap.appendChild(image);
    imageWrap.addEventListener('click', () => {
      postAction({
        action: 'view_product',
        product,
      });
    });

    const info = createElement('div', 'shop-ai-product-info');
    const productTitle = createElement('h3', 'shop-ai-product-title');
    const titleButton = createElement('button', '', product.title);
    titleButton.type = 'button';

    titleButton.addEventListener('click', () => {
      postAction({
        action: 'view_product',
        product,
      });
    });

    const price = createElement('p', 'shop-ai-product-price', product.price);
    const addButton = createElement(
      'button',
      'shop-ai-add-to-cart',
      'Add to Cart',
    );

    addButton.type = 'button';
    addButton.dataset.productId = product.id;

    addButton.addEventListener('click', () => {
      addButton.disabled = true;
      addButton.textContent = 'Adding…';

      postAction({
        action: 'add_to_cart',
        product,
      });

      window.setTimeout(() => {
        addButton.disabled = false;
        addButton.textContent = 'Add to Cart';
      }, 1800);
    });

    productTitle.appendChild(titleButton);
    info.append(productTitle, price, addButton);
    card.append(imageWrap, info);

    return card;
  }

  function renderButton(button) {
    removeEmptyState();

    const wrapper = createElement('div', 'commerce-actions');
    const element = createActionButton(button);

    wrapper.appendChild(element);
    output.appendChild(wrapper);
    scrollToBottom();
  }

  function renderButtons(buttons) {
    removeEmptyState();

    const wrapper = createElement('div', 'commerce-actions');

    for (const button of Array.isArray(buttons) ? buttons : []) {
      wrapper.appendChild(createActionButton(button));
    }

    output.appendChild(wrapper);
    scrollToBottom();
  }

  function createActionButton(button) {
    const item = button && typeof button === 'object' ? button : {};
    const element = createElement(
      'button',
      `commerce-action-button ${item.variant === 'secondary' ? 'secondary' : ''}`,
      String(item.label || 'Continue'),
    );

    element.type = 'button';

    element.addEventListener('click', () => {
      if (item.url) {
        postAction({
          action: 'open_checkout',
          url: item.url,
        });
        return;
      }

      postAction({
        action: 'choice',
        label: String(item.label || 'Continue'),
        value: String(item.value || item.action || item.label || 'continue'),
      });
    });

    return element;
  }

  function renderCheckout(url, title, text) {
    removeEmptyState();
    removeLoading();

    if (!url) return;

    const card = createElement('section', 'commerce-checkout');
    const copy = createElement('div', 'commerce-checkout-copy');
    const heading = createElement(
      'h2',
      'commerce-checkout-title',
      title || 'Your checkout is ready',
    );
    const description = createElement(
      'p',
      'commerce-checkout-text',
      text || 'Continue securely to checkout.',
    );

    const button = createElement(
      'button',
      'commerce-action-button',
      'Checkout',
    );

    button.type = 'button';
    button.addEventListener('click', () => {
      postAction({
        action: 'open_checkout',
        url,
      });
    });

    copy.append(heading, description);
    card.append(copy, button);
    output.appendChild(card);
    scrollToBottom();
  }

  function parseJsonString(value) {
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();

    if (
      !trimmed ||
      (!trimmed.startsWith('{') && !trimmed.startsWith('['))
    ) {
      return value;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  function collectProducts(value, found) {
    const current = parseJsonString(value);

    if (!current || typeof current !== 'object') return;

    if (Array.isArray(current)) {
      for (const entry of current) {
        collectProducts(entry, found);
      }
      return;
    }

    const possibleProductKeys = [
      'products',
      'items',
      'results',
      'catalog',
      'product_results',
      'productResults',
      'data',
    ];

    for (const key of possibleProductKeys) {
      const candidate = current[key];

      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          if (item && typeof item === 'object') {
            const normalized = normalizeProduct(item);

            if (
              normalized.title !== 'Product' ||
              normalized.id ||
              normalized.url
            ) {
              found.push(normalized);
            }
          }
        }
      }
    }

    for (const child of Object.values(current)) {
      if (child && typeof child === 'object') {
        collectProducts(child, found);
      } else if (typeof child === 'string') {
        const parsedChild = parseJsonString(child);
        if (parsedChild && typeof parsedChild === 'object') {
          collectProducts(parsedChild, found);
        }
      }
    }
  }

  function findCheckoutUrl(value) {
    const current = parseJsonString(value);

    if (!current || typeof current !== 'object') return '';

    if (Array.isArray(current)) {
      for (const item of current) {
        const found = findCheckoutUrl(item);
        if (found) return found;
      }

      return '';
    }

    for (const [key, child] of Object.entries(current)) {
      if (
        typeof child === 'string' &&
        /(checkout|cart)/i.test(key) &&
        /^https?:\/\//i.test(child)
      ) {
        return child;
      }

      if (child && typeof child === 'object') {
        const found = findCheckoutUrl(child);
        if (found) return found;
      }
    }

    return '';
  }

  function renderMcpResult(result, tool) {
    removeLoading();

    const products = [];
    collectProducts(result, products);

    const uniqueProducts = [];
    const seen = new Set();

    for (const product of products) {
      const key = product.id || product.url || product.title;

      if (!key || seen.has(key)) continue;

      seen.add(key);
      uniqueProducts.push(product);
    }

    if (uniqueProducts.length) {
      renderProducts(uniqueProducts, 'Products');
    }

    const checkoutUrl = findCheckoutUrl(result);

    if (checkoutUrl) {
      renderCheckout(checkoutUrl);
    }

    renderTool(tool || 'commerce result', result, 'complete');
  }

  function receiveEvent(event) {
    if (event.origin !== window.location.origin) return;

    const data = event.data;

    if (!data || data.channel !== PANEL_CHANNEL) return;

    switch (data.type) {
      case 'clear':
        clearPanel();
        break;

      case 'loading':
        if (data.active) {
          showLoading(data.label || 'Working');
        } else {
          removeLoading();
        }
        break;

      case 'tool':
        renderTool(data.name, data.args, data.state || 'running');
        break;

      case 'products':
        renderProducts(data.products, data.heading);
        break;

      case 'button':
        renderButton(data);
        break;

      case 'buttons':
        renderButtons(data.buttons);
        break;

      case 'checkout':
        renderCheckout(data.url, data.title, data.text);
        break;

      case 'mcp_result':
        renderMcpResult(data.result, data.tool);
        break;

      default:
        break;
    }
  }

  window.addEventListener('message', receiveEvent);

  window.parent.postMessage(
    {
      channel: PANEL_CHANNEL,
      type: 'ready',
    },
    window.location.origin,
  );
})();