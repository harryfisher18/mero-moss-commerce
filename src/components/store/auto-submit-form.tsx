"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef } from "react";

/**
 * A GET form that applies itself on every change. With JavaScript it navigates
 * client-side to a clean URL (empty values dropped, pagination reset). Without
 * JavaScript it is a normal GET form and the <noscript> submit button applies it.
 */
export function AutoSubmitForm({
  action,
  label,
  stateKey,
  className,
  children,
}: {
  action: string;
  label: string;
  /** Serialized URL state. When it changes (e.g. a filter chip was removed), inputs reset to their new defaults. */
  stateKey: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.reset();
  }, [stateKey]);

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "" && key !== "page") params.append(key, value);
    }
    const query = params.toString();
    router.push(query ? `${action}?${query}` : action, { scroll: false });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(event.currentTarget);
  }

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      aria-label={label}
      className={className}
      onSubmit={onSubmit}
      onChange={(event) => apply(event.currentTarget)}
    >
      {children}
      <noscript>
        <button
          type="submit"
          className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          Apply
        </button>
      </noscript>
    </form>
  );
}
