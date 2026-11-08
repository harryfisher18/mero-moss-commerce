"use client";

import { type RefObject, useRef, useState } from "react";
import type { Product } from "@/domain/commerce/catalog";
import type { StorePolicy } from "@/domain/commerce/policies";
import {
  improvedProductView,
  LAB_ADD_PREVIEW,
  legacyAddMessage,
  legacyProductView,
} from "@/domain/upgrade-lab/comparisons";

interface PanelMeasurement {
  readonly controls: number;
  readonly smallestControlPx: number;
}

/** Reads the panel as it is rendered right now. No estimates. */
function measure(panel: HTMLElement | null): PanelMeasurement | null {
  if (!panel) return null;
  const heights = [...panel.querySelectorAll("a, button, select, input")].map(
    (element) => element.getBoundingClientRect().height,
  );
  if (heights.length === 0) return null;
  return { controls: heights.length, smallestControlPx: Math.round(Math.min(...heights)) };
}

function PhoneFrame({
  label,
  testId,
  frameRef,
  children,
}: {
  label: string;
  testId: string;
  frameRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="min-w-0">
      <h3 className="text-sm font-medium">{label}</h3>
      <div
        ref={frameRef}
        data-testid={testId}
        className="mt-2 w-full max-w-sm rounded-2xl border-4 border-ink/80 bg-white p-4"
      >
        {children}
      </div>
    </section>
  );
}

/** The same catalog product in both frames. Neither frame touches a real cart. */
export function UpgradeLabProduct({
  product,
  policies,
}: {
  product: Product;
  policies: readonly StorePolicy[];
}) {
  const legacy = legacyProductView(product);
  const [beforeId, setBeforeId] = useState(legacy.choices[0]?.id ?? "");
  const [beforeMessage, setBeforeMessage] = useState("");
  const [afterId, setAfterId] = useState<string | undefined>(undefined);
  const [afterMessage, setAfterMessage] = useState("");
  const [measured, setMeasured] = useState<{
    before: PanelMeasurement | null;
    after: PanelMeasurement | null;
  } | null>(null);
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const after = improvedProductView(product, afterId);

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        <PhoneFrame label="Before (illustrative)" testId="lab-before" frameRef={beforeRef}>
          <p className="text-xs font-bold">{product.title}</p>
          <p className="text-xs" data-testid="lab-before-price">
            {legacy.priceLabel}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-muted">{product.description}</p>
          <div className="mt-1 flex items-center gap-1">
            <select
              aria-label="Option"
              value={beforeId}
              onChange={(event) => {
                setBeforeId(event.target.value);
                setBeforeMessage("");
              }}
              className="border border-line text-[11px]"
            >
              {legacy.choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setBeforeMessage(legacyAddMessage(product, beforeId))}
              className="border border-line px-1 text-[11px]"
            >
              Add
            </button>
          </div>
          <p role="status" className="mt-1 min-h-4 text-[11px]" data-testid="lab-before-message">
            {beforeMessage}
          </p>
          <p className="text-[10px] leading-tight text-muted">
            {policies.map((policy) => policy.body).join(" ")}
          </p>
        </PhoneFrame>

        <PhoneFrame label="After (this store's rules)" testId="lab-after" frameRef={afterRef}>
          <p className="font-serif text-xl">{product.title}</p>
          {after && (
            <>
              <p className="mt-1" data-testid="lab-after-price">
                <span className="font-medium">{after.price.price}</span>
                {after.price.compareAt && (
                  <s className="ml-2 text-muted">{after.price.compareAt}</s>
                )}
              </p>
              <p className="text-sm text-moss" data-testid="lab-after-availability">
                {after.availability}
              </p>
              {after.options.map((option) => (
                <fieldset key={option.name} className="mt-3">
                  <legend className="text-sm font-medium">{option.name}</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {option.values.map((value) => (
                      <button
                        key={value.value}
                        type="button"
                        aria-pressed={value.selected}
                        onClick={() => {
                          setAfterId(value.variantId);
                          setAfterMessage("");
                        }}
                        className={`min-h-11 rounded-full border px-4 text-sm ${
                          value.selected ? "border-ink bg-ink text-paper" : "border-line"
                        } ${value.soldOut ? "line-through opacity-70" : ""}`}
                      >
                        {value.value}
                        {value.soldOut && <span className="sr-only"> (sold out)</span>}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={!after.canBuy}
                onClick={() => setAfterMessage(LAB_ADD_PREVIEW)}
                className="mt-4 min-h-11 w-full rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-moss disabled:bg-line disabled:text-muted"
              >
                {after.canBuy ? "Add to cart" : "Sold out"}
              </button>
              <p role="status" className="mt-2 min-h-5 text-sm" data-testid="lab-after-message">
                {afterMessage}
              </p>
            </>
          )}
          <ul className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
            {policies.map((policy) => (
              <li key={policy.key}>
                <a href={`/#${policy.key}`} className="underline underline-offset-2">
                  {policy.title}
                </a>
                <span className="block text-xs text-muted">{policy.summary}</span>
              </li>
            ))}
          </ul>
        </PhoneFrame>
      </div>

      <div className="mt-6 rounded-sm border border-line bg-white p-4 text-sm">
        <button
          type="button"
          onClick={() =>
            setMeasured({ before: measure(beforeRef.current), after: measure(afterRef.current) })
          }
          className="min-h-11 rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-paper"
        >
          Measure these panels
        </button>
        {measured && (
          <table className="mt-3 w-full max-w-md text-left" data-testid="lab-measurements">
            <caption className="text-left text-xs text-muted">
              Read from the panels above just now, in this browser at its current size. These are
              layout facts, not performance or conversion results.
            </caption>
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="py-1 font-normal">
                  Panel
                </th>
                <th scope="col" className="py-1 font-normal">
                  Controls
                </th>
                <th scope="col" className="py-1 font-normal">
                  Smallest control height
                </th>
              </tr>
            </thead>
            <tbody>
              {(["before", "after"] as const).map((panel) => (
                <tr key={panel} data-panel={panel}>
                  <th scope="row" className="py-1 font-normal capitalize">
                    {panel}
                  </th>
                  <td>{measured[panel]?.controls ?? "Not available"}</td>
                  <td data-testid={`lab-smallest-${panel}`}>
                    {measured[panel]
                      ? `${String(measured[panel].smallestControlPx)} px`
                      : "Not available"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
