import type { CategoryHandle } from "@/domain/commerce/catalog";

/**
 * Lightweight SVG illustration used until product photography exists.
 * It is decorative: the product title next to it carries the meaning.
 */
export function ProductArt({
  category,
  swatch,
  className,
}: {
  category: CategoryHandle;
  swatch: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 400"
      aria-hidden="true"
      focusable="false"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="400" fill="#efe8dc" />
      <ellipse cx="200" cy="318" rx="120" ry="16" fill="#2b2620" opacity="0.08" />
      {category === "home-organization" && (
        <g>
          <path d="M100 170 h200 l-18 140 h-164 z" fill={swatch} />
          {[200, 230, 260, 290].map((y) => (
            <line key={y} x1="104" x2="296" y1={y} y2={y} stroke="#2b2620" opacity="0.12" />
          ))}
          <path d="M150 170 q50 -60 100 0" fill="none" stroke={swatch} strokeWidth="10" />
        </g>
      )}
      {category === "table-and-kitchen" && (
        <g>
          <circle cx="200" cy="215" r="105" fill={swatch} />
          <circle cx="200" cy="215" r="70" fill="#2b2620" opacity="0.06" />
        </g>
      )}
      {category === "workspace" && (
        <g>
          <rect x="85" y="230" width="230" height="80" rx="8" fill={swatch} />
          <rect x="150" y="130" width="100" height="100" rx="6" fill={swatch} opacity="0.75" />
        </g>
      )}
      {category === "travel-essentials" && (
        <g>
          <rect x="90" y="170" width="220" height="140" rx="26" fill={swatch} />
          <path
            d="M160 170 v-30 a40 40 0 0 1 80 0 v30"
            fill="none"
            stroke="#2b2620"
            strokeWidth="10"
            opacity="0.5"
          />
        </g>
      )}
    </svg>
  );
}
