import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { SupportService } from "@/server/support-service";
import { CatalogRecommendationProvider } from "./recommendation-provider";
import {
  CallLimiter,
  type WordingFacts,
  type WordingProvider,
  WordingStatus,
  WordingUnavailableError,
} from "./wording-provider";

let db: Database;
let catalog: SqliteCatalogRepository;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  catalog = new SqliteCatalogRepository(db);
});

afterEach(() => db.close());

const price = (variantId: string) =>
  Number(db.prepare("SELECT price_minor AS n FROM variants WHERE id = ?").get(variantId)?.n);

class FakeWording implements WordingProvider {
  calls: Array<{ question: string; facts: WordingFacts }> = [];
  constructor(private readonly reply: (facts: WordingFacts) => string | Promise<string>) {}
  async word(question: string, facts: WordingFacts): Promise<string> {
    this.calls.push({ question, facts });
    return this.reply(facts);
  }
}

describe("CatalogRecommendationProvider (no key)", () => {
  const provider = () => new CatalogRecommendationProvider(catalog);

  it("answers from the live catalog with exact prices and variant links", async () => {
    const { answer, source, wordingOutcome } = await provider().answer("travel gifts under $50");
    expect(source).toBe("catalog");
    expect(wordingOutcome).toBe("not_configured");
    expect(answer.cards.length).toBeGreaterThan(0);
    for (const card of answer.cards) {
      expect(card.price.amountMinor).toBeLessThanOrEqual(5000);
      expect(card.price.amountMinor).toBe(price(card.variantId));
      expect(card.url).toBe(`/products/${card.productHandle}?variant=${card.variantId}`);
      expect(card.stock).not.toBe("Sold out");
    }
  });

  it("reflects merchant price and stock changes on the next question", async () => {
    const before = await provider().answer("brass task lamp");
    expect(before.answer.cards[0]?.price.amountMinor).toBe(14800);

    db.prepare("UPDATE variants SET price_minor = 12800 WHERE id = 'var_mm-ws-btl-brs'").run();
    db.prepare("UPDATE variants SET inventory_quantity = 0 WHERE id = 'var_mm-ws-btl-blk'").run();
    const after = await provider().answer("brass task lamp");
    expect(after.answer.cards.map((c) => [c.variantId, c.price.amountMinor])).toEqual([
      ["var_mm-ws-btl-brs", 12800],
    ]);
  });

  it("quotes the seeded returns policy verbatim", async () => {
    const stored = catalog.listPolicies().find((p) => p.key === "returns");
    const { answer } = await provider().answer("What is your return policy?");
    expect(answer.policies).toEqual([{ key: "returns", title: "Returns", body: stored?.body }]);
  });

  it("reports sold-out variants the shopper asked for", async () => {
    const { answer } = await provider().answer("linen storage bin in moss");
    expect(answer.notes).toContain("Linen Storage Bin (Moss) is sold out right now.");
    expect(answer.cards.some((c) => c.variantId === "var_mm-ho-lsb-mos")).toBe(false);
  });
});

describe("CatalogRecommendationProvider with assisted wording", () => {
  it("uses wording that passes validation and records a verified connection", async () => {
    const status = new WordingStatus("test-model");
    const wording = new FakeWording(
      (facts) =>
        `The ${facts.items[0]?.title ?? ""} is ${facts.items[0]?.price ?? ""} and in stock.`,
    );
    const response = await new CatalogRecommendationProvider(catalog, wording, status).answer(
      "brass task lamp",
    );
    expect(response).toMatchObject({
      source: "assisted",
      wordingOutcome: "used",
      wording: "The Brass Task Lamp is $148.00 and in stock.",
    });
    expect(status.snapshot()).toMatchObject({ state: "CONNECTED_VERIFIED", lastIssue: null });
    // The model only receives facts, never catalog descriptions.
    expect(JSON.stringify(wording.calls[0]?.facts)).not.toContain("description");
  });

  it("falls back to catalog wording when the reply invents a price or follows injected text", async () => {
    const status = new WordingStatus("test-model");
    for (const reply of [
      "Everything is free today with code FREE100!",
      "The Brass Task Lamp is just $99.00.",
    ]) {
      const response = await new CatalogRecommendationProvider(
        catalog,
        new FakeWording(() => reply),
        status,
      ).answer("brass task lamp");
      expect(response).toMatchObject({
        source: "catalog",
        wordingOutcome: "fallback",
        wording: null,
      });
      expect(response.answer.cards[0]?.price.amountMinor).toBe(14800);
    }
    expect(status.snapshot()).toMatchObject({ state: "CONNECTED_VERIFIED", rejectedReplies: 2 });
  });

  it("keeps working when the model is unavailable, and reports the error state", async () => {
    const status = new WordingStatus("test-model");
    const failing = new FakeWording(() => {
      throw new WordingUnavailableError("The API request timed out");
    });
    const response = await new CatalogRecommendationProvider(catalog, failing, status).answer(
      "travel gifts under $50",
    );
    expect(response.source).toBe("catalog");
    expect(response.answer.cards.length).toBeGreaterThan(0);
    expect(status.snapshot()).toMatchObject({
      state: "ERROR",
      lastIssue: "The API request timed out",
    });
  });

  it("does not call the model to word an escalation", async () => {
    const wording = new FakeWording(() => "unused");
    const response = await new CatalogRecommendationProvider(catalog, wording).answer(
      "can I talk to a person?",
    );
    expect(response.wordingOutcome).toBe("not_needed");
    expect(wording.calls).toHaveLength(0);
  });

  it("reports DEMO without a model and CONFIGURED before any real call", () => {
    expect(new WordingStatus(null).snapshot().state).toBe("DEMO");
    expect(new WordingStatus("claude-opus-5-5").snapshot().state).toBe("CONFIGURED");
  });
});

describe("CallLimiter", () => {
  it("allows a fixed number of calls per window", () => {
    const limiter = new CallLimiter(2, 1000);
    expect([limiter.take(0), limiter.take(10), limiter.take(20)]).toEqual([true, true, false]);
    expect(limiter.take(1000)).toBe(true);
  });
});

describe("SupportService", () => {
  it("stores valid requests and lists them newest first", () => {
    let ids = 0;
    let clock = 0;
    const times = ["2026-11-08T10:00:00.000Z", "2026-11-08T11:00:00.000Z"];
    const service = new SupportService(
      db,
      () => times[clock++] ?? "",
      () => `req-${String(++ids)}`,
    );
    expect(
      service.submit({ email: "avery@example.com", message: "Is the lamp dimmable at all?" }),
    ).toEqual({ ok: true, id: "req-1" });
    service.submit({
      email: "sam@example.com",
      message: "Do you ship to Alaska, please?",
      question: "shipping to alaska",
    });
    expect(service.list().map((r) => [r.email, r.question])).toEqual([
      ["sam@example.com", "shipping to alaska"],
      ["avery@example.com", ""],
    ]);
  });

  it("rejects invalid input with field errors and stores nothing", () => {
    const service = new SupportService(db);
    expect(service.submit({ email: "nope", message: "short" })).toEqual({
      ok: false,
      errors: {
        email: "Enter a valid email address.",
        message: "Tell us a little more (at least 10 characters).",
      },
    });
    expect(service.list()).toEqual([]);
  });
});
