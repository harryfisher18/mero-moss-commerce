"use client";

import { useState } from "react";
import { SHIP_ZONES } from "@/domain/events/order-created";
import { type TriageExpected, triageFeedback } from "@/domain/upgrade-lab/comparisons";

const selectClass = "mt-1 min-h-11 w-full rounded-sm border border-line bg-white px-2 text-sm";

/** The manual decision a person makes from the note, checked against the automation rules. */
export function UpgradeLabTriage({ expected }: { expected: TriageExpected }) {
  const [zone, setZone] = useState("");
  const [review, setReview] = useState("");
  const [feedback, setFeedback] = useState("");
  const update = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setFeedback("");
  };

  return (
    <form
      className="mt-3 space-y-3"
      data-testid="lab-triage"
      onSubmit={(event) => {
        event.preventDefault();
        setFeedback(triageFeedback(expected, { zone, review }));
      }}
    >
      <div>
        <label htmlFor="lab-zone" className="block text-sm font-medium">
          Ship zone
        </label>
        <select
          id="lab-zone"
          required
          value={zone}
          onChange={(event) => update(setZone)(event.target.value)}
          className={selectClass}
        >
          <option value="">Choose a zone</option>
          {SHIP_ZONES.map((value) => (
            <option key={value} value={value} className="capitalize">
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="lab-review" className="block text-sm font-medium">
          Hold for review?
        </label>
        <select
          id="lab-review"
          required
          value={review}
          onChange={(event) => update(setReview)(event.target.value)}
          className={selectClass}
        >
          <option value="">Choose</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <button
        type="submit"
        className="min-h-11 rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-paper"
      >
        Check my decision
      </button>
      <p role="status" className="min-h-5 text-sm" data-testid="lab-triage-feedback">
        {feedback}
      </p>
    </form>
  );
}
