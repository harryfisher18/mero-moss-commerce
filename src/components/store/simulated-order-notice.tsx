/** Prominent disclosure shown on checkout and confirmation pages. */
export function SimulatedOrderNotice({ placed = false }: { placed?: boolean }) {
  return (
    <div
      role="note"
      data-testid="simulated-order-notice"
      className="rounded-sm border-2 border-clay bg-clay/10 p-4 text-sm"
    >
      <p className="font-semibold tracking-wide text-clay uppercase">
        Simulated order · No payment
      </p>
      <p className="mt-1 text-ink">
        {placed
          ? "This order was simulated in a demo store. No payment was taken, no card details were collected, and nothing will be shipped."
          : "Mero & Moss is a demo store. Placing an order creates a simulated order only: no payment is taken, no card details are requested, and nothing will be shipped."}
      </p>
    </div>
  );
}
