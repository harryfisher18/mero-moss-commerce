import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DemoResetForm } from "@/components/admin/demo-reset-form";
import { settingsGroups } from "@/domain/merchant/settings";
import { merchantCredentials } from "@/server/merchant-config";
import { requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Settings" };

const REPOSITORY = "https://github.com/harryfisher18/mero-moss-commerce/blob/main";

export default function SettingsPage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Settings</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        How this store is configured. Settings come from the server&rsquo;s environment, so they are
        changed there, not here, and their values are never shown.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading settings…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  await requireMerchant();
  await connection();
  const { isDemo } = merchantCredentials();
  const groups = settingsGroups(process.env);

  return (
    <div className="mt-6 space-y-8">
      <section
        aria-labelledby="login-heading"
        className="rounded-sm border border-line bg-white p-4 text-sm"
        data-testid="login-mode"
      >
        <h2 id="login-heading" className="font-medium">
          Console login
        </h2>
        <p className="mt-1">
          {isDemo
            ? "Public demo login. Anyone can sign in with the credentials shown on the login page. Set MERCHANT_EMAIL and MERCHANT_PASSWORD_HASH before exposing this store."
            : "Private login, using the configured merchant credentials."}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.title}
            aria-label={group.title}
            className="min-w-0 rounded-sm border border-line bg-white p-4 text-sm"
          >
            <h2 className="font-medium">{group.title}</h2>
            <dl className="mt-2 space-y-2" data-testid="settings-group">
              {group.rows.map((row) => (
                <div key={row.name}>
                  <dt className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono text-xs break-all">{row.name}</span>
                    <span data-testid="setting-state" data-name={row.name}>
                      {row.state}
                    </span>
                  </dt>
                  <dd className="text-xs text-muted">{row.purpose}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section aria-labelledby="upgrades-heading" className="text-sm">
        <h2 id="upgrades-heading" className="font-medium">
          Applying this to an existing store
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <Link href="/admin/upgrade-lab" className="underline underline-offset-2">
              Upgrade Lab
            </Link>
            : interactive before-and-after comparisons on this catalog.
          </li>
          <li>
            <a
              href={`${REPOSITORY}/SERVICE_ADAPTATIONS.md`}
              className="underline underline-offset-2"
            >
              Service adaptations
            </a>
            : what exists here, and what each kind of project would still need.
          </li>
          <li>
            <a href={`${REPOSITORY}/DEPLOYMENT.md`} className="underline underline-offset-2">
              Deployment notes
            </a>
            : running this outside a development machine, and its limits.
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="reset-heading"
        className="rounded-sm border border-clay bg-white p-4 text-sm"
      >
        <h2 id="reset-heading" className="font-medium">
          Reset demo data
        </h2>
        {isDemo ? (
          <>
            <p className="mt-1 text-muted">
              Removes every order, cart, request, automation record and catalog edit, and restores
              the original demo catalog. You stay signed in. This cannot be undone.
            </p>
            <DemoResetForm />
          </>
        ) : (
          <p className="mt-1 text-muted" data-testid="reset-unavailable">
            Not available: this store has private merchant credentials, so its data is never reset
            from the browser.
          </p>
        )}
      </section>
    </div>
  );
}
