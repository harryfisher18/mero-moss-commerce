"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  type ContentActionState,
  decideContentDraft,
  generateContentDraft,
  saveContentDraft,
} from "@/app/admin/actions";
import {
  CONTENT_FIELD_LABELS,
  CONTENT_FIELDS,
  CONTENT_LIMITS,
  type ContentFields,
} from "@/domain/content/draft";

const initialState: ContentActionState = { status: "idle", message: "" };

function useRefreshOnSuccess(state: ContentActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
}

function StatusMessage({ state, testId }: { state: ContentActionState; testId: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={`min-h-5 text-sm ${state.status === "error" ? "text-clay" : "text-moss"}`}
    >
      {state.message}
    </p>
  );
}

export function GenerateDraftButton({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(generateContentDraft, initialState);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
      >
        {pending ? "Drafting…" : "Generate a new draft"}
      </button>
      <StatusMessage state={state} testId="generate-status" />
    </form>
  );
}

const inputClass = "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm";

/** Edits are saved as a new version; the version being edited stays in the history. */
export function DraftEditForm({ draftId, fields }: { draftId: string; fields: ContentFields }) {
  const [state, action, pending] = useActionState(saveContentDraft, initialState);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-4" data-testid="draft-edit-form">
      <input type="hidden" name="draftId" value={draftId} />
      {CONTENT_FIELDS.map((field) => {
        const id = `draft-${field}`;
        const { min, max } = CONTENT_LIMITS[field];
        return (
          <div key={field}>
            <label htmlFor={id} className="block text-sm font-medium">
              {CONTENT_FIELD_LABELS[field]}{" "}
              <span className="font-normal text-muted">
                ({String(min)}–{String(max)} characters)
              </span>
            </label>
            {field === "title" ? (
              <input id={id} name={field} defaultValue={fields[field]} className={inputClass} />
            ) : (
              <textarea
                id={id}
                name={field}
                rows={field === "summary" ? 2 : 3}
                defaultValue={fields[field]}
                className={inputClass}
              />
            )}
          </div>
        );
      })}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-ink px-5 py-2 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save as new version"}
      </button>
      <StatusMessage state={state} testId="edit-status" />
    </form>
  );
}

export function DraftDecision({ draftId, canApprove }: { draftId: string; canApprove: boolean }) {
  const [state, action, pending] = useActionState(decideContentDraft, initialState);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-2" data-testid="draft-decision">
      <input type="hidden" name="draftId" value={draftId} />
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <button
            type="submit"
            name="decision"
            value="approve"
            disabled={pending}
            className="rounded-full bg-moss px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink disabled:opacity-60"
          >
            Approve and publish
          </button>
        )}
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="rounded-full border border-clay px-5 py-2.5 text-sm font-medium text-clay hover:bg-clay/10 disabled:opacity-60"
        >
          Reject draft
        </button>
      </div>
      <StatusMessage state={state} testId="decision-status" />
    </form>
  );
}
