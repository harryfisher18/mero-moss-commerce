import { type AdvisorAnswer, composeAnswer } from "@/domain/advisor/answer";
import { parseShopperQuery } from "@/domain/advisor/query";
import { catalogVocabulary, retrieve } from "@/domain/advisor/retrieval";
import { validateWording, wordingFacts } from "@/domain/advisor/wording";
import type { Product } from "@/domain/commerce/catalog";
import type { StorePolicy } from "@/domain/commerce/policies";
import {
  describeWordingError,
  type WordingProvider,
  type WordingStatus,
} from "@/server/integrations/wording-provider";

export type AnswerSource = "catalog" | "assisted";

/** Why the reply has (or lacks) assisted wording, so the UI can say so plainly. */
export type WordingOutcome = "not_configured" | "not_needed" | "used" | "fallback";

export interface AdvisorResponse {
  readonly answer: AdvisorAnswer;
  /** Assisted wording that passed validation, shown above the catalog facts. */
  readonly wording: string | null;
  readonly source: AnswerSource;
  readonly wordingOutcome: WordingOutcome;
}

export interface RecommendationProvider {
  answer(question: string): Promise<AdvisorResponse>;
}

export interface CatalogSource {
  listProducts(): Product[];
  listPolicies(): StorePolicy[];
}

/**
 * The advisor's baseline: deterministic retrieval over the live catalog and stored
 * policies. With a wording provider configured it asks for friendlier wording of the same
 * facts and keeps it only if validation passes. Every fact shown still comes from the
 * catalog, and any wording failure leaves a complete, correct catalog answer.
 */
export class CatalogRecommendationProvider implements RecommendationProvider {
  constructor(
    private readonly catalog: CatalogSource,
    private readonly wording: WordingProvider | null = null,
    private readonly status: WordingStatus | null = null,
  ) {}

  async answer(question: string): Promise<AdvisorResponse> {
    // Read everything up front: prices and stock are as of this request.
    const products = this.catalog.listProducts();
    const policies = this.catalog.listPolicies();
    const intent = parseShopperQuery(question, catalogVocabulary(products));
    const answer = composeAnswer(intent, retrieve(intent, products), policies);
    const catalogOnly = (wordingOutcome: WordingOutcome): AdvisorResponse => ({
      answer,
      wording: null,
      source: "catalog",
      wordingOutcome,
    });

    if (!this.wording) return catalogOnly("not_configured");
    if (answer.kind === "escalate") return catalogOnly("not_needed");

    try {
      const reply = await this.wording.word(intent.question, wordingFacts(answer));
      const check = validateWording(reply, answer);
      if (!check.ok) {
        this.status?.rejected(check.reason);
        return catalogOnly("fallback");
      }
      this.status?.succeeded();
      return { answer, wording: check.text, source: "assisted", wordingOutcome: "used" };
    } catch (error) {
      const issue = describeWordingError(error);
      this.status?.failed(issue);
      console.warn(`[advisor] assisted wording unavailable: ${issue}`);
      return catalogOnly("fallback");
    }
  }
}
