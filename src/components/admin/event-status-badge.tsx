import {
  DISPLAY_STATUS_LABELS,
  displayStatus,
  type EventDisplayStatus,
  type EventStatus,
} from "@/domain/events/outbox";

const STYLES: Record<EventDisplayStatus, string> = {
  queued: "bg-[#e6edf5] text-[#2c4a6b]",
  retrying: "bg-clay/15 text-clay",
  succeeded: "bg-moss/15 text-moss",
  dead: "bg-clay text-paper",
};

export function EventStatusBadge({ status, attempts }: { status: EventStatus; attempts: number }) {
  const display = displayStatus(status, attempts);
  return (
    <span
      data-testid="event-status"
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[display]}`}
    >
      {DISPLAY_STATUS_LABELS[display]}
    </span>
  );
}
