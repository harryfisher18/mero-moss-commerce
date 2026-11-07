import type { OrderStatus } from "@/domain/commerce/order";
import { STATUS_LABELS } from "@/domain/commerce/order-status";

const STYLES: Record<OrderStatus, string> = {
  placed: "bg-clay/15 text-clay",
  processing: "bg-[#e6edf5] text-[#2c4a6b]",
  fulfilled: "bg-moss/15 text-moss",
  cancelled: "bg-line text-muted",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      data-testid="order-status"
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
