import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyShopifyButton } from "@/components/admin/verify-shopify-button";
import { advisorStatus } from "@/server/advisor";
import { contentAiStatus } from "@/server/content-studio";
import type {
  IntegrationState,
  WordingStatusSnapshot,
} from "@/server/integrations/wording-provider";
import { requireMerchant } from "@/server/merchant-session";
import { platformOverview } from "@/server/store-platform";

export const metadata: Metadata = { title: "Integrations" };

const STATE_LABELS: Record<IntegrationState, string> = {
  DEMO: "Demo",
  CONFIGURED: "Configured, not verified",
  CONNECTED_VERIFIED: "Connected and verified",
  ERROR: "Error",
};

const STATE_STYLES: Record<IntegrationState, string> = {
  DEMO: "bg-line text-ink",
  CONFIGURED: "bg-[#e6edf5] text-[#2c4a6b]",
  CONNECTED_VERIFIED: "bg-moss/15 text-moss",
  ERROR: "bg-clay text-paper",
};

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const formatTime = (iso: string) => `${timeFormat.format(new Date(iso))} UTC`;

function IntegrationCard({
  id,
  title,
  state,
  children,
}: {
  id: string;
  title: string;
  state: IntegrationState;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-sm border border-line bg-white p-4 text-sm"
      data-testid="integration"
      data-integration={id}
      data-state={state}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="font-medium">
          {title}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}
          data-testid="integration-state"
        >
          {STATE_LABELS[state]}
        </span>
      </div>
      <div className="mt-2 space-y-2 text-muted">{children}</div>
    </section>
  );
}

function aiDescription(status: WordingStatusSnapshot, demoText: string): string {
  switch (status.state) {
    case "DEMO":
      return demoText;
    case "CONFIGURED":
      return `A key is set for ${status.model ?? "the model"}, but no request has succeeded in this server process yet.`;
    case "CONNECTED_VERIFIED":
      return `${status.model ?? "The model"} last responded ${status.lastEventAt ? formatTime(status.lastEventAt) : "at an unknown time"}.`;
    case "ERROR":
      return `The last request failed: ${status.lastIssue ?? "unknown error"}. The no-key fallback is in use.`;
  }
}

export default function IntegrationsPage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Integrations</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        What this store is really connected to. A state changes only because of its configuration or
        a real check. Connections are set through server environment variables, and their values are
        never shown here.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading integrations…</p>}>
        <Integrations />
      </Suspense>
    </>
  );
}

async function Integrations() {
  await requireMerchant();
  const overview = await platformOverview();
  const { shopify } = overview;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <IntegrationCard id="demo-catalog" title="Store catalog" state="DEMO">
        <p data-testid="demo-catalog-detail">{overview.demoCatalog}</p>
        <p>The storefront, cart and checkout run on this catalog. Checkout is simulated.</p>
      </IntegrationCard>

      <IntegrationCard id="shopify" title="Shopify" state={shopify.state}>
        {shopify.state === "DEMO" && (
          <p>
            Not configured. No Shopify store has been connected or verified, so this store does not
            read from or write to Shopify.
          </p>
        )}
        {shopify.state === "CONFIGURED" && (
          <p>Settings are complete, but the connection has not been checked yet.</p>
        )}
        {shopify.detail && (
          <p
            className={shopify.state === "ERROR" ? "text-clay" : undefined}
            data-testid="shopify-detail"
          >
            {shopify.detail}
          </p>
        )}
        {overview.storeDomain && (
          <p>
            Store {overview.storeDomain}, API version {overview.apiVersion}.
          </p>
        )}
        {shopify.checkedAt && (
          <p className="text-xs">Last checked {formatTime(shopify.checkedAt)}.</p>
        )}
        <dl
          className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs"
          data-testid="shopify-settings"
        >
          {overview.settings.map((setting) => (
            <div key={setting.name} className="contents">
              <dt className="font-mono break-all">{setting.name}</dt>
              <dd>{setting.isSet ? "Set" : "Not set"}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs">
          Connection checks only read data. Nothing can be written to Shopify from this store.
          Webhook signatures can be verified in code, but no endpoint receives webhooks yet.
        </p>
        {overview.canVerify && <VerifyShopifyButton />}
      </IntegrationCard>

      <IntegrationCard
        id="advisor-ai"
        title="Shopping advisor wording (Claude)"
        state={advisorStatus().snapshot().state}
      >
        <p>
          {aiDescription(
            advisorStatus().snapshot(),
            "No API key is configured. The advisor answers from catalog rules alone.",
          )}
        </p>
      </IntegrationCard>

      <IntegrationCard
        id="content-ai"
        title="Content Studio drafts (Claude)"
        state={contentAiStatus().snapshot().state}
      >
        <p>
          {aiDescription(
            contentAiStatus().snapshot(),
            "No API key is configured. Drafts are rules-based and labelled as such.",
          )}
        </p>
      </IntegrationCard>

      <IntegrationCard id="notifications" title="Customer notifications" state="DEMO">
        <p>Order messages are stored as previews in Automations. No email or message is sent.</p>
      </IntegrationCard>

      <section
        aria-labelledby="not-built-heading"
        className="rounded-sm border border-dashed border-line p-4 text-sm"
        data-testid="not-built"
      >
        <h2 id="not-built-heading" className="font-medium">
          Not built
        </h2>
        <p className="mt-2 text-muted">
          Klaviyo, Google Analytics, Meta, n8n, Slack and WooCommerce have no connector in this
          store, and none is claimed.
        </p>
      </section>
    </div>
  );
}
