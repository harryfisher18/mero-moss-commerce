"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { type BrandingState, saveBrandingAction } from "@/app/admin/actions";
import { ANNOUNCEMENT_MAX, type Branding, TAGLINE_MAX } from "@/domain/merchant/branding";

const inputClass =
  "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm aria-[invalid=true]:border-clay";

/** Edits the storefront wording, with a live preview of how shoppers will see it. */
export function BrandingForm({ current }: { current: Branding }) {
  const [state, action, pending] = useActionState<BrandingState, FormData>(saveBrandingAction, {
    status: "idle",
    message: "",
    errors: {},
    values: null,
  });
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  const values = state.values ?? current;
  const [draft, setDraft] = useState<Branding>(values);
  // Follow each saved or rejected submission, which is also what the form resets to.
  const [lastState, setLastState] = useState(state);
  if (lastState !== state) {
    setLastState(state);
    setDraft(values);
  }

  const field = (name: keyof Branding) =>
    state.errors[name]
      ? { "aria-invalid": true as const, "aria-describedby": `branding-${name}-error` }
      : {};

  return (
    <form
      action={action}
      onInput={(event) => {
        const form = event.currentTarget;
        const data = new FormData(form);
        setDraft({
          tagline: String(data.get("tagline") ?? ""),
          announcement: String(data.get("announcement") ?? ""),
        });
      }}
      className="mt-3 space-y-4"
      data-testid="branding-form"
    >
      <div>
        <label htmlFor="branding-tagline" className="block text-sm font-medium">
          Tagline
        </label>
        <p id="branding-tagline-hint" className="text-xs text-muted">
          Shown as the home page headline and in the footer. Up to {TAGLINE_MAX} characters.
        </p>
        <input
          id="branding-tagline"
          name="tagline"
          defaultValue={values.tagline}
          maxLength={TAGLINE_MAX * 2}
          className={inputClass}
          {...field("tagline")}
        />
        {state.errors.tagline && (
          <p id="branding-tagline-error" className="mt-1 text-xs text-clay">
            {state.errors.tagline}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="branding-announcement" className="block text-sm font-medium">
          Announcement (optional)
        </label>
        <p className="text-xs text-muted">
          One line above the store header. Leave it empty to show nothing. Up to {ANNOUNCEMENT_MAX}{" "}
          characters. Only announce what the store really offers.
        </p>
        <input
          id="branding-announcement"
          name="announcement"
          defaultValue={values.announcement}
          maxLength={ANNOUNCEMENT_MAX * 2}
          className={inputClass}
          {...field("announcement")}
        />
        {state.errors.announcement && (
          <p id="branding-announcement-error" className="mt-1 text-xs text-clay">
            {state.errors.announcement}
          </p>
        )}
      </div>

      <figure
        className="rounded-sm border border-dashed border-line"
        data-testid="branding-preview"
      >
        <figcaption className="px-3 pt-2 text-xs text-muted">Preview, not yet saved</figcaption>
        {draft.announcement.trim() && (
          <p className="mt-2 border-y border-line bg-paper px-3 py-2 text-center text-sm">
            {draft.announcement.trim()}
          </p>
        )}
        <div className="px-3 py-4">
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Mero &amp; Moss</p>
          <p className="mt-2 font-serif text-2xl leading-tight break-words">
            {draft.tagline.trim() || "(no tagline)"}
          </p>
        </div>
      </figure>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save branding"}
        </button>
        <p
          role="status"
          aria-live="polite"
          data-testid="branding-status"
          className={`text-sm ${state.status === "error" ? "text-clay" : "text-moss"}`}
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}
