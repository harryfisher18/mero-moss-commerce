import { describe, expect, it } from "vitest";
import { buildFaq } from "./faq";
import type { StorePolicy } from "./policies";

const policy = (key: StorePolicy["key"], body: string): StorePolicy => ({
  key,
  title: key,
  summary: `${key} summary`,
  body,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const POLICIES: StorePolicy[] = [
  policy("shipping", "Ships in 2 days."),
  policy("returns", "Return within 30 days."),
  policy("care-and-warranty", "One year."),
  policy("demo-store", "No payment is collected."),
];

describe("buildFaq", () => {
  it("answers policy questions with the stored policy text, word for word", () => {
    const faq = buildFaq(POLICIES);
    for (const stored of POLICIES) {
      const entry = faq.find((e) => e.policyKey === stored.key);
      expect(entry?.answer).toBe(stored.body);
      expect(entry?.link?.href).toBe(`/#${stored.key}`);
    }
  });

  it("leaves out a policy question when that policy is not stored", () => {
    const faq = buildFaq(POLICIES.filter((p) => p.key !== "returns"));
    expect(faq.map((e) => e.id)).not.toContain("returns");
    expect(faq.map((e) => e.id)).toContain("shipping");
  });

  it("always includes the behaviour answers, with unique ids", () => {
    const ids = buildFaq([]).map((e) => e.id);
    expect(ids).toEqual(["choosing", "reach-a-person", "privacy"]);
    const all = buildFaq(POLICIES).map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("makes no shipping, return or warranty promises outside the policies", () => {
    const behaviour = buildFaq([])
      .map((e) => e.answer)
      .join(" ");
    expect(behaviour).not.toMatch(
      /\b\d+\s*(days?|years?)\b|free shipping|refund|warranty|guarantee/i,
    );
  });
});
