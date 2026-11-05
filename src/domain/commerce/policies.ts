export const POLICY_KEYS = ["shipping", "returns", "care-and-warranty", "demo-store"] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

/** Store policy text is the only source the storefront and advisor may quote. */
export interface StorePolicy {
  readonly key: PolicyKey;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly updatedAt: string;
}
