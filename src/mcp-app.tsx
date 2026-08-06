import React from 'react';
import ReactDOM from 'react-dom/client';
import { App, PostMessageTransport, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";

const ProductCard = ({ product }: { product: any }) => {
  const variant = product.variants?.[0];
  const price = variant?.price_range?.min || product.price_range?.min;
  
  return (
    <div className="group relative bg-zinc-900/40 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 hover:border-brand-primary/50 transition-all duration-500 hover:scale-[1.02] shadow-2xl flex flex-col h-full">
      {/* Image Gallery / Media Section */}
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-800">
        {variant?.image?.url || product.image?.url ? (
          <img 
            src={variant?.image?.url || product.image?.url} 
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 italic text-xs">No image available</div>
        )}
        
        {product.gift_card && (
          <div className="absolute top-3 right-3 bg-brand-primary text-black text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
            Digital Gift Card
          </div>
        )}

        {/* Overlay for quick interaction */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <button 
            className="w-full py-3 bg-white text-black rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-colors shadow-xl"
            onClick={() => app.callServerTool("get_product", { id: product.id })}
          >
            Quick View
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-white leading-tight line-clamp-2 group-hover:text-brand-primary transition-colors">
            {product.title}
          </h3>
          <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
            <span>★</span>
            <span>4.8</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {product.collections?.map((col: any) => (
            <span key={col.id} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 border border-white/5">
              {col.title}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div>
            <span className="text-zinc-500 text-xs block uppercase tracking-tighter">Price</span>
            <span className="text-xl font-black text-white">
              {price?.currency} {(price?.amount / 100).toFixed(2)}
            </span>
          </div>
          
          <button 
            onClick={() => app.callServerTool("create_checkout", { variant_id: variant?.id })}
            className="p-3 bg-brand-primary text-black rounded-2xl hover:scale-110 transition-transform active:scale-95 shadow-lg shadow-brand-primary/20"
          >
            <ShoppingCart size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

const AppUI = () => {
  const [content, setContent] = React.useState<any>(null);

  React.useEffect(() => {
    app.ontoolresult = (result) => {
      console.log("Tool result received:", result);
      setContent(result);
    };
  }, []);

  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'var(--font-sans)',
      color: 'var(--color-text-primary)',
      background: 'transparent'
    }}>
      {content ? (
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black tracking-tighter italic uppercase">
              Curated for You
            </h2>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-full bg-white/10 text-xs text-zinc-400 hover:bg-white/20 transition-colors border border-white/10">
                Filters
              </button>
              <button className="px-3 py-1 rounded-full bg-white/10 text-xs text-zinc-400 hover:bg-white/20 transition-colors border border-white/10">
                Sort
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.isArray(content) ? (
              content.map((item, i) => <ProductCard key={i} product={item} />)
            ) : (
              <ProductCard product={content} />
            )}
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-zinc-500 italic font-light animate-pulse">
          Gemini is curating your selection...
        </div>
      )}
    </div>
  );
};

const app = new App({ name: "UCP Viewer", version: "1.0.0" });

app.ontoolinput = (params) => {
  console.log("Tool input received:", params);
  // In a real implementation, you'd update a state store that AppUI listens to
};

app.ontoolresult = (result) => {
  console.log("Tool result received:", result);
  // Update the UI with the tool result
};

app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    const { top, right, bottom, left } = ctx.safeAreaInsets;
    document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<AppUI />);

app.connect(new PostMessageTransport(window));