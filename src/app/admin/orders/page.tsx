import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatMoney } from "@/domain/commerce/money";
import { ORDER_STATUSES, type OrderStatus } from "@/domain/commerce/order";
import { STATUS_LABELS } from "@/domain/commerce/order-status";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { merchantOrders, requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted">
            Simulated orders placed through the demo storefront checkout. No payments are taken.
          </p>
        </div>
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading orders…</p>}>
        <OrdersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

async function OrdersTable({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMerchant();
  const { status: raw } = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === raw) as OrderStatus | undefined;
  const orders = merchantOrders().list(status);

  return (
    <>
      <nav aria-label="Filter by status" className="mt-6">
        <ul className="flex flex-wrap gap-2 text-sm">
          {[undefined, ...ORDER_STATUSES].map((value) => {
            const current = value === status;
            return (
              <li key={value ?? "all"}>
                <Link
                  href={value ? `/admin/orders?status=${value}` : "/admin/orders"}
                  aria-current={current ? "page" : undefined}
                  className={`inline-block rounded-full border px-3 py-1 ${
                    current ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                  }`}
                >
                  {value ? STATUS_LABELS[value] : "All"}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-sm border border-dashed border-line p-10 text-center">
          <p className="font-serif text-xl">No orders {status ? "with this status" : "yet"}.</p>
          <p className="mt-2 text-sm text-muted">
            Orders appear here as soon as a shopper completes the demo checkout.
          </p>
          <Link href="/collections/all" className="mt-4 inline-block underline underline-offset-2">
            Open the storefront
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-white">
          <table className="w-full min-w-[42rem] text-left text-sm" data-testid="orders-table">
            <caption className="sr-only">Orders, newest first</caption>
            <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Order
                </th>
                <th scope="col" className="px-4 py-3">
                  Placed (UTC)
                </th>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Items
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Total
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => (
                <tr key={order.id} data-testid="order-row" data-order-number={order.orderNumber}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="underline underline-offset-2"
                    >
                      {order.orderNumber}
                    </Link>
                  </th>
                  <td className="px-4 py-3">{dateFormat.format(new Date(order.createdAt))}</td>
                  <td className="px-4 py-3">
                    {order.customerName}
                    <span className="block text-xs text-muted">{order.email}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{order.itemCount}</td>
                  <td className="px-4 py-3 text-right" data-testid="order-row-total">
                    {formatMoney(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
