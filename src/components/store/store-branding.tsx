import { DEFAULT_BRANDING } from "@/domain/merchant/branding";
import { getBranding } from "@/server/branding";

/** The merchant's announcement line, shown above the header. Renders nothing when empty. */
export async function StoreAnnouncement() {
  const { announcement } = await getBranding();
  if (!announcement) return null;
  return (
    <p
      className="border-b border-line bg-paper px-4 py-2 text-center text-sm text-ink"
      data-testid="store-announcement"
    >
      {announcement}
    </p>
  );
}

const heroClass = "mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl";

export async function HeroTagline() {
  const { tagline } = await getBranding();
  return (
    <h1 className={heroClass} data-testid="store-tagline">
      {tagline}
    </h1>
  );
}

/** Reserves the hero's space while the tagline streams in, without showing stale wording. */
export function HeroTaglineFallback() {
  return (
    <div aria-hidden="true" className={`${heroClass} invisible`}>
      {DEFAULT_BRANDING.tagline}
    </div>
  );
}

export async function FooterTagline() {
  const { tagline } = await getBranding();
  return <span data-testid="footer-tagline">{tagline}</span>;
}
