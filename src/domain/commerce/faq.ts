import type { PolicyKey, StorePolicy } from "./policies";

/**
 * Storefront Help & FAQ. Policy answers quote the stored policy text exactly, so the FAQ
 * can never promise more than the policies do. The other answers describe behaviour the
 * store actually implements. Pure functions only.
 */

export interface FaqLink {
  readonly href: string;
  readonly label: string;
}

export interface FaqEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  /** The stored policy the answer quotes, if any. */
  readonly policyKey: PolicyKey | null;
  /** Where the shopper can act on the answer, when there is such a place. */
  readonly link: FaqLink | null;
}

const POLICY_QUESTIONS: ReadonlyArray<{
  readonly key: PolicyKey;
  readonly question: string;
  readonly link: FaqLink;
}> = [
  {
    key: "demo-store",
    question: "Will I be charged for an order?",
    link: { href: "/#demo-store", label: "How this demo store works" },
  },
  {
    key: "shipping",
    question: "How much is shipping, and how long does it take?",
    link: { href: "/#shipping", label: "Shipping policy" },
  },
  {
    key: "returns",
    question: "Can I return something?",
    link: { href: "/#returns", label: "Returns policy" },
  },
  {
    key: "care-and-warranty",
    question: "Is there a warranty?",
    link: { href: "/#care-and-warranty", label: "Care & warranty policy" },
  },
];

const BEHAVIOUR: readonly FaqEntry[] = [
  {
    id: "choosing",
    question: "Can someone help me choose?",
    answer:
      "Ask the shopping advisor in your own words, for example a budget or what you need it for. It answers only from the products, prices and stock in this store, and links to the exact option it suggests.",
    policyKey: null,
    link: { href: "/advisor", label: "Ask an advisor" },
  },
  {
    id: "reach-a-person",
    question: "How do I reach a person?",
    answer:
      "Use “Talk to a person” on the advisor page to leave your email and question for the shop team. This is a demo store: requests are saved for the team and no email is sent.",
    policyKey: null,
    link: { href: "/advisor#talk-to-a-person", label: "Talk to a person" },
  },
  {
    id: "privacy",
    question: "What do you record about my visit?",
    answer:
      "Only anonymous shopping steps, such as viewing a product or adding it to the cart, tied to a random id for this browser session. Never your name, email or address. If your browser sends Global Privacy Control, nothing is recorded, and nothing is sent to an outside analytics service. The details you enter at checkout are kept with that order, and you choose separately whether we may email you.",
    policyKey: null,
    link: null,
  },
];

/** The FAQ, built from the stored policies. A policy question is left out if its policy is missing. */
export function buildFaq(policies: readonly StorePolicy[]): FaqEntry[] {
  const byKey = new Map(policies.map((policy) => [policy.key, policy]));
  const fromPolicies = POLICY_QUESTIONS.flatMap(({ key, question, link }) => {
    const policy = byKey.get(key);
    return policy ? [{ id: key, question, answer: policy.body, policyKey: key, link }] : [];
  });
  return [...fromPolicies, ...BEHAVIOUR];
}
