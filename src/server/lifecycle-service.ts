import { z } from "zod";
import type { OrderCreatedPayload } from "@/domain/events/order-created";
import {
  ABANDONED_AFTER_MS,
  abandonedCartKey,
  cartReminderSchema,
  decideJourney,
  type JourneyId,
  type LifecycleMessage,
  normalizeEmail,
  postPurchaseKey,
  renderAbandonedCart,
  renderPostPurchase,
  renderWelcome,
  welcomeKey,
} from "@/domain/lifecycle/journeys";
import { type Database, withTransaction } from "@/server/db/database";
import {
  DemoMarketingProvider,
  type MarketingProvider,
} from "@/server/integrations/marketing-provider";
import { SqliteCartRepository } from "@/server/repositories/cart-repository";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import {
  type ConsentRecord,
  type LifecycleRecord,
  type MessageStatus,
  SqliteLifecycleRepository,
} from "@/server/repositories/lifecycle-repository";
import { priceCart } from "@/domain/commerce/cart";

export type CartReminderResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "empty_cart" }
  | {
      readonly ok: false;
      readonly reason: "invalid";
      readonly errors: Partial<Record<"email" | "consent", string>>;
    };

export interface SweepSummary {
  readonly previewed: number;
  readonly skipped: number;
}

export interface LifecycleReport {
  readonly counts: Record<JourneyId, Record<MessageStatus, number>>;
  readonly records: LifecycleRecord[];
  readonly consents: ConsentRecord[];
}

/**
 * Lifecycle journeys. Consent is read when each message is prepared, so a withdrawal
 * applies immediately. Every message has a unique dedupe key, checked before the provider
 * is called, and is stored as a preview: nothing here contacts anyone.
 */
export class LifecycleService {
  private readonly repo: SqliteLifecycleRepository;

  constructor(
    private readonly db: Database,
    private readonly provider: MarketingProvider = new DemoMarketingProvider(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.repo = new SqliteLifecycleRepository(db);
  }

  /** Runs inside the caller's transaction, as part of order.created processing. */
  onOrderCreated(eventId: string, payload: OrderCreatedPayload, at: string): number {
    const email = normalizeEmail(payload.customer.email);
    const hasConsent = this.repo.hasConsent(email);
    const results = [
      hasConsent ? this.welcome(email, at) : "duplicate",
      this.apply({
        journey: "post_purchase",
        dedupeKey: postPurchaseKey(eventId),
        email,
        reference: payload.orderNumber,
        hasConsent,
        render: () => renderPostPurchase(payload),
        at,
      }),
    ];
    return results.filter((result) => result !== "duplicate").length;
  }

  requestCartReminder(cartId: string | undefined, raw: unknown): CartReminderResult {
    const parsed = cartReminderSchema.safeParse(raw);
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors;
      return {
        ok: false,
        reason: "invalid",
        errors: { email: fields.email?.[0], consent: fields.consent?.[0] },
      };
    }
    if (!cartId) return { ok: false, reason: "empty_cart" };
    const carts = new SqliteCartRepository(this.db);
    if (carts.getLines(cartId).length === 0) return { ok: false, reason: "empty_cart" };

    const email = normalizeEmail(parsed.data.email);
    const at = this.now().toISOString();
    withTransaction(this.db, () => {
      this.repo.grantConsent(email, "cart_reminder", at);
      this.repo.linkCart(cartId, email, at);
      this.welcome(email, at);
    });
    return { ok: true };
  }

  withdrawConsent(rawEmail: string): boolean {
    return this.repo.withdrawConsent(normalizeEmail(rawEmail), this.now().toISOString());
  }

  /** Prepares reminders for carts left unchanged for an hour. Safe to run repeatedly. */
  sweepAbandonedCarts(): SweepSummary {
    const now = this.now();
    const cutoff = new Date(now.getTime() - ABANDONED_AFTER_MS).toISOString();
    const carts = new SqliteCartRepository(this.db);
    const catalog = new SqliteCatalogRepository(this.db);
    const summary = { previewed: 0, skipped: 0 };
    for (const candidate of this.repo.abandonedCandidates(cutoff)) {
      const dedupeKey = abandonedCartKey(candidate.cartId, candidate.updatedAt);
      if (this.repo.hasRecord(dedupeKey)) continue;
      const lines = carts.getLines(candidate.cartId);
      const priced = priceCart(
        lines,
        catalog.getCatalogEntries(lines.map((line) => line.variantId)),
      );
      withTransaction(this.db, () => {
        const result = this.apply({
          journey: "abandoned_cart",
          dedupeKey,
          email: candidate.email,
          reference: "Saved cart",
          hasConsent: this.repo.hasConsent(candidate.email),
          render: () =>
            renderAbandonedCart(
              priced.lines
                .filter((line) => line.issue === null)
                .map((line) => ({
                  title: line.productTitle,
                  variantTitle: line.variantTitle,
                  quantity: line.quantity,
                })),
            ),
          at: now.toISOString(),
        });
        if (result === "previewed") summary.previewed += 1;
        if (result === "skipped") summary.skipped += 1;
      });
    }
    return summary;
  }

  report(): LifecycleReport {
    return {
      counts: this.repo.countsByJourney(),
      records: this.repo.records(),
      consents: this.repo.consents(),
    };
  }

  private welcome(email: string, at: string) {
    return this.apply({
      journey: "welcome",
      dedupeKey: welcomeKey(email),
      email,
      reference: "Opt-in",
      hasConsent: true,
      render: renderWelcome,
      at,
    });
  }

  /** Applies one journey at most once per dedupe key. */
  private apply(input: {
    journey: JourneyId;
    dedupeKey: string;
    email: string;
    reference: string;
    hasConsent: boolean;
    render: () => LifecycleMessage | null;
    at: string;
  }): "previewed" | "skipped" | "duplicate" {
    if (this.repo.hasRecord(input.dedupeKey)) return "duplicate";
    const { journey, dedupeKey, reference, at } = input;
    const decision = decideJourney(input.hasConsent, input.render);
    if (decision.outcome === "skipped") {
      this.repo.addRecord({
        journey,
        dedupeKey,
        email: null,
        reference,
        status: decision.reason === "no_consent" ? "skipped_no_consent" : "skipped_empty",
        subject: "",
        body: "",
        createdAt: at,
      });
      return "skipped";
    }
    this.provider.deliver({ journey, to: input.email, ...decision.message });
    this.repo.addRecord({
      journey,
      dedupeKey,
      email: input.email,
      reference,
      status: "previewed",
      subject: decision.message.subject,
      body: decision.message.body,
      createdAt: at,
    });
    return "previewed";
  }
}
