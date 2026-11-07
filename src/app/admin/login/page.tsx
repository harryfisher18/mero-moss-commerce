import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import {
  DEMO_MERCHANT_EMAIL,
  DEMO_MERCHANT_PASSWORD,
  merchantCredentials,
} from "@/server/merchant-config";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="font-serif text-3xl">Sign in to the merchant console</h1>
      <p className="mt-2 text-sm text-muted">
        Manage orders placed in the Mero &amp; Moss demo store.
      </p>
      <Suspense fallback={null}>
        <DemoCredentials />
      </Suspense>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Shown only while the public demo login is active (no credentials configured). */
async function DemoCredentials() {
  await connection();
  if (!merchantCredentials().isDemo) return null;
  return (
    <div role="note" className="mt-6 rounded-sm border border-moss/40 bg-moss/10 p-4 text-sm">
      <p className="font-medium">Demo login</p>
      <p className="mt-1">This demo console uses public credentials so anyone can explore it:</p>
      <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-y-1">
        <dt className="text-muted">Email</dt>
        <dd data-testid="demo-email">{DEMO_MERCHANT_EMAIL}</dd>
        <dt className="text-muted">Password</dt>
        <dd data-testid="demo-password">{DEMO_MERCHANT_PASSWORD}</dd>
      </dl>
    </div>
  );
}

async function LoginFormWithNext({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}
