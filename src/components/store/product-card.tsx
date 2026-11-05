import type { Product } from "@/domain/commerce/catalog";
import { ProductArt } from "./product-art";
import { toProductCardModel } from "./product-card-model";

export function ProductCard({ product }: { product: Product }) {
  const model = toProductCardModel(product);
  return (
    <article
      className="group flex flex-col"
      data-testid="product-card"
      data-handle={product.handle}
    >
      <div className="relative aspect-square overflow-hidden rounded-sm">
        <ProductArt
          category={product.categoryHandle}
          swatch={product.swatch}
          className={`h-full w-full ${model.soldOut ? "opacity-60" : ""}`}
        />
        {model.availabilityLabel && (
          <span className="absolute top-3 left-3 rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-ink">
            {model.availabilityLabel}
          </span>
        )}
      </div>
      <h3 className="mt-3 font-serif text-lg leading-snug">{model.title}</h3>
      <p className="mt-1 text-sm text-muted">{model.summary}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="font-medium text-ink">{model.priceLabel}</span>
        {model.optionsLabel && <span className="text-muted">{model.optionsLabel}</span>}
      </p>
    </article>
  );
}
