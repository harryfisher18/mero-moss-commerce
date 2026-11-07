"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type CheckoutActionState, placeOrder } from "@/app/(store)/checkout/actions";
import type { CheckoutField } from "@/domain/commerce/order";
import { SHIPPING_REGIONS } from "@/domain/commerce/order";

const initialState: CheckoutActionState = {
  status: "idle",
  formError: null,
  problems: [],
  fieldErrors: {},
  values: {},
};

const inputClass =
  "mt-1 w-full rounded-sm border border-line bg-paper px-3 py-2.5 text-sm aria-[invalid=true]:border-clay";

/** Contact + shipping form for a SIMULATED order. Deliberately has no payment fields. */
export function CheckoutForm() {
  const [state, formAction, pending] = useActionState(placeOrder, initialState);

  const field = (name: CheckoutField) => {
    const error = state.fieldErrors[name];
    return {
      id: name,
      name,
      defaultValue: state.values[name] ?? "",
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${name}-error` : undefined,
    } as const;
  };
  const errorFor = (name: CheckoutField) =>
    state.fieldErrors[name] ? (
      <p id={`${name}-error`} className="mt-1 text-xs text-clay">
        {state.fieldErrors[name]}
      </p>
    ) : null;

  return (
    <form action={formAction} noValidate className="space-y-8" data-testid="checkout-form">
      {(state.formError || state.problems.length > 0) && (
        <div role="alert" className="rounded-sm border border-clay p-4 text-sm text-clay">
          {state.formError && <p className="font-medium">{state.formError}</p>}
          {state.problems.length > 0 && (
            <>
              <ul className="mt-2 list-disc pl-5">
                {state.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
              <Link href="/cart" className="mt-3 inline-block underline underline-offset-2">
                Review your cart
              </Link>
            </>
          )}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="font-serif text-xl">Contact</legend>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            {...field("email")}
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
          {errorFor("email")}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-xl">Shipping address</legend>
        <p className="text-sm text-muted">We ship within the contiguous United States.</p>
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium">
            Full name
          </label>
          <input {...field("fullName")} autoComplete="name" required className={inputClass} />
          {errorFor("fullName")}
        </div>
        <div>
          <label htmlFor="address1" className="block text-sm font-medium">
            Address
          </label>
          <input
            {...field("address1")}
            autoComplete="address-line1"
            required
            className={inputClass}
          />
          {errorFor("address1")}
        </div>
        <div>
          <label htmlFor="address2" className="block text-sm font-medium">
            Apartment, suite, etc. <span className="font-normal text-muted">(optional)</span>
          </label>
          <input {...field("address2")} autoComplete="address-line2" className={inputClass} />
          {errorFor("address2")}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_8rem]">
          <div>
            <label htmlFor="city" className="block text-sm font-medium">
              City
            </label>
            <input
              {...field("city")}
              autoComplete="address-level2"
              required
              className={inputClass}
            />
            {errorFor("city")}
          </div>
          <div>
            <label htmlFor="region" className="block text-sm font-medium">
              State
            </label>
            <select
              {...field("region")}
              autoComplete="address-level1"
              required
              className={inputClass}
            >
              <option value="">Select a state</option>
              {Object.entries(SHIPPING_REGIONS).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            {errorFor("region")}
          </div>
          <div>
            <label htmlFor="postalCode" className="block text-sm font-medium">
              ZIP code
            </label>
            <input
              {...field("postalCode")}
              autoComplete="postal-code"
              inputMode="numeric"
              required
              className={inputClass}
            />
            {errorFor("postalCode")}
          </div>
        </div>
      </fieldset>

      <div className="rounded-sm bg-moss/10 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acknowledgeSimulated"
            value="yes"
            required
            aria-invalid={state.fieldErrors.acknowledgeSimulated ? true : undefined}
            aria-describedby={
              state.fieldErrors.acknowledgeSimulated ? "acknowledgeSimulated-error" : undefined
            }
            className="mt-0.5"
          />
          <span>
            I understand this is a <strong>simulated order</strong> in a demo store: no payment is
            taken and nothing will be shipped.
          </span>
        </label>
        {errorFor("acknowledgeSimulated")}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
      >
        {pending ? "Placing simulated order…" : "Place simulated order"}
      </button>
    </form>
  );
}
